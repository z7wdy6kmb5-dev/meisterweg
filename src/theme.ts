// ============================================================
// テーマ定義（指示書 4.6）
//
// 各テーマは複数のクラブカラーを持ち、画面全体に大胆に効かせる:
//   brand      … ホーム色（ヘッダー主背景・主要ボタン）
//   brandText  … ヘッダー上の文字色
//   secondary  … ロゴ由来のサブ色（下端アクセントバンド）
//   tertiary   … 第3色（ブランド見出しの副題など）
//   accent     … 操作系アクセント（リンク・フォーカス）。省略時は brand
//   pattern    … ユニフォーム由来の模様（縦縞 / 斜めサッシュ / 中央帯）。任意
// 背景・サーフェス・境界線は brand を淡く混ぜて自動生成し、テーマ色を全面に広げる。
// ============================================================

type Mode = 'light' | 'dark';

type Pattern =
  | { kind: 'stripes'; a: string; b: string; w?: number }   // 縦縞（ミラン/インテル/バルサ等）
  | { kind: 'sash'; base: string; stripe: string }          // 斜めサッシュ（レヴァークーゼン）
  | { kind: 'hechter'; base: string; band: string; edge: string }; // 中央縦帯（PSG）

export interface ThemeSpec {
  key: string;
  label: string;
  group: 'basic' | 'team';
  mode: Mode;
  brand: string;
  brandText: string;
  secondary: string;
  tertiary?: string;
  accent?: string;
  pattern?: Pattern;
}

// ---- 色ユーティリティ ----
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
function mix(a: string, b: string, weight: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(ar * weight + br * (1 - weight), ag * weight + bg * (1 - weight), ab * weight + bb * (1 - weight));
}
/** 相対輝度（0..1）。文字色が暗いか＝ヘッダーが明るいかの判定に使う。 */
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---- ヘッダー背景（パターン or 単色） ----
function headerBg(s: ThemeSpec): string {
  const p = s.pattern;
  if (!p) return s.brand;
  if (p.kind === 'stripes') {
    const w = p.w ?? 26;
    return `repeating-linear-gradient(90deg, ${p.a} 0 ${w}px, ${p.b} ${w}px ${w * 2}px)`;
  }
  if (p.kind === 'sash') {
    return `linear-gradient(122deg, ${p.base} 0 43%, ${p.stripe} 43% 57%, ${p.base} 57% 100%)`;
  }
  return `linear-gradient(90deg, ${p.base} 0 39%, ${p.edge} 39% 41%, ${p.band} 41% 59%, ${p.edge} 59% 61%, ${p.base} 61% 100%)`;
}

// ---- 中間色生成 ----
const LIGHT_BASE = { bg: '#f2f4f7', surface: '#ffffff', muted: '#e9edf2', border: '#d9dfe5', text: '#1b2330', textMuted: '#6a7380', danger: '#d64545' };
const DARK_BASE = { bg: '#0e1217', surface: '#161b22', muted: '#1f262f', border: '#2b323c', text: '#e6e9ed', textMuted: '#8c95a1', danger: '#ef6b6b' };

function buildVars(spec: ThemeSpec): Record<string, string> {
  const base = spec.mode === 'light' ? LIGHT_BASE : DARK_BASE;
  // チームテーマは色を強めに乗せて画面全体を大胆に。
  const w = spec.mode === 'light'
    ? { bg: 0.085, surface: 0.02, muted: 0.13, border: 0.16 }
    : { bg: 0.14, surface: 0.10, muted: 0.13, border: 0.18 };

  // 明るいヘッダー（白/黄）では半透明白のコントロールが見えないので、暗い半透明に切替。
  const headerIsLight = luminance(spec.brandText) < 0.5;
  const ctrl = headerIsLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.15)';
  const ctrlHover = headerIsLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.28)';
  const ctrlBorder = headerIsLight ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.28)';

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
    '--mw-tertiary': spec.tertiary ?? spec.secondary,
    '--mw-accent': spec.accent ?? spec.brand,
    '--mw-danger': base.danger,
    '--mw-header-bg': headerBg(spec),
    '--mw-header-ctrl': ctrl,
    '--mw-header-ctrl-hover': ctrlHover,
    '--mw-header-ctrl-border': ctrlBorder,
  };
}

// ---- テーマ一覧（各チーム4〜5色・被り回避） ----
export const THEMES: ThemeSpec[] = [
  { key: 'light', label: 'ライト', group: 'basic', mode: 'light',
    brand: '#232c38', brandText: '#ffffff', secondary: '#5b6673', tertiary: '#8a94a0', accent: '#2563eb' },
  { key: 'dark', label: 'ダーク', group: 'basic', mode: 'dark',
    brand: '#1b222c', brandText: '#e6e9ed', secondary: '#5b8def', tertiary: '#8c95a1', accent: '#5b8def' },

  // バイエルン：赤×紺×スカイ（紺バンドで他の赤と区別）
  { key: 'bayern', label: 'バイエルン・ミュンヘン', group: 'team', mode: 'light',
    brand: '#DC052D', brandText: '#ffffff', secondary: '#0C1F4A', tertiary: '#2AA7E0', accent: '#DC052D' },
  // ドルトムント：黄×黒（ホーム黄ヘッダー）
  { key: 'dortmund', label: 'ボルシア・ドルトムント', group: 'team', mode: 'light',
    brand: '#FDE100', brandText: '#141414', secondary: '#141414', tertiary: '#6e5b00', accent: '#141414' },
  // レヴァークーゼン：赤×黒、斜めサッシュで区別
  { key: 'leverkusen', label: 'レヴァークーゼン', group: 'team', mode: 'light',
    brand: '#E32221', brandText: '#ffffff', secondary: '#141414', tertiary: '#9aa0a6', accent: '#E32221',
    pattern: { kind: 'sash', base: '#E32221', stripe: '#141414' } },
  // バルセロナ：ブラウグラナ縦縞（ガーネット×ブルー）＋ゴールド
  { key: 'barcelona', label: 'バルセロナ', group: 'team', mode: 'light',
    brand: '#A50044', brandText: '#ffffff', secondary: '#004D98', tertiary: '#EDBB00', accent: '#004D98',
    pattern: { kind: 'stripes', a: '#A50044', b: '#004D98', w: 30 } },
  // レアル：白ヘッダー×紺文字×ゴールド×パープル
  { key: 'realmadrid', label: 'レアル・マドリード', group: 'team', mode: 'light',
    brand: '#F4F5F7', brandText: '#0A2A5E', secondary: '#C8A20B', tertiary: '#4B2E83', accent: '#0A2A5E' },
  // PSG：紺ベース×赤の中央帯（白縁）
  { key: 'psg', label: 'パリ・サンジェルマン', group: 'team', mode: 'light',
    brand: '#0A1E3C', brandText: '#ffffff', secondary: '#DA291C', tertiary: '#6FA8DC', accent: '#DA291C',
    pattern: { kind: 'hechter', base: '#0A1E3C', band: '#DA291C', edge: '#ffffff' } },
  // インテル：青×黒の縦縞＋ゴールド
  { key: 'inter', label: 'インテル', group: 'team', mode: 'light',
    brand: '#0A2A6B', brandText: '#ffffff', secondary: '#111111', tertiary: '#C9A227', accent: '#C9A227',
    pattern: { kind: 'stripes', a: '#0A2A6B', b: '#111111', w: 28 } },
  // ミラン：赤×黒の縦縞＋ゴールド
  { key: 'milan', label: 'ACミラン', group: 'team', mode: 'light',
    brand: '#C8102E', brandText: '#ffffff', secondary: '#111111', tertiary: '#D4A437', accent: '#C8102E',
    pattern: { kind: 'stripes', a: '#C8102E', b: '#111111', w: 28 } },
  // ローマ：マルーン×ゴールド×オレンジ（単色マルーン）
  { key: 'roma', label: 'ローマ', group: 'team', mode: 'light',
    brand: '#8E1F2F', brandText: '#ffffff', secondary: '#F0BC42', tertiary: '#E0701A', accent: '#F0BC42' },
  // マンU：赤×黒×イエロー（黒バンド＋黄でバイエルン赤と区別）
  { key: 'manutd', label: 'マンチェスター・ユナイテッド', group: 'team', mode: 'light',
    brand: '#DA291C', brandText: '#ffffff', secondary: '#111111', tertiary: '#FBE122', accent: '#FBE122' },
  // リヴァプール：赤×ゴールド×ティール（金バンドで他の赤と区別）
  { key: 'liverpool', label: 'リヴァプール', group: 'team', mode: 'light',
    brand: '#C8102E', brandText: '#ffffff', secondary: '#F6EB61', tertiary: '#00B2A9', accent: '#00B2A9' },
  // チェルシー：青×ゴールド×レッド（クレスト由来）
  { key: 'chelsea', label: 'チェルシー', group: 'team', mode: 'light',
    brand: '#034694', brandText: '#ffffff', secondary: '#DBA111', tertiary: '#ED1C24', accent: '#DBA111' },
];

export const DEFAULT_THEME_KEY = 'light';
const THEME_STORAGE_KEY = 'meisterweg.theme';

export function applyTheme(key: string): void {
  const spec = THEMES.find((t) => t.key === key) ?? THEMES[0];
  const root = document.documentElement;
  const vars = buildVars(spec);
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.theme = spec.key;
  root.dataset.mode = spec.mode;
}

export function loadThemeKey(): string {
  return localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME_KEY;
}
export function saveThemeKey(key: string): void {
  localStorage.setItem(THEME_STORAGE_KEY, key);
}
