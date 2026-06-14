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
  /** 専用エディタを使うテンプレート（能力値制限・国籍縛り） */
  customEditor?: 'attribute' | 'nationality';
  /** 自動判定では一部条件のみ扱える場合の注記 */
  partialNote?: string;
  params: ParamField[];
  examples?: string[];
  evaluate?: (params: Record<string, unknown>, ctx: ConstraintContext) => ViolationResult;
}

// ---- 能力値制限：判定対象にできる項目（6能力値＋OVR・身長・フィジ−OVR） ----
export type AttrKey =
  | 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical'
  | 'ovr' | 'height' | 'physMinusOvr';

export const ATTR_LABEL: Record<AttrKey, string> = {
  pace: 'ペース', shooting: 'シュート', passing: 'パス', dribbling: 'ドリブル',
  defending: '守備', physical: 'フィジカル', ovr: 'OVR', height: '身長',
  physMinusOvr: 'フィジカル−OVR',
};
// GK のときは6能力値のラベルを差し替え（表示用）
export const ATTR_LABEL_GK: Partial<Record<AttrKey, string>> = {
  pace: 'ダイビング', shooting: 'ハンドリング', passing: 'キック',
  dribbling: '反射神経', defending: 'スピード', physical: 'ポジショニング',
};
export const ATTR_KEYS: AttrKey[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'ovr', 'height', 'physMinusOvr'];

export interface AttrCond { attr: AttrKey; min: number | null; max: number | null; }
export interface AttrGroup { positions: string[]; conds: AttrCond[]; }
export interface NatRule { nat: string; min: number | null; max: number | null; }

function attrValue(pl: Player, attr: AttrKey): number | null {
  switch (attr) {
    case 'pace': return pl.join_pace;
    case 'shooting': return pl.join_shooting;
    case 'passing': return pl.join_passing;
    case 'dribbling': return pl.join_dribbling;
    case 'defending': return pl.join_defending;
    case 'physical': return pl.join_physical;
    case 'ovr': return pl.join_ovr;
    case 'height': return pl.height_cm;
    case 'physMinusOvr': return pl.join_physical - pl.join_ovr;
  }
}

function readGroups(v: unknown): AttrGroup[] {
  return Array.isArray(v) ? (v as AttrGroup[]) : [];
}
function readNatRules(v: unknown): NatRule[] {
  return Array.isArray(v) ? (v as NatRule[]) : [];
}

const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};

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
    description: 'チームのアイデンティティに沿った獲得条件。ポジションごとに、6能力値・OVR・身長・「OVR+α」の下限/上限を複数指定できます。',
    isAuto: true,
    customEditor: 'attribute',
    params: [],
    partialNote: '加入時スナップショット（OVR・6能力値・身長）に対して判定します。',
    examples: [
      '獲得時フィジカルがOVR+5以上',
      'CBは身長190cm以上かつペース70以上',
      '加入時OVRは75以下（例外2人まで）',
    ],
    evaluate: (p, ctx) => {
      const groups = readGroups(p.groups);
      const exceptions = num(p.exceptions) ?? 0;
      if (groups.length === 0) return { ok: true, violations: [], summary: '条件未設定' };

      const bad: string[] = [];
      for (const pl of acquired(ctx.players)) {
        // この選手に適用されるグループ（対象ポジション一致 or 全員グループ）
        for (const g of groups) {
          const posList = (g.positions ?? []).map((s) => s.toUpperCase());
          if (posList.length > 0 && !posList.includes(pl.position)) continue;
          const reasons: string[] = [];
          for (const cond of g.conds ?? []) {
            const val = attrValue(pl, cond.attr);
            if (val == null) continue;
            if (cond.min != null && val < cond.min) reasons.push(`${ATTR_LABEL[cond.attr]}${val}<${cond.min}`);
            if (cond.max != null && val > cond.max) reasons.push(`${ATTR_LABEL[cond.attr]}${val}>${cond.max}`);
          }
          if (reasons.length) bad.push(`${pl.name}（${reasons.join('・')}）`);
        }
      }
      const overflow = Math.max(0, bad.length - exceptions);
      const summary = groups.map((g) => {
        const pos = (g.positions ?? []).length ? (g.positions ?? []).join('/') : '全員';
        const conds = (g.conds ?? []).map((c) => {
          const lab = ATTR_LABEL[c.attr];
          if (c.min != null && c.max != null) return `${lab}${c.min}〜${c.max}`;
          if (c.min != null) return `${lab}≥${c.min}`;
          if (c.max != null) return `${lab}≤${c.max}`;
          return lab;
        }).join('・');
        return `[${pos}] ${conds}`;
      }).join(' / ') + (exceptions ? ` ／ 例外${exceptions}人` : '');
      return { ok: overflow === 0, violations: bad, summary };
    },
  },
  {
    key: 'nationality_rule',
    label: '国籍縛り',
    description: 'チームの思想を反映する国籍ルール。国籍ごとの最低/最大人数、在籍国数の下限を自動判定します。',
    isAuto: true,
    customEditor: 'nationality',
    params: [],
    partialNote: 'スタメン人数の条件は試合データが無く自動判定できないため、自由記入欄に記録してください。',
    examples: ['チームに最低7人がドイツ人', 'フランス人は1人まで', '7カ国以上が在籍'],
    evaluate: (p, ctx) => {
      const roster = onRoster(ctx.players);
      const rules = readNatRules(p.rules);
      const minCountries = num(p.minCountries);
      const v: string[] = [];
      for (const r of rules) {
        if (!r.nat) continue;
        const c = roster.filter((pl) => pl.nationality === r.nat).length;
        if (r.min != null && c < r.min) v.push(`${r.nat}が${c}人（最低${r.min}）`);
        if (r.max != null && c > r.max) v.push(`${r.nat}が${c}人（上限${r.max}）`);
      }
      if (minCountries != null) {
        const countries = new Set(roster.map((pl) => pl.nationality).filter(Boolean)).size;
        if (countries < minCountries) v.push(`在籍国数${countries}（最低${minCountries}）`);
      }
      const summary = [
        ...rules.filter((r) => r.nat).map((r) => {
          if (r.min != null && r.max != null) return `${r.nat} ${r.min}〜${r.max}人`;
          if (r.min != null) return `${r.nat}≥${r.min}`;
          if (r.max != null) return `${r.nat}≤${r.max}`;
          return r.nat;
        }),
        minCountries != null ? `国数≥${minCountries}` : '',
      ].filter(Boolean).join(' / ');
      return { ok: v.length === 0, violations: v, summary: summary || '条件未設定' };
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
