import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listPlayers, getAllPlayerAggregates } from '../repo';
import { useApp } from '../AppContext';
import { PlayerModal } from './PlayerModal';
import { formatMoney, formatNumber } from '../format';
import { useTableControls, SortableTh, FilterBar, type FilterDef } from './tableControls';
import { POSITIONS, JOIN_TYPES, type Player } from '../types';

type Row = Player & { _cur: number | null; _g: number; _a: number };
type SortKey = 'code' | 'name' | 'pos' | 'nat' | 'height' | 'join' | 'type' | 'ovr' | 'cur' | 'goals' | 'assists' | 'fee' | 'status';

export function PlayersPage() {
  const { currentCareer, seasons } = useApp();
  const players = useLiveQuery(
    () => (currentCareer ? listPlayers(currentCareer.id) : Promise.resolve([])),
    [currentCareer?.id], [],
  );
  const aggs = useLiveQuery(
    () => (currentCareer ? getAllPlayerAggregates(currentCareer.id) : Promise.resolve(new Map())),
    [currentCareer?.id], new Map(),
  );
  const [selected, setSelected] = useState<Player | null>(null);
  const [creating, setCreating] = useState(false);

  const seasonLabel = (id: string) => seasons.find((s) => s.id === id)?.label ?? '—';
  const orderOf = (id: string) => seasons.find((s) => s.id === id)?.order ?? 0;

  const rows: Row[] = (players ?? []).map((p) => {
    const a = aggs?.get(p.id);
    return { ...p, _cur: a?.currentOvr ?? null, _g: a?.goals ?? 0, _a: a?.assists ?? 0 };
  });

  const filterDefs: FilterDef[] = [
    { key: 'pos', label: 'POS', options: [...POSITIONS] },
    { key: 'status', label: '状態', options: ['在籍', '在籍（復帰）', '退団'] },
    { key: 'type', label: '加入種別', options: [...JOIN_TYPES] },
    { key: 'nat', label: '国籍', options: uniq(rows.map((r) => r.nationality)) },
  ];

  const tc = useTableControls<Row, SortKey>({
    rows,
    initialSort: { key: 'name', dir: 'asc' },
    searchText: (r) => `${r.name} ${r.display_code} ${r.nationality}`,
    filterValue: (r, key) =>
      key === 'pos' ? r.position : key === 'status' ? r.current_status : key === 'type' ? r.join_type : key === 'nat' ? r.nationality : '',
    sortValue: (r, k) => {
      switch (k) {
        case 'code': return r.display_code;
        case 'name': return r.name;
        case 'pos': return r.position;
        case 'nat': return r.nationality;
        case 'height': return r.height_cm;
        case 'join': return orderOf(r.join_season_id);
        case 'type': return r.join_type;
        case 'ovr': return r.join_ovr;
        case 'cur': return r._cur;
        case 'goals': return r._g;
        case 'assists': return r._a;
        case 'fee': return r.join_fee;
        case 'status': return r.current_status;
      }
    },
  });

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>選手</h1>
          <span className="sub">{tc.result.length} / {rows.length} 名</span>
        </div>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>＋ 選手を追加</button>
      </div>

      {rows.length === 0 ? (
        <div className="card card--pad">
          <div className="empty" style={{ padding: '40px 12px' }}>
            <h2>まだ選手がいません</h2>
            <p>「選手を追加」から、加入時のOVRや能力値などを登録できます。登録した選手はシーズンをまたいで同じレコードを使い続けます。</p>
            <button className="btn btn--primary" onClick={() => setCreating(true)}>＋ 最初の選手を追加</button>
          </div>
        </div>
      ) : (
        <>
          <FilterBar
            query={tc.query} setQuery={tc.setQuery}
            filters={tc.filters} setFilter={tc.setFilter}
            defs={filterDefs} activeCount={tc.activeCount} reset={tc.reset}
            placeholder="名前・コード・国籍で検索"
          />
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <SortableTh label="コード" sortKey="code" sort={tc.sort} onSort={tc.setSort} />
                  <SortableTh label="名前" sortKey="name" sort={tc.sort} onSort={tc.setSort} />
                  <SortableTh label="POS" sortKey="pos" sort={tc.sort} onSort={tc.setSort} />
                  <SortableTh label="国籍" sortKey="nat" sort={tc.sort} onSort={tc.setSort} />
                  <SortableTh label="身長" sortKey="height" sort={tc.sort} onSort={tc.setSort} numeric />
                  <SortableTh label="加入" sortKey="join" sort={tc.sort} onSort={tc.setSort} />
                  <SortableTh label="種別" sortKey="type" sort={tc.sort} onSort={tc.setSort} />
                  <SortableTh label="初期OVR" sortKey="ovr" sort={tc.sort} onSort={tc.setSort} numeric />
                  <SortableTh label="現OVR" sortKey="cur" sort={tc.sort} onSort={tc.setSort} numeric />
                  <SortableTh label="得点" sortKey="goals" sort={tc.sort} onSort={tc.setSort} numeric />
                  <SortableTh label="アシスト" sortKey="assists" sort={tc.sort} onSort={tc.setSort} numeric />
                  <SortableTh label="加入金" sortKey="fee" sort={tc.sort} onSort={tc.setSort} numeric />
                  <SortableTh label="状態" sortKey="status" sort={tc.sort} onSort={tc.setSort} />
                </tr>
              </thead>
              <tbody>
                {tc.result.map((p) => (
                  <tr key={p.id} onClick={() => setSelected(p)}>
                    <td className="td-code">{p.display_code}</td>
                    <td className="td-name">{p.name}</td>
                    <td><span className="pill pill--pos">{p.position}</span></td>
                    <td>{p.nationality || '—'}</td>
                    <td className="td-num">{p.height_cm || '—'}</td>
                    <td>{seasonLabel(p.join_season_id)}</td>
                    <td>{p.join_type}{p.is_on_loan ? '・レンタル' : ''}</td>
                    <td className="td-num">{formatNumber(p.join_ovr)}</td>
                    <td className="td-num">{p._cur != null ? formatNumber(p._cur) : '—'}</td>
                    <td className="td-num">{formatNumber(p._g)}</td>
                    <td className="td-num">{formatNumber(p._a)}</td>
                    <td className="td-num">{formatMoney(p.join_fee)}</td>
                    <td><StatusCell player={p} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {(selected || creating) && (
        <PlayerModal player={selected} onClose={() => { setSelected(null); setCreating(false); }} />
      )}
    </div>
  );
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ja'));
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
