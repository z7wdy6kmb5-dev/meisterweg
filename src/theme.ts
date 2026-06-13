// ============================================================
// テーマ定義（指示書 4.6）
//
// 方針の変更点:
// - 各テーマは「ベース(light/dark) + ブランド色 + セカンダリ + アクセント」だけを持つ。
// - 背景 / サーフェス / 境界線などの中間色は、ブランド色を淡く混ぜて自動生成する。
//   → テーマを選ぶと「ヘッダーだけでなく画面全体」がそのクラブ色を帯びる。
// - セカンダリ色を UI 各所（アクセントバンド・見出しバー・カード縁）で実際に使う。
//
// 新テーマ追加 = THEMES にブランド/セカンダリ/アクセントを1行足すだけ。
// ============================================================

type Mode = 'light' | 'dark';

export interface ThemeSpec {
  key: string;
  label: string;
  group: 'basic' | 'team';
  mode: Mode;
  /** ブランド色（ヘッダー背景・主要ボタン） */
  brand: string;
  /** ブランド色の上に乗る文字色 */
  brandText: string;
  /** セカンダリ色（アクセントバンド・見出しバー・カード縁） */
  secondary: string;
  /** 操作系アクセント（リンク・フォーカス・主要ボタン）。省略時はブランド色 */
  accent?: string;
}

// ---- 色ユーティリティ（hex 同士を比率で混ぜる） ----
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r: number, g: number, b: number): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** weight = a の割合(0..1)。mix(brand, base, 0.06) = ブランド6%+ベース94%。 */
function mix(a: string, b: string, weight: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(
    ar * weight + br * (1 - weight),
    ag * weight + bg * (1 - weight),
    ab * weight + bb * (1 - weight),
  );
}

// ---- 中間色生成（ベースごとの素地にブランド色を淡く混ぜる） ----
const LIGHT_BASE = {
  bg: '#f2f4f7', surface: '#ffffff', muted: '#e9edf2', border: '#d9dfe5',
  text: '#1b2330', textMuted: '#6a7380', danger: '#d64545',
};
const DARK_BASE = {
  bg: '#0e1217', surface: '#161b22', muted: '#1f262f', border: '#2b323c',
  text: '#e6e9ed', textMuted: '#8c95a1', danger: '#ef6b6b',
};

function buildVars(spec: ThemeSpec): Record<string, string> {
  const base = spec.mode === 'light' ? LIGHT_BASE : DARK_BASE;
  // light は淡め、dark はやや強めに混ぜると色が乗る
  const w = spec.mode === 'light'
    ? { bg: 0.06, surface: 0.02, muted: 0.10, border: 0.14 }
    : { bg: 0.12, surface: 0.10, muted: 0.12, border: 0.18 };

  return {
    '--mw-bg': mix(spec.brand, base.bg, w.bg),
    '--mw-surface': mix(spec.brand, base.surface, w.surface),
    '--mw-surface-muted': mix(spec.brand, base.muted, w.muted),
    '--mw-border': mix(spec.brand, base.border, w.border),
    '--mw-text': base.text,
    '--mw-text-muted': base.textMuted,
    '--mw-primary': spec.brand,
    '--mw-on-primary': spec.brandText,
    '--mw-secondary': spec.secondary,
    '--mw-accent': spec.accent ?? spec.brand,
    '--mw-danger': base.danger,
  };
}

// ---- テーマ一覧 ----
export const THEMES: ThemeSpec[] = [
  // 基本2種
  { key: 'light', label: 'ライト', group: 'basic', mode: 'light',
    brand: '#232c38', brandText: '#ffffff', secondary: '#5b6673', accent: '#2563eb' },
  { key: 'dark', label: 'ダーク', group: 'basic', mode: 'dark',
    brand: '#1b222c', brandText: '#e6e9ed', secondary: '#5b8def', accent: '#5b8def' },

  // チームモチーフ12種（mode は light、accent 省略＝ブランド色）
  { key: 'bayern', label: 'バイエルン・ミュンヘン', group: 'team', mode: 'light',
    brand: '#DC052D', brandText: '#ffffff', secondary: '#0A1F44' },
  { key: 'dortmund', label: 'ボルシア・ドルトムント', group: 'team', mode: 'light',
    brand: '#161616', brandText: '#FDE100', secondary: '#FDE100' },
  { key: 'leverkusen', label: 'レヴァークーゼン', group: 'team', mode: 'light',
    brand: '#E32221', brandText: '#ffffff', secondary: '#161616' },
  { key: 'barcelona', label: 'バルセロナ', group: 'team', mode: 'light',
    brand: '#A50044', brandText: '#ffffff', secondary: '#004D98' },
  { key: 'realmadrid', label: 'レアル・マドリード', group: 'team', mode: 'light',
    brand: '#0A2A5E', brandText: '#ffffff', secondary: '#C8A20B' },
  { key: 'psg', label: 'パリ・サンジェルマン', group: 'team', mode: 'light',
    brand: '#004170', brandText: '#ffffff', secondary: '#DA291C' },
  { key: 'inter', label: 'インテル', group: 'team', mode: 'light',
    brand: '#0068A8', brandText: '#ffffff', secondary: '#111111' },
  { key: 'milan', label: 'ACミラン', group: 'team', mode: 'light',
    brand: '#C8102E', brandText: '#ffffff', secondary: '#111111' },
  { key: 'roma', label: 'ローマ', group: 'team', mode: 'light',
    brand: '#7A1623', brandText: '#ffffff', secondary: '#E0A92E' },
  { key: 'manutd', label: 'マンチェスター・ユナイテッド', group: 'team', mode: 'light',
    brand: '#DA291C', brandText: '#ffffff', secondary: '#111111' },
  { key: 'liverpool', label: 'リヴァプール', group: 'team', mode: 'light',
    brand: '#C8102E', brandText: '#ffffff', secondary: '#00B2A9' },
  { key: 'chelsea', label: 'チェルシー', group: 'team', mode: 'light',
    brand: '#034694', brandText: '#ffffff', secondary: '#5FA8E0' },
];

export const DEFAULT_THEME_KEY = 'light';
const THEME_STORAGE_KEY = 'meisterweg.theme';

/** CSS変数を <html> に適用。data-theme / data-mode も付与する。 */
export function applyTheme(key: string): void {
  const spec = THEMES.find((t) => t.key === key) ?? THEMES[0];
  const root = document.documentElement;
  const vars = buildVars(spec);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = spec.key;
  root.dataset.mode = spec.mode;
}

// テーマ設定は「設定値のみ」なので localStorage 可（指示書 4.6.1）。
export function loadThemeKey(): string {
  return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_KEY;
}
export function saveThemeKey(key: string): void {
  localStorage.setItem(THEME_STORAGE_KEY, key);
}
