// Meisterweg ロゴ。ユーザー提供の金×黒エンブレム（王冠＋サッカーボール＋道）を使用。
// 背景の暗緑だけを透過にし、金・黒の作品色はそのまま保持（形・色は不変）。
// 黒い内側を持つ作品のため、暗いチップ（台座）の上に置いてどのテーマでも視認できるようにする。
// 「Meisterweg」の文字は元画像の黒文字が背景同化で抜けてしまうため、金色テキストで表示。

const MARK = '/logo/meisterweg_mark.png';

export function MeisterMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  // 縦長エンブレム（約 0.68:1）。高さ基準で表示。
  return <img src={MARK} alt="" aria-hidden height={size} className={`mw-mark ${className}`} />;
}

export function MeisterWordmark({ className = '' }: { className?: string }) {
  return <span className={`mw-wordmark ${className}`}>Meisterweg</span>;
}

export function Logo() {
  return (
    <span className="mw-logo">
      <span className="mw-logo__chip">
        <MeisterMark size={96} className="mw-logo__mark" />
      </span>
      <span className="mw-logo__text">
        <MeisterWordmark className="mw-wordmark--lg" />
        <span className="mw-logo__tag">マイスターへの道 — 監督キャリア記録</span>
      </span>
    </span>
  );
}
