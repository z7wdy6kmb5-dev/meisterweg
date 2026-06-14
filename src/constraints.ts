import type { Player, Transfer, BuiltinConstraintKey } from './types';

// ============================================================
// 縛り（Constraint）テンプレート定義
//
// 各テンプレートは:
//  - params: 設定パラメータ（例の数値・条件を再現するための入力欄。複数可）
//  - 自由記入欄（note）は全テンプレート共通でページ側に用意する
//  - 自動判定テンプレートは evaluate() を持ち、選手/移籍データから違反を算出
//
// データに無い情報（スタメン構成・スカウト・戦術など）は自動判定できないため、
// その条件は「手動」または「自動判定では一部のみ」と明示する。
// ============================================================

export interface ParamField {
  key: string;
  label: string;
  kind: 'number' | 'text';
  placeholder?: string;
  help?: string;
}

export interface ViolationResult {
  ok: boolean;
  violations: string[];   // 違反の具体内容
  summary: string;        // 状態の要約（順守時も表示）
}

export interface ConstraintContext {
  players: Player[];
  transfers: Transfer[];
}

export interface ConstraintTemplate {
  key: BuiltinConstraintKey;
  label: string;
  description: string;
  isAuto: boolean;
  /** 自動判定では一部条件のみ扱える場合の注記 */
  partialNote?: string;
  params: ParamField[];
  examples?: string[];
  evaluate?: (params: Record<string, unknown>, ctx: ConstraintContext) => ViolationResult;
}

const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const splitList = (v: unknown): string[] => str(v).split(/[,、\s]+/).map((s) => s.trim()).filter(Boolean);

// 在籍中の選手（自動判定の母集団）
const onRoster = (players: Player[]) => players.filter((p) => p.current_status !== '退団');
// 獲得（アカデミー以外）
const acquired = (players: Player[]) => players.filter((p) => !p.is_academy);

export const TEMPLATES: ConstraintTemplate[] = [
  // ============================================================
  // 自動判定
  // ============================================================
  {
    key: 'transfer_fee_cap',
    label: '移籍金上限',
    description: '獲得時に払える移籍金の最大額を決めます。これより高い移籍金で獲得した選手がいると違反です。',
    isAuto: true,
    params: [{ key: 'cap', label: '移籍金上限 (€)', kind: 'number', placeholder: '例：50000000' }],
    examples: ['獲得は移籍金5000万€まで'],
    evaluate: (p, ctx) => {
      const cap = num(p.cap);
      if (cap == null) return { ok: true, violations: [], summary: '上限未設定' };
      const over = acquired(ctx.players).filter((pl) => pl.join_fee > cap);
      return {
        ok: over.length === 0,
        violations: over.map((pl) => `${pl.name}（€${pl.join_fee.toLocaleString('ja-JP')}）`),
        summary: `上限 €${cap.toLocaleString('ja-JP')}`,
      };
    },
  },
  {
    key: 'wage_cap',
    label: '給与上限',
    description: '契約・契約延長時の給与の最大額を決めます。これより高い給与の選手がいると違反です。',
    isAuto: true,
    params: [{ key: 'cap', label: '給与上限 (€)', kind: 'number', placeholder: '例：200000' }],
    examples: ['給与は20万€まで'],
    evaluate: (p, ctx) => {
      const cap = num(p.cap);
      if (cap == null) return { ok: true, violations: [], summary: '上限未設定' };
      const over = onRoster(ctx.players).filter((pl) => pl.join_wage > cap);
      return {
        ok: over.length === 0,
        violations: over.map((pl) => `${pl.name}（€${pl.join_wage.toLocaleString('ja-JP')}）`),
        summary: `上限 €${cap.toLocaleString('ja-JP')}`,
      };
    },
  },
  {
    key: 'attribute_restriction',
    label: '能力値制限',
    description: 'チームのアイデンティティに沿った獲得条件を設定します。対象ポジション・加入時OVR/能力値の下限/上限・身長・「OVR+α」のような相対条件・例外人数を指定できます。',
    isAuto: true,
    partialNote: '加入時スナップショット（OVR・6能力値・身長）に対して判定します。',
    params: [
      { key: 'positions', label: '対象ポジション（空=全員）', kind: 'text', placeholder: '例：CB, ST' },
      { key: 'minHeight', label: '身長の下限(cm)', kind: 'number', placeholder: '例：190' },
      { key: 'minPace', label: 'ペースの下限', kind: 'number', placeholder: '例：70' },
      { key: 'minPhysical', label: 'フィジカルの下限', kind: 'number' },
      { key: 'physMinusOvr', label: '「フィジカル − OVR」の下限', kind: 'number', placeholder: '例：5（OVR+5以上）', help: '加入時フィジカルが加入時OVR＋この値以上であること' },
      { key: 'maxOvr', label: '加入時OVRの上限', kind: 'number', placeholder: '例：75' },
      { key: 'exceptions', label: '認める例外人数', kind: 'number', placeholder: '例：2' },
    ],
    examples: [
      '獲得時フィジカルがOVR+5以上',
      'CBは身長190cm以上かつペース70以上',
      '加入時OVRは75以下（例外2人まで）',
    ],
    evaluate: (p, ctx) => {
      const positions = splitList(p.positions).map((s) => s.toUpperCase());
      const minHeight = num(p.minHeight);
      const minPace = num(p.minPace);
      const minPhysical = num(p.minPhysical);
      const physMinusOvr = num(p.physMinusOvr);
      const maxOvr = num(p.maxOvr);
      const exceptions = num(p.exceptions) ?? 0;

      const targets = acquired(ctx.players).filter(
        (pl) => positions.length === 0 || positions.includes(pl.position),
      );
      const bad: string[] = [];
      for (const pl of targets) {
        const reasons: string[] = [];
        if (minHeight != null && pl.height_cm < minHeight) reasons.push(`身長${pl.height_cm}`);
        if (minPace != null && pl.join_pace < minPace) reasons.push(`ペース${pl.join_pace}`);
        if (minPhysical != null && pl.join_physical < minPhysical) reasons.push(`フィジカル${pl.join_physical}`);
        if (physMinusOvr != null && pl.join_physical - pl.join_ovr < physMinusOvr) reasons.push(`フィジ-OVR=${pl.join_physical - pl.join_ovr}`);
        if (maxOvr != null && pl.join_ovr > maxOvr) reasons.push(`OVR${pl.join_ovr}`);
        if (reasons.length) bad.push(`${pl.name}（${reasons.join('・')}）`);
      }
      const overflow = Math.max(0, bad.length - exceptions);
      const cond = [
        positions.length ? `対象:${positions.join('/')}` : '対象:全獲得',
        minHeight != null ? `身長≥${minHeight}` : '',
        minPace != null ? `ペース≥${minPace}` : '',
        minPhysical != null ? `フィジ≥${minPhysical}` : '',
        physMinusOvr != null ? `フィジ≥OVR+${physMinusOvr}` : '',
        maxOvr != null ? `OVR≤${maxOvr}` : '',
        exceptions ? `例外${exceptions}人` : '',
      ].filter(Boolean).join(' / ');
      return {
        ok: overflow === 0,
        violations: bad,
        summary: cond || '条件未設定',
      };
    },
  },
  {
    key: 'nationality_rule',
    label: '国籍縛り',
    description: 'チームの思想を反映する国籍ルール。チーム全体の最低人数、国籍別の上限、在籍国数の下限を自動判定します（スタメン条件は試合データが無いため自由記入で管理）。',
    isAuto: true,
    partialNote: 'スタメン人数の条件は自動判定できないため、自由記入欄に記録してください。',
    params: [
      { key: 'requireNat', label: '必須国籍', kind: 'text', placeholder: '例：ドイツ' },
      { key: 'requireMin', label: '↑の最低人数（チーム全体）', kind: 'number', placeholder: '例：7' },
      { key: 'capNat', label: '上限を設ける国籍', kind: 'text', placeholder: '例：フランス' },
      { key: 'capMax', label: '↑の最大人数', kind: 'number', placeholder: '例：1' },
      { key: 'minCountries', label: '在籍国数の下限', kind: 'number', placeholder: '例：7' },
    ],
    examples: ['チームに最低7人がドイツ人', 'フランス人は1人まで', '7カ国以上が在籍'],
    evaluate: (p, ctx) => {
      const roster = onRoster(ctx.players);
      const v: string[] = [];
      const requireNat = str(p.requireNat).trim();
      const requireMin = num(p.requireMin);
      if (requireNat && requireMin != null) {
        const c = roster.filter((pl) => pl.nationality === requireNat).length;
        if (c < requireMin) v.push(`${requireNat}が${c}人（最低${requireMin}）`);
      }
      const capNat = str(p.capNat).trim();
      const capMax = num(p.capMax);
      if (capNat && capMax != null) {
        const c = roster.filter((pl) => pl.nationality === capNat).length;
        if (c > capMax) v.push(`${capNat}が${c}人（上限${capMax}）`);
      }
      const minCountries = num(p.minCountries);
      if (minCountries != null) {
        const countries = new Set(roster.map((pl) => pl.nationality).filter(Boolean)).size;
        if (countries < minCountries) v.push(`在籍国数${countries}（最低${minCountries}）`);
      }
      const cond = [
        requireNat && requireMin != null ? `${requireNat}≥${requireMin}` : '',
        capNat && capMax != null ? `${capNat}≤${capMax}` : '',
        minCountries != null ? `国数≥${minCountries}` : '',
      ].filter(Boolean).join(' / ');
      return { ok: v.length === 0, violations: v, summary: cond || '条件未設定' };
    },
  },

  // ============================================================
  // 手動チェック（例を再現できるよう入力欄を用意）
  // ============================================================
  manual('sale_rule', '売却規定',
    '高額オファーや特定チーム/リーグからのオファーで強制売却、などの規定。',
    [
      { key: 'minOffer', label: '強制売却となるオファー額 (€)', kind: 'number', placeholder: '例：50000000' },
      { key: 'clubs', label: '強制売却の対象クラブ', kind: 'text', placeholder: '例：バイエルン, レアル' },
      { key: 'leagues', label: '強制売却の対象リーグ', kind: 'text', placeholder: '例：プレミア, ラ・リーガ' },
    ],
    ['5000万€以上のオファーは売却', 'ビッグクラブ・5大リーグからは強制売却']),
  manual('loan_limit', 'レンタル可能人数',
    '放出レンタルの人数制限。',
    [
      { key: 'perSeason', label: '1シーズンに出せる人数', kind: 'number', placeholder: '例：2' },
      { key: 'concurrent', label: '同時にレンタル中にできる人数', kind: 'number', placeholder: '例：3' },
    ],
    ['1シーズンにレンタル2人まで', '同時レンタルは3人まで']),
  manual('no_play_matches', '試合操作禁止',
    '観戦モード・シミュレートのみで試合を進める。',
    [{ key: 'mode', label: 'モード', kind: 'text', placeholder: '例：観戦のみ / シミュレートのみ' }],
    ['観戦モードのみ', 'シミュレートのみ']),
  manual('academy_only', 'ユースアカデミー限定',
    '補強はアカデミー育成のみ。アカデミー以外の獲得を禁止。', [],
    ['補強はアカデミー以外禁止']),
  manual('youth_quota', 'ユース枠',
    'ユース出身選手の起用人数の縛り。',
    [
      { key: 'starters', label: 'スタメンに必要なユース人数', kind: 'number', placeholder: '例：2' },
      { key: 'squad', label: 'ベンチ込みで必要なユース人数', kind: 'number', placeholder: '例：4' },
    ],
    ['スタメンに2人以上ユース', 'ベンチ・スタメンに4人以上ユース']),
  manual('youth_scout_skill', 'ユーススカウトの能力縛り',
    'スカウトの能力ランクの上限など。昇格で緩和、も記録可能。',
    [
      { key: 'experience', label: '経験の上限（☆）', kind: 'number', placeholder: '例：1' },
      { key: 'judgement', label: '判断の上限（☆）', kind: 'number', placeholder: '例：2' },
      { key: 'promoBonus', label: 'リーグ昇格時の緩和（☆＋）', kind: 'number', placeholder: '例：1' },
    ],
    ['経験☆1・判断☆2まで', 'リーグ昇格で☆+1']),
  manual('fixed_formation', 'フォーメーション固定',
    '使用フォーメーション/システムを固定。',
    [{ key: 'formation', label: 'フォーメーション/条件', kind: 'text', placeholder: '例：3バックのみ / 2トップのみ' }],
    ['3バックのみ', '2トップのみ']),
  manual('fixed_tactics', '戦術志向固定',
    '戦術の志向を固定/禁止。',
    [{ key: 'tactics', label: '戦術条件', kind: 'text', placeholder: '例：カスタムのみ / ポゼッション禁止' }],
    ['カスタムのみ', 'ポゼッション禁止']),
  manual('rivalry', 'ライバル関係',
    'ライバルチームを設定（複数可）。敗北・順位下回りで強制放出/売却などの罰則を記録。',
    [
      { key: 'rivals', label: 'ライバルチーム（複数可）', kind: 'text', placeholder: '例：シャルケ, ドルトムント' },
      { key: 'onLoss', label: '敗北時の罰則', kind: 'text', placeholder: '例：高POTユースを強制放出' },
      { key: 'onBelow', label: '順位で下回った時の罰則', kind: 'text', placeholder: '例：市場価値最高選手を強制売却' },
    ],
    ['ライバルに負けたら高POTユースを放出', '順位で下回ったら市場価値最高選手を売却']),
  manual('forbidden_transfer', '禁断の移籍',
    '設定したライバルとの選手取引を禁止。',
    [{ key: 'clubs', label: '取引禁止クラブ', kind: 'text', placeholder: '例：ライバル設定のクラブ' }],
    ['ライバルとの交渉禁止']),
  manual('scout_region', 'スカウト対象国',
    'チームの思想に沿った地域にのみスカウト可。対象/禁止を記録。',
    [
      { key: 'allow', label: 'スカウト可の地域/国', kind: 'text', placeholder: '例：国内のみ / 南米' },
      { key: 'forbid', label: 'スカウト禁止の地域/国', kind: 'text', placeholder: '例：W杯優勝国' },
    ],
    ['国内のみ', 'W杯優勝国へのスカウト禁止']),
  manual('recruitment_route', '獲得ルート制限',
    '獲得の手段/経路を制限。',
    [{ key: 'rule', label: '制限内容', kind: 'text', placeholder: '例：5大リーグからの直接補強禁止 / フリーのみ' }],
    ['5大リーグからの直接補強禁止', 'フリー移籍のみ']),
];

function manual(
  key: BuiltinConstraintKey, label: string, description: string,
  params: ParamField[] = [], examples: string[] = [],
): ConstraintTemplate {
  return { key, label, description, isAuto: false, params, examples };
}

const TEMPLATE_MAP = new Map(TEMPLATES.map((t) => [t.key, t]));

export function getBuiltinTemplate(key: string): ConstraintTemplate | undefined {
  return TEMPLATE_MAP.get(key as BuiltinConstraintKey);
}
