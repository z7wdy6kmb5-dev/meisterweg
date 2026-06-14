// Meisterweg ロゴ。
// アイコン（M）はユーザー提供画像の「形」をそのまま使用（背景透過＋白シルエット化のみ。形は不変）。
// 白画像なので CSS で着色（明背景では反転して黒）。
// 「Meisterweg」の文字は、元画像の細い線がノイズで潰れて読めないため、くっきりしたテキストで表示。

const MARK = '/logo/meisterweg_mark.png';

export function MeisterMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return <img src={MARK} alt="" aria-hidden width={size} height={size} className={`mw-mark ${className}`} />;
}

export function MeisterWordmark({ className = '' }: { className?: string }) {
  return <span className={`mw-wordmark ${className}`}>Meisterweg</span>;
}

export function Logo() {
  return (
    <span className="mw-logo">
      <MeisterMark size={76} className="mw-logo__mark" />
      <span className="mw-logo__text">
        <MeisterWordmark className="mw-wordmark--lg" />
        <span className="mw-logo__tag">マイスターへの道 — 監督キャリア記録</span>
      </span>
    </span>
  );
}
