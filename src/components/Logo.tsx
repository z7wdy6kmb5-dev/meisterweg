// Meisterweg ロゴ。ユーザー提供のロゴ（角張ったアウトライン「M」＋ワードマーク）を
// クリーンな SVG／テキストで再現。stroke="currentColor" のため、テーマやヘッダーの
// 文字色にそのまま追従する。
//
// - MeisterMark: アイコンのみ（角張ったアウトラインM）
// - MeisterWordmark: 文字のみ（Meisterweg）
// - Logo: アイコン＋文字のロックアップ（stacked / row）

export function MeisterMark({ size = 40, className = '', strokeWidth = 5 }: {
  size?: number; className?: string; strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      {/* 外側シルエット（鋭いピーク＋先細りの脚） */}
      <path d="M8 90 L4 12 L17 6 L50 50 L83 6 L96 12 L92 90" />
      {/* 内側のV */}
      <path d="M20 30 L50 60 L80 30" />
      {/* 内側の縦エッジ（脚の内側） */}
      <path d="M20 30 L22 90" />
      <path d="M80 30 L78 90" />
      {/* 内側の縦バー */}
      <path d="M46 58 L35 58 L33 90" />
      <path d="M54 58 L65 58 L67 90" />
    </svg>
  );
}

export function MeisterWordmark({ className = '' }: { className?: string }) {
  return <span className={`mw-wordmark ${className}`}>Meisterweg</span>;
}

// アイコン＋文字。variant でレイアウトを切り替え。
export function Logo({ variant = 'stacked' }: { variant?: 'stacked' | 'row' }) {
  if (variant === 'row') {
    return (
      <span className="mw-logo mw-logo--row">
        <MeisterMark size={34} strokeWidth={6} className="mw-logo__mark" />
        <MeisterWordmark />
      </span>
    );
  }
  return (
    <span className="mw-logo mw-logo--stacked">
      <MeisterMark size={84} strokeWidth={4} className="mw-logo__mark" />
      <MeisterWordmark className="mw-wordmark--lg" />
      <span className="mw-logo__tag">マイスターへの道 — 監督キャリア記録</span>
    </span>
  );
}
