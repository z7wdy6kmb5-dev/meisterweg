import type { Player, Transfer, ConstraintTemplateKey } from './types';

// ============================================================
// 縛り（Constraint）テンプレート定義
// 自動判定テンプレートは evaluate() を持ち、選手/移籍データから違反を算出する。
// 手動テンプレートはチェックボックス運用（evaluate なし）。
// ============================================================

export interface ParamField {
  key: string;
  label: string;
  kind: 'number' | 'text';
  placeholder?: string;
}

export interface ViolationResult {
  ok: boolean;            // true = 順守
  violations: string[];   // 違反内容（選手名など）
  summary: string;        // 状態の要約
}

export interface ConstraintContext {
  players: Player[];        // キャリアの全選手
  transfers: Transfer[];    // キャリアの全移籍（退団）記録
}

export interface ConstraintTemplate {
  key: ConstraintTemplateKey;
  label: string;
  description: string;
  isAuto: boolean;
  params: ParamField[];
  evaluate?: (params: Record<string, unknown>, ctx: ConstraintContext) => ViolationResult;
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : Number(v) || d);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

// 加入時の獲得（アカデミー以外）を対象に判定するためのフィルタ。
const acquired = (players: Player[]) => players.filter((p) => !p.is_academy);

export const TEMPLATES: ConstraintTemplate[] = [
  // ---- 自動判定 ----
  {
    key: 'transfer_fee_cap',
    label: '移籍金上限',
    description: '加入時の移籍金が上限を超える選手がいないか判定します。',
    isAuto: true,
    params: [{ key: 'cap', label: '上限額 (€)', kind: 'number', placeholder: '例：50000000' }],
    evaluate: (p, ctx) => {
      const cap = num(p.cap);
      const over = acquired(ctx.players).filter((pl) => pl.join_fee > cap);
      return {
        ok: over.length === 0,
        violations: over.map((pl) => `${pl.name}（€${pl.join_fee.toLocaleString('ja-JP')}）`),
        summary: cap ? `上限 €${cap.toLocaleString('ja-JP')}` : '上限未設定',
      };
    },
  },
  {
    key: 'wage_cap',
    label: '給与上限',
    description: '加入時給与が上限を超える選手がいないか判定します。',
    isAuto: true,
    params: [{ key: 'cap', label: '上限額 (€)', kind: 'number', placeholder: '例：200000' }],
    evaluate: (p, ctx) => {
      const cap = num(p.cap);
      const over = acquired(ctx.players).filter((pl) => pl.join_wage > cap);
      return {
        ok: over.length === 0,
        violations: over.map((pl) => `${pl.name}（€${pl.join_wage.toLocaleString('ja-JP')}）`),
        summary: cap ? `上限 €${cap.toLocaleString('ja-JP')}` : '上限未設定',
      };
    },
  },
  {
    key: 'attribute_restriction',
    label: '能力値制限',
    description: '加入時OVRが上限を超える選手がいないか判定します（即戦力の獲得禁止など）。',
    isAuto: true,
    params: [{ key: 'maxOvr', label: '加入時OVR上限', kind: 'number', placeholder: '例：75' }],
    evaluate: (p, ctx) => {
      const max = num(p.maxOvr);
      const over = acquired(ctx.players).filter((pl) => pl.join_ovr > max);
      return {
        ok: over.length === 0,
        violations: over.map((pl) => `${pl.name}（OVR ${pl.join_ovr}）`),
        summary: max ? `加入時OVR ${max} 以下` : '上限未設定',
      };
    },
  },
  {
    key: 'nationality_rule',
    label: '国籍縛り',
    description: '指定国籍以外の選手を獲得していないか判定します（複数指定はカンマ区切り）。',
    isAuto: true,
    params: [{ key: 'allowed', label: '許可する国籍', kind: 'text', placeholder: '例：ドイツ, オーストリア' }],
    evaluate: (p, ctx) => {
      const allowed = str(p.allowed).split(/[,、]/).map((s) => s.trim()).filter(Boolean);
      if (allowed.length === 0) return { ok: true, violations: [], summary: '国籍未設定' };
      const bad = acquired(ctx.players).filter((pl) => pl.nationality && !allowed.includes(pl.nationality));
      return {
        ok: bad.length === 0,
        violations: bad.map((pl) => `${pl.name}（${pl.nationality}）`),
        summary: `許可：${allowed.join('・')}`,
      };
    },
  },

  // ---- 手動チェック ----
  manual('sale_rule', '売却規定', '主力の売却制限など。データから自動判定せず手動で管理します。'),
  manual('loan_limit', 'レンタル可能人数', 'レンタル中の人数上限を手動で管理します。', [{ key: 'limit', label: '上限人数', kind: 'number' }]),
  manual('no_play_matches', '試合操作禁止', '特定試合の操作禁止などの取り決め。'),
  manual('academy_only', 'ユースアカデミー限定', '獲得はアカデミー育成のみ、といった縛り。'),
  manual('youth_quota', 'ユース枠', '一定数のユース選手起用など。', [{ key: 'count', label: '必要人数', kind: 'number' }]),
  manual('youth_scout_skill', 'ユーススカウトの能力縛り', 'スカウトの能力に関する制限。'),
  manual('fixed_formation', 'フォーメーション固定', '使用フォーメーションを固定。', [{ key: 'formation', label: 'フォーメーション', kind: 'text', placeholder: '例：4-3-3' }]),
  manual('fixed_tactics', '戦術志向固定', '戦術志向を固定。', [{ key: 'tactics', label: '戦術', kind: 'text' }]),
  manual('rivalry', 'ライバル関係', '特定クラブとの関係に関する縛り。', [{ key: 'club', label: '対象クラブ', kind: 'text' }]),
  manual('forbidden_transfer', '禁断の移籍', '特定クラブとの取引禁止など。', [{ key: 'club', label: '対象クラブ', kind: 'text' }]),
  manual('scout_region', 'スカウト対象国', 'スカウト対象地域の制限。', [{ key: 'region', label: '対象地域', kind: 'text' }]),
  manual('recruitment_route', '獲得ルート制限', '獲得手段を制限（フリーのみ等）。'),
];

function manual(
  key: ConstraintTemplateKey, label: string, description: string, params: ParamField[] = [],
): ConstraintTemplate {
  return { key, label, description, isAuto: false, params };
}

export function getTemplate(key: ConstraintTemplateKey): ConstraintTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}
