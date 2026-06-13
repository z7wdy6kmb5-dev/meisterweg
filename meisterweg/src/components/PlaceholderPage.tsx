// 未実装タブのプレースホルダ。実装予定の段階を明示する。
export function PlaceholderPage({ label, phase }: { label: string; phase: number }) {
  return (
    <div className="placeholder-page">
      <span className="badge">段階 {phase} で実装予定</span>
      <h2>{label}</h2>
      <p>
        この画面は今後の段階で実装します。各段階の完了時に動作確認をお願いします。
      </p>
    </div>
  );
}
