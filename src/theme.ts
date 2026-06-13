// ============================================================
// テーマ定義（指示書 4.6）
//
// ヘッダーは柄なしの単色（brand）＋下端のサブ色バンド＋第3色の副題（=2〜3色）。
// 各クラブの象徴的なユニフォーム柄は「ボディ背景」に薄く透過させて敷く。
//   brand      … ホーム色（ヘッダー背景・主要ボタン）
//   brandText  … ヘッダー上の文字色
//   secondary  … ロゴ由来サブ色（下端バンド）
//   tertiary   … 第3色（副題など）
//   accent     … 操作系アクセント（省略時 brand）
//   kit        … ボディ背景に敷くユニフォーム柄（薄い透過で表現）
// 背景の素地色は brand を淡く混ぜて全面に広げる。
// ============================================================

type Mode = 'light' | 'dark';

// ユニフォーム柄（ボディ背景に薄く敷く）
type Kit =
  | { kind: 'plain' }
  | { kind: 'stripesV'; a: string; b: string; w?: number }       // 縦縞（バルサ/ミラン/インテル）
  | { kind: 'pinstripeV'; c: string; gap?: number }              // 細い縦ピンストライプ
  | { kind: 'diagonal'; c: string; w?: number; gap?: number }    // 斜めストライプ（レヴァークーゼン/ローマ）
  | { kind: 'diamond'; c: string; size?: number }                // 菱形（バイエルンのバイエルン菱）
  | { kind: 'hoopsH'; c: string; w?: number; gap?: number }      // 横ボーダー
  | { kind: 'grid'; c: string; size?: number }                   // 格子（マンU）
  | { kind: 'hechter'; band: string; edge: string };             // 中央縦帯（PSG）

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
  kit?: Kit;
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
function rgba(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ---- ボディ背景の柄を生成（薄い透過。{image,size,repeat}） ----
function kitBackground(kit: Kit | undefined): { image: string; size: string; repeat: string } {
  if (!kit || kit.kind === 'plain') return { image: 'none', size: 'auto', repeat: 'repeat' };
  switch (kit.kind) {
    case 'stripesV': {
      const w = kit.w ?? 46;
      return {
        image: `repeating-linear-gradient(90deg, ${rgba(kit.a, 0.10)} 0 ${w}px, ${rgba(kit.b, 0.08)} ${w}px ${w * 2}px)`,
        size: 'auto', repeat: 'repeat',
      };
    }
    case 'pinstripeV': {
      const gap = kit.gap ?? 20;
      return {
        image: `repeating-linear-gradient(90deg, ${rgba(kit.c, 0.10)} 0 2px, transparent 2px ${gap}px)`,
        size: 'auto', repeat: 'repeat',
      };
    }
    case 'diagonal': {
      const w = kit.w ?? 16;
      const gap = kit.gap ?? 46;
      return {
        image: `repeating-linear-gradient(135deg, ${rgba(kit.c, 0.09)} 0 ${w}px, transparent ${w}px ${gap}px)`,
        size: 'auto', repeat: 'repeat',
      };
    }
    case 'diamond': {
      const s = kit.size ?? 26;
      return {
        image: `repeating-linear-gradient(45deg, ${rgba(kit.c, 0.08)} 0 2px, transparent 2px ${s}px), repeating-linear-gradient(-45deg, ${rgba(kit.c, 0.08)} 0 2px, transparent 2px ${s}px)`,
        size: 'auto', repeat: 'repeat',
      };
    }
    case 'hoopsH': {
      const w = kit.w ?? 16;
      const gap = kit.gap ?? 48;
      return {
        image: `repeating-linear-gradient(0deg, ${rgba(kit.c, 0.08)} 0 ${w}px, transparent ${w}px ${gap}px)`,
        size: 'auto', repeat: 'repeat',
      };
    }
    case 'grid': {
      const s = kit.size ?? 28;
      return {
        image: `repeating-linear-gradient(0deg, ${rgba(kit.c, 0.07)} 0 1px, transparent 1px ${s}px), repeating-linear-gradient(90deg, ${rgba(kit.c, 0.07)} 0 1px, transparent 1px ${s}px)`,
        size: 'auto', repeat: 'repeat',
      };
    }
    case 'hechter':
      // 中央に1本の縦帯（白縁つき）。ビューポートに固定して中央に出す。
      return {
        image: `linear-gradient(90deg, transparent 0 42%, ${rgba(kit.edge, 0.22)} 42% 43%, ${rgba(kit.band, 0.12)} 43% 57%, ${rgba(kit.edge, 0.22)} 57% 58%, transparent 58%)`,
        size: '100% 100%', repeat: 'no-repeat',
      };
  }
}

// ---- 中間色生成 ----
const LIGHT_BASE = { bg: '#f2f4f7', surface: '#ffffff', muted: '#e9edf2', border: '#d9dfe5', text: '#1b2330', textMuted: '#6a7380', danger: '#d64545' };
const DARK_BASE = { bg: '#0e1217', surface: '#161b22', muted: '#1f262f', border: '#2b323c', text: '#e6e9ed', textMuted: '#8c95a1', danger: '#ef6b6b' };

function buildVars(spec: ThemeSpec): Record<string, string> {
  const base = spec.mode === 'light' ? LIGHT_BASE : DARK_BASE;
  const w = spec.mode === 'light'
    ? { bg: 0.07, surface: 0.02, muted: 0.12, border: 0.15 }
    : { bg: 0.12, surface: 0.10, muted: 0.13, border: 0.18 };

  const headerIsLight = luminance(spec.brandText) < 0.5;
  const ctrl = headerIsLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.15)';
  const ctrlHover = headerIsLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.28)';
  const ctrlBorder = headerIsLight ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.28)';

  const kit = kitBackground(spec.kit);

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
    '--mw-header-ctrl': ctrl,
    '--mw-header-ctrl-hover': ctrlHover,
    '--mw-header-ctrl-border': ctrlBorder,
    '--mw-body-pattern': kit.image,
    '--mw-body-size': kit.size,
    '--mw-body-repeat': kit.repeat,
  };
}

// ---- テーマ一覧（各クラブの象徴的な柄をボディ背景に） ----
export const THEMES: ThemeSpec[] = [
  { key: 'light', label: 'ライト', group: 'basic', mode: 'light',
    brand: '#232c38', brandText: '#ffffff', secondary: '#5b6673', tertiary: '#8a94a0', accent: '#2563eb' },
  { key: 'dark', label: 'ダーク', group: 'basic', mode: 'dark',
    brand: '#1b222c', brandText: '#e6e9ed', secondary: '#5b8def', tertiary: '#8c95a1', accent: '#5b8def' },

  // バイエルン：赤×紺。バイエルン菱（ダイヤ）柄を紺で。
  { key: 'bayern', label: 'バイエルン・ミュンヘン', group: 'team', mode: 'light',
    brand: '#DC052D', brandText: '#ffffff', secondary: '#0C1F4A', tertiary: '#2AA7E0', accent: '#DC052D',
    kit: { kind: 'diamond', c: '#0C1F4A', size: 30 } },
  // ドルトムント：黄×黒。横ボーダー柄を黒で。
  { key: 'dortmund', label: 'ボルシア・ドルトムント', group: 'team', mode: 'light',
    brand: '#FDE100', brandText: '#141414', secondary: '#141414', tertiary: '#6e5b00', accent: '#141414',
    kit: { kind: 'hoopsH', c: '#141414', w: 16, gap: 52 } },
  // レヴァークーゼン：赤×黒。斜めストライプ。
  { key: 'leverkusen', label: 'レヴァークーゼン', group: 'team', mode: 'light',
    brand: '#E32221', brandText: '#ffffff', secondary: '#141414', tertiary: '#9aa0a6', accent: '#E32221',
    kit: { kind: 'diagonal', c: '#141414', w: 18, gap: 54 } },
  // バルセロナ：ブラウグラナ縦縞（ガーネット×ブルー）。
  { key: 'barcelona', label: 'バルセロナ', group: 'team', mode: 'light',
    brand: '#A50044', brandText: '#ffffff', secondary: '#004D98', tertiary: '#EDBB00', accent: '#004D98',
    kit: { kind: 'stripesV', a: '#A50044', b: '#004D98', w: 40 } },
  // レアル：白基調。ゴールドの細ピンストライプ。
  { key: 'realmadrid', label: 'レアル・マドリード', group: 'team', mode: 'light',
    brand: '#F4F5F7', brandText: '#0A2A5E', secondary: '#C8A20B', tertiary: '#4B2E83', accent: '#0A2A5E',
    kit: { kind: 'pinstripeV', c: '#C8A20B', gap: 22 } },
  // PSG：紺地に赤の中央縦帯（白縁）。
  { key: 'psg', label: 'パリ・サンジェルマン', group: 'team', mode: 'light',
    brand: '#0A1E3C', brandText: '#ffffff', secondary: '#DA291C', tertiary: '#6FA8DC', accent: '#DA291C',
    kit: { kind: 'hechter', band: '#DA291C', edge: '#0A1E3C' } },
  // インテル：青×黒の縦縞。
  { key: 'inter', label: 'インテル', group: 'team', mode: 'light',
    brand: '#0A2A6B', brandText: '#ffffff', secondary: '#111111', tertiary: '#C9A227', accent: '#C9A227',
    kit: { kind: 'stripesV', a: '#0A2A6B', b: '#111111', w: 38 } },
  // ミラン：赤×黒の縦縞。
  { key: 'milan', label: 'ACミラン', group: 'team', mode: 'light',
    brand: '#C8102E', brandText: '#ffffff', secondary: '#111111', tertiary: '#D4A437', accent: '#C8102E',
    kit: { kind: 'stripesV', a: '#C8102E', b: '#111111', w: 38 } },
  // ローマ：マルーン×ゴールド。斜めストライプをゴールドで。
  { key: 'roma', label: 'ローマ', group: 'team', mode: 'light',
    brand: '#8E1F2F', brandText: '#ffffff', secondary: '#F0BC42', tertiary: '#E0701A', accent: '#F0BC42',
    kit: { kind: 'diagonal', c: '#F0BC42', w: 14, gap: 50 } },
  // マンU：赤×黒×黄。格子（ギンガム）柄を黒で。
  { key: 'manutd', label: 'マンチェスター・ユナイテッド', group: 'team', mode: 'light',
    brand: '#DA291C', brandText: '#ffffff', secondary: '#111111', tertiary: '#FBE122', accent: '#FBE122',
    kit: { kind: 'grid', c: '#111111', size: 30 } },
  // リヴァプール：赤。白の細ピンストライプ（往年のピンストライプ）。
  { key: 'liverpool', label: 'リヴァプール', group: 'team', mode: 'light',
    brand: '#C8102E', brandText: '#ffffff', secondary: '#F6EB61', tertiary: '#00B2A9', accent: '#00B2A9',
    kit: { kind: 'pinstripeV', c: '#7A0A18', gap: 18 } },
  // チェルシー：青。細ピンストライプを青で。
  { key: 'chelsea', label: 'チェルシー', group: 'team', mode: 'light',
    brand: '#034694', brandText: '#ffffff', secondary: '#DBA111', tertiary: '#ED1C24', accent: '#DBA111',
    kit: { kind: 'pinstripeV', c: '#034694', gap: 20 } },
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
