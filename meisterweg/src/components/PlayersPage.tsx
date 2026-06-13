import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listPlayers, getPlayerAggregates } from '../repo';
import { useApp } from '../AppContext';
import { PlayerModal } from './PlayerModal';
import { formatMoney, formatNumber } from '../format';
import type { Player } from '../types';

// 選手一覧（キャリア全選手）。行クリックで詳細モーダル。
// 列の表示/非表示は段階3で追加予定。ここでは主要列を固定表示する。
export function PlayersPage() {
  const { currentCareer, seasons } = useApp();
  const players = useLiveQuery(
    () => (currentCareer ? listPlayers(currentCareer.id) : Promise.resolve([])),
    [currentCareer?.id],
    [],
  );
  const [selected, setSelected] = useState<Player | null>(null);
  const [creating, setCreating] = useState(false);

  const seasonLabel = (id: string) => seasons.find((s) => s.id === id)?.label ?? '—';

  // 名前順で安定表示
  const sorted = (players ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>選手</h1>
          <span className="sub">{sorted.length} 名（全シーズン共通の人物マスタ）</span>
        </div>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>＋ 選手を追加</button>
      </div>

      {sorted.length === 0 ? (
        <div className="card card--pad">
          <div className="empty" style={{ padding: '40px 12px' }}>
            <h2>まだ選手がいません</h2>
            <p>「選手を追加」から、加入時のOVRや能力値などを登録できます。登録した選手はシーズンをまたいで同じレコードを使い続けます。</p>
            <button className="btn btn--primary" onClick={() => setCreating(true)}>＋ 最初の選手を追加</button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>コード</th>
                <th>名前</th>
                <th>POS</th>
                <th>国籍</th>
                <th className="td-num">身長</th>
                <th>加入</th>
                <th>種別</th>
                <th className="td-num">初期OVR</th>
                <th className="td-num">現OVR</th>
                <th className="td-num">得点</th>
                <th className="td-num">アシスト</th>
                <th className="td-num">加入金</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} onClick={() => setSelected(p)}>
                  <td className="td-code">{p.display_code}</td>
                  <td className="td-name">{p.name}</td>
                  <td><span className="pill pill--pos">{p.position}</span></td>
                  <td>{p.nationality || '—'}</td>
                  <td className="td-num">{p.height_cm || '—'}</td>
                  <td>{seasonLabel(p.join_season_id)}</td>
                  <td>{p.join_type}{p.is_on_loan ? '・レンタル' : ''}</td>
                  <td className="td-num">{formatNumber(p.join_ovr)}</td>
                  <AggCells playerId={p.id} />
                  <td className="td-num">{formatMoney(p.join_fee)}</td>
                  <td><StatusCell player={p} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(selected || creating) && (
        <PlayerModal
          player={selected}
          onClose={() => { setSelected(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

// 現OVR・総得点・総アシストは算出値（保存しない）。行ごとに再計算して表示。
function AggCells({ playerId }: { playerId: string }) {
  const agg = useLiveQuery(() => getPlayerAggregates(playerId), [playerId]);
  return (
    <>
      <td className="td-num">{agg ? formatNumber(agg.currentOvr) : '…'}</td>
      <td className="td-num">{agg ? formatNumber(agg.goals) : '…'}</td>
      <td className="td-num">{agg ? formatNumber(agg.assists) : '…'}</td>
    </>
  );
}

function StatusCell({ player }: { player: Player }) {
  const cls = player.current_status === '退団' ? 'pill pill--out' : 'pill pill--active';
  return (
    <>
      <span className={cls}>{player.current_status}</span>
      {player.is_on_loan && <span className="pill pill--loan" style={{ marginLeft: 6 }}>レンタル</span>}
    </>
  );
}
