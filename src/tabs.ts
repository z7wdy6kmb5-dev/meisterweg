// タブ定義（指示書 4.5.1）。
// phase = その機能を実装する段階。段階1では dashboard 以外はプレースホルダ。
export type TabKey =
  | 'dashboard' | 'records' | 'players' | 'stats'
  | 'transfers' | 'memo' | 'constraints' | 'export';

export interface TabDef {
  key: TabKey;
  label: string;
  phase: number;
}

export const TABS: TabDef[] = [
  { key: 'dashboard',   label: 'ダッシュボード',   phase: 1 },
  { key: 'records',     label: 'チーム成績',       phase: 5 },
  { key: 'players',     label: '選手',             phase: 2 },
  { key: 'stats',       label: 'シーズンスタッツ', phase: 3 },
  { key: 'transfers',   label: '移籍',             phase: 4 },
  { key: 'memo',        label: 'メモ',             phase: 5 },
  { key: 'constraints', label: '縛り',             phase: 6 },
  { key: 'export',      label: 'エクスポート',     phase: 7 },
];
