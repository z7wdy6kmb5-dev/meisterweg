// ============================================================
// Meisterweg — データモデル（確定仕様 / 指示書 第2章）
// 全エンティティを段階1で定義。後続段階は新規型を足さず、これを参照する。
// ============================================================

/** 現在のスキーマバージョン。データ構造を変えたら +1 し、migrations に処理を追加する。 */
export const CURRENT_SCHEMA_VERSION = 3;

// ---- enum 系（リテラル union として定義） ----

export type Position =
  | 'GK' | 'CB' | 'RB' | 'LB' | 'CDM' | 'CM' | 'CAM' | 'RW' | 'LW' | 'ST';

export const POSITIONS: Position[] = [
  'GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST',
];

export type JoinType = 'レンタル' | 'フリー' | '移籍金あり' | 'アカデミー';
export const JOIN_TYPES: JoinType[] = ['レンタル', 'フリー', '移籍金あり', 'アカデミー'];

export type PlayerStatus = '在籍' | '退団' | '在籍（復帰）';
export const PLAYER_STATUSES: PlayerStatus[] = ['在籍', '退団', '在籍（復帰）'];

export type TransferWindow = '夏' | '冬';
export type TransferType = '移籍' | 'フリー';

export type CompetitionType = 'リーグ' | '国内カップ' | '大陸間クラブ選手権';
export const COMPETITION_TYPES: CompetitionType[] = ['リーグ', '国内カップ', '大陸間クラブ選手権'];

export type MemoMonth =
  | '7月' | '8月' | '9月' | '10月' | '11月' | '12月'
  | '1月' | '2月' | '3月' | '4月' | '5月' | '6月';

/** シーズンは7月開始。7月〜翌6月の順で並べる。 */
export const MEMO_MONTHS: MemoMonth[] = [
  '7月', '8月', '9月', '10月', '11月', '12月',
  '1月', '2月', '3月', '4月', '5月', '6月',
];

// ---- 2.1 Career（最上位） ----
export interface Career {
  id: string;            // UUID 不変内部ID
  name: string;          // 例「FC26 マンハイム監督キャリア」
  team_name: string;     // 率いるチーム名
  team_code: string;     // 表示コード用略号 例「WM」
  start_season: string;  // 開始シーズン 例「25-26」
  created_at: string;    // ISO datetime
  schema_version: number;
}

// ---- 2.2 Season ----
export interface Season {
  id: string;
  career_id: string;
  label: string;  // 例「25-26」
  order: number;  // 1,2,3…
}

// ---- 2.3 Player（不変の人物マスタ） ----
export interface Player {
  id: string;                 // 不変内部ID。全データ紐付けの基点
  display_code: string;       // 表示コード 例「WM-2526-001」
  career_id: string;
  name: string;
  position: Position;
  nationality: string;        // 国籍縛り判定に使用
  height_cm: number;          // 能力値制限の判定に使用
  join_season_id: string;     // 加入シーズン
  join_type: JoinType;
  is_academy: boolean;        // join_type=アカデミー から自動導出
  is_on_loan: boolean;        // レンタル中フラグ
  current_status: PlayerStatus;

  // 加入時スナップショット（獲得時点の固定値）
  join_fee: number;           // 加入時移籍金（€）
  join_wage: number;          // 加入時給与
  join_ovr: number;           // 加入時OVR（＝初期OVR）
  join_pace: number;
  join_shooting: number;
  join_passing: number;
  join_dribbling: number;
  join_defending: number;
  join_physical: number;
  join_market_value?: number; // 任意
}

// ---- 2.4 SeasonStats（選手×シーズン） ----
export interface SeasonStats {
  id: string;
  player_id: string;
  season_id: string;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
  avg_rating: number | null;
  end_ovr: number | null;     // そのシーズン終了時OVR
  // ovr_change は保存せず、前シーズン end_ovr との差分で算出（表示時計算）
}

// ---- 2.5 Transfer（退団／復帰の記録・履歴） ----
export interface Transfer {
  id: string;
  player_id: string;
  /** 退団=departure / 復帰=return。復帰は移籍タブには出さず、選手履歴のみに表示。 */
  kind: 'departure' | 'return';
  season_id: string;            // 退団／復帰シーズン
  window: TransferWindow;       // 夏 / 冬
  type: TransferType;           // 移籍 / フリー
  fee: number;                  // 移籍金／買い戻し額（€）
  market_value_at_time: number; // 退団／復帰時の市場価値
  destination: string;          // 退団=移籍先 / 復帰=復帰元
  reason: string;
}

// ---- 2.6 TeamRecord（大会×シーズン集計） ----
export interface TeamRecord {
  id: string;
  season_id: string;
  competition_type: CompetitionType;
  competition_name: string;    // 例「ブンデスリーガ」（区分ごとの選択肢から選ぶ）
  final_position: string;      // 順位 or 到達ラウンド
  /** 大陸間クラブ選手権のリーグフェーズ順位（その区分のみ使用） */
  league_phase_position?: string;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  note: string;
}

// ---- 2.7 SeasonMemo（月別） ----
export interface SeasonMemo {
  id: string;
  season_id: string;
  month: MemoMonth;
  body: string;  // リッチテキスト可（段階5で実装）
}

// ---- 2.8 Constraint（縛りルール） ----
export type ConstraintTemplateKey =
  // 自動判定
  | 'transfer_fee_cap'        // 移籍金上限
  | 'wage_cap'                // 給与上限
  | 'attribute_restriction'   // 能力値制限
  | 'nationality_rule'        // 国籍縛り
  // 手動チェック
  | 'sale_rule'               // 売却規定
  | 'loan_limit'              // レンタル可能人数
  | 'no_play_matches'         // 試合操作禁止
  | 'academy_only'            // ユースアカデミー限定
  | 'youth_quota'             // ユース枠
  | 'youth_scout_skill'       // ユーススカウトの能力縛り
  | 'fixed_formation'         // フォーメーション固定
  | 'fixed_tactics'           // 戦術志向固定
  | 'rivalry'                 // ライバル関係
  | 'forbidden_transfer'      // 禁断の移籍
  | 'scout_region'            // スカウト対象国
  | 'recruitment_route';      // 獲得ルート制限

export interface Constraint {
  id: string;
  career_id: string;
  template_key: ConstraintTemplateKey;
  is_auto: boolean;           // 自動判定可能か
  params: Record<string, unknown>; // テンプレごとの設定値
  penalty: string;            // 違反時ペナルティ（任意）
  manual_checked: boolean;    // 手動縛り用チェック状態
  enabled: boolean;
}

// ============================================================
// JSON エクスポート/インポート用のバンドル型（機能7・段階7で使用）
// 段階1から型を確定させ、エクスポート構造の後方互換を担保する。
// ============================================================
export interface MeisterwegBundle {
  schema_version: number;
  exported_at: string;
  career: Career;
  seasons: Season[];
  players: Player[];
  season_stats: SeasonStats[];
  transfers: Transfer[];
  team_records: TeamRecord[];
  season_memos: SeasonMemo[];
  constraints: Constraint[];
}
