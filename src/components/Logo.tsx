// Meisterweg ロゴ。ユーザー提供の透過PNGをそのまま使用（形・色は無加工）。
//  - meisterweg_full.png : エンブレム＋ワードマーク（白＋赤アクセント）
//  - meisterweg_text.png : 文字のみ
// 白主体のアートワークなので、明るい面では暗いチップ(台座)の上に置いて視認性を確保する。

const FULL = '/logo/meisterweg_full.png';
const TEXT = '/logo/meisterweg_text.png';

// 文字のみロゴ（ヘッダー等で使用）
export function MeisterWordmark({ height = 26, className = '' }: { height?: number; className?: string }) {
  return <img src={TEXT} alt="Meisterweg" height={height} className={`mw-img ${className}`} />;
}

// フルロゴ（エンブレム＋ワードマーク）
export function MeisterFull({ height = 96, className = '' }: { height?: number; className?: string }) {
  return <img src={FULL} alt="Meisterweg" height={height} className={`mw-img ${className}`} />;
}

// 起動画面用ロックアップ
export function Logo() {
  return (
    <span className="mw-logo">
      <span className="mw-logo__chip">
        <MeisterFull height={150} className="mw-logo__full" />
      </span>
      <span className="mw-logo__tag">マイスターへの道 — 監督キャリア記録</span>
    </span>
  );
}
