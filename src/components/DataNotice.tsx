// データ保存の性質に関する注意書き（指示書 4.8）。
// 設定/エクスポート/起動画面など目に触れる場所に常設する。
export function DataNotice() {
  return (
    <div className="notice">
      <span aria-hidden>💾</span>
      <p>
        <strong>Meisterweg のデータはこの端末のブラウザ内に保存されます</strong>
        （サーバーには保存されません）。他の端末・他のブラウザでは表示されず、
        ブラウザの「サイトデータ削除」を行うと失われる場合があります。
        大切な記録は定期的に JSON でエクスポートしてバックアップしてください。
      </p>
    </div>
  );
}
