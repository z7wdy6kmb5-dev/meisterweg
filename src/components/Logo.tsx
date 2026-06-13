// Meisterweg ロゴ。ユーザー提供の元画像（黒背景→透過に変換しただけ、形状は不変）を使用。
// public/logo 配下に置き、ルート絶対パスで参照する（Vite の public 配信）。
// アートワークは白なので、明るい面では CSS フィルタ(.mw-img--invert)で反転して視認性を確保。
//
// - MeisterMark:     アイコンのみ
// - MeisterWordmark: 文字のみ
// - Logo:            縦ロックアップ（アイコン＋文字＋タグライン）

const MARK = '/logo/meisterweg_mark.png';
const TEXT = '/logo/meisterweg_text.png';

export function MeisterMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <img src={MARK} alt="" aria-hidden width={size} height={size} className={`mw-img ${className}`} />;
}

export function MeisterWordmark({ height = 26, className = '' }: { height?: number; className?: string }) {
  return <img src={TEXT} alt="Meisterweg" height={height} className={`mw-img ${className}`} />;
}

export function Logo() {
  return (
    <span className="mw-logo mw-logo--stacked">
      <MeisterMark size={92} className="mw-logo__mark" />
      <MeisterWordmark height={42} className="mw-logo__word" />
      <span className="mw-logo__tag">マイスターへの道 — 監督キャリア記録</span>
    </span>
  );
}
