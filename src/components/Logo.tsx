// Meisterweg ＝ ドイツ語で「マイスター（名匠）への道」。
// クラブのエンブレム風バッジに「頂点（星）へ続く道」を描き、意味（道／頂点）を表現。
export function Logo() {
  return (
    <div className="brand-logo">
      <svg className="brand-logo__emblem" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden>
        {/* バッジ（クレスト風） */}
        <path
          d="M32 4 L55 13 V31 C55 46 45 55 32 60 C19 55 9 46 9 31 V13 Z"
          fill="var(--mw-accent)"
        />
        {/* 頂点へ続く道（台形） */}
        <path d="M26 49 L38 49 L34.5 23 L29.5 23 Z" fill="rgba(255,255,255,0.18)" />
        {/* 道のセンターライン（破線） */}
        <line x1="32" y1="48" x2="32" y2="25" stroke="rgba(255,255,255,0.92)" strokeWidth="2.4" strokeDasharray="3 4" strokeLinecap="round" />
        {/* 頂点の星 */}
        <path
          d="M32 8 L33.41 12.06 L37.71 12.15 L34.28 14.74 L35.53 18.85 L32 16.4 L28.47 18.85 L29.72 14.74 L26.29 12.15 L30.59 12.06 Z"
          fill="#ffffff"
        />
      </svg>
      <div className="brand-logo__text">
        <span className="brand-logo__eyebrow">Football Manager Journal</span>
        <span className="brand-logo__word">MEISTER<b>WEG</b></span>
        <span className="brand-logo__rule" />
        <span className="brand-logo__tag">マイスターへの道 — 監督キャリア記録</span>
      </div>
    </div>
  );
}
