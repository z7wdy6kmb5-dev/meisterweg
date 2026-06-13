import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getTransferRows, deleteTransfer } from '../repo';
import { useApp } from '../AppContext';
import { formatMoney } from '../format';

// 移籍（退団記録）一覧。現シーズン or 全シーズンを切り替え。
// 退団記録の作成は選手プロフィールの「退団記録」から行う。
export function TransfersPage() {
  const { currentCareer, currentSeason } = useApp();
  const [scope, setScope] = useState<'season' | 'all'>('season');
  const seasonId = scope === 'all' ? 'all' : currentSeason?.id ?? 'all';

  const rows = useLiveQuery(
    () => (currentCareer ? getTransferRows(currentCareer.id, seasonId) : Promise.resolve([])),
    [currentCareer?.id, seasonId],
    [],
  );

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>移籍</h1>
          <span className="sub">{(rows ?? []).length} 件の退団記録</span>
        </div>
        <select className="btn btn--ghost" value={scope} onChange={(e) => setScope(e.target.value as 'season' | 'all')}>
          <option value="season">現シーズン（{currentSeason?.label ?? '—'}）</option>
          <option value="all">全シーズン</option>
        </select>
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="card card--pad">
          <div className="empty" style={{ padding: '40px 12px' }}>
            <h2>退団記録がありません</h2>
            <p>「選手」タブで選手を開き、「退団記録」から退団（移籍金・移籍先・理由など）を登録すると、ここに履歴が表示されます。</p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>シーズン</th>
                <th>選手</th>
                <th>区分</th>
                <th>種別</th>
                <th className="td-num">移籍金</th>
                <th className="td-num">市場価値</th>
                <th>移籍先</th>
                <th>理由</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map(({ transfer: t, player, seasonLabel }) => (
                <tr key={t.id} style={{ cursor: 'default' }}>
                  <td>{seasonLabel}</td>
                  <td>
                    <div className="td-name">{player.name}</div>
                    <div className="td-code">{player.display_code}</div>
                  </td>
                  <td><span className="pill">{t.window}</span></td>
                  <td><span className="pill">{t.type}</span></td>
                  <td className="td-num">{formatMoney(t.fee)}</td>
                  <td className="td-num">{formatMoney(t.market_value_at_time)}</td>
                  <td>{t.destination || '—'}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 280 }}>{t.reason || '—'}</td>
                  <td className="td-num">
                    <button
                      className="btn btn--ghost"
                      style={{ padding: '6px 10px' }}
                      title="削除"
                      onClick={() => { if (window.confirm('この移籍記録を削除しますか？')) void deleteTransfer(t.id); }}
                    >🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="info-line mt-16">退団記録は選手プロフィールの「退団記録」から作成します。削除しても選手のステータスは自動では戻りません（必要なら選手側で「復帰」操作を）。</p>
    </div>
  );
}
