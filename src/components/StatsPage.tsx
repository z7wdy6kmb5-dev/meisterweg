import { useEffect, useRef, useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getSeasonStatRows, upsertSeasonStat, type StatRow } from '../repo';
import { useApp } from '../AppContext';
import { formatDelta } from '../format';
import { SortableTh, type SortState } from './tableControls';
import type { SeasonStats } from '../types';

// 編集可能なスタッツ列の定義（選手列は常時表示）。
type StatField = 'appearances' | 'goals' | 'assists' | 'avg_rating' | 'end_ovr';
interface ColDef { key: StatField | 'delta' | 'pos' | 'code'; label: string; kind: 'int' | 'float' | 'calc' | 'meta'; }

const COLUMNS: ColDef[] = [
  { key: 'code', label: 'コード', kind: 'meta' },
  { key: 'pos', label: 'POS', kind: 'meta' },
  { key: 'appearances', label: '出場', kind: 'int' },
  { key: 'goals', label: '得点', kind: 'int' },
  { key: 'assists', label: 'アシスト', kind: 'int' },
  { key: 'avg_rating', label: '平均評価', kind: 'float' },
  { key: 'end_ovr', label: '終OVR', kind: 'int' },
  { key: 'delta', label: 'OVR増減', kind: 'calc' },
];

const COLS_KEY = 'meisterweg.statsCols';
type Visible = Record<string, boolean>;

function loadVisible(): Visible {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (raw) return JSON.parse(raw) as Visible;
  } catch { /* ignore */ }
  return Object.fromEntries(COLUMNS.map((c) => [c.key, true]));
}

export function StatsPage() {
  const { currentCareer, currentSeason } = useApp();
  const rows = useLiveQuery(
    () => (currentCareer && currentSeason
      ? getSeasonStatRows(currentCareer.id, currentSeason.id)
      : Promise.resolve([] as StatRow[])),
    [currentCareer?.id, currentSeason?.id],
    [],
  );
  const [visible, setVisible] = useState<Visible>(loadVisible);
  const [colsOpen, setColsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSortState] = useState<SortState<string>>({ key: 'name', dir: 'asc' });

  useEffect(() => { localStorage.setItem(COLS_KEY, JSON.stringify(visible)); }, [visible]);

  function setSort(key: string) {
    setSortState((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  const processed = useMemo(() => {
    let list = (rows ?? []).slice();
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => `${r.player.name} ${r.player.display_code}`.toLowerCase().includes(q));
    const k = sort.key;
    if (k) {
      const val = (r: StatRow): number | string | null => {
        switch (k) {
          case 'name': return r.player.name;
          case 'code': return r.player.display_code;
          case 'pos': return r.player.position;
          case 'delta': return r.stat?.end_ovr != null && r.baseOvr != null ? r.stat.end_ovr - r.baseOvr : null;
          default: return (r.stat ? (r.stat[k as StatField] ?? null) : null);
        }
      };
      list.sort((a, b) => {
        const va = val(a), vb = val(b);
        const an = va == null, bn = vb == null;
        if (an && bn) return 0;
        if (an) return 1;
        if (bn) return -1;
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ja');
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [rows, query, sort]);

  if (!currentSeason) {
    return (
      <div className="card card--pad">
        <p className="info-line">シーズンがありません。ヘッダーの「＋ シーズン」から作成してください。</p>
      </div>
    );
  }

  const shown = COLUMNS.filter((c) => visible[c.key] !== false);

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>シーズンスタッツ</h1>
          <span className="sub">{currentSeason.label}・{(rows ?? []).length} 名</span>
        </div>
        <div style={{ position: 'relative' }}>
          <button className="btn btn--ghost" onClick={() => setColsOpen((v) => !v)}>列の表示 ▾</button>
          {colsOpen && (
            <>
              <div className="header-menu-backdrop" onClick={() => setColsOpen(false)} />
              <div className="header-menu" style={{ top: 44, right: 0 }}>
                {COLUMNS.map((c) => (
                  <label key={c.key} className="row" style={{ gap: 8, cursor: 'pointer', color: 'var(--mw-text)' }}>
                    <input
                      type="checkbox"
                      checked={visible[c.key] !== false}
                      onChange={(e) => setVisible((p) => ({ ...p, [c.key]: e.target.checked }))}
                      style={{ width: 'auto' }}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {(rows ?? []).length === 0 ? (
        <div className="card card--pad">
          <div className="empty" style={{ padding: '40px 12px' }}>
            <h2>このシーズンの対象選手がいません</h2>
            <p>在籍中の選手を「選手」タブで追加するか、新しいシーズンを作成すると、在籍選手の行が自動で用意されます。</p>
          </div>
        </div>
      ) : (
        <>
          <div className="filter-bar">
            <input
              className="filter-bar__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="選手名・コードで検索"
            />
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <SortableTh label="選手" sortKey="name" sort={sort} onSort={setSort} />
                  {shown.map((c) => (
                    <SortableTh
                      key={c.key}
                      label={c.label}
                      sortKey={c.key}
                      sort={sort}
                      onSort={setSort}
                      numeric={c.kind !== 'meta'}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {processed.map((r) => (
                  <StatRowView key={r.player.id} row={r} seasonId={currentSeason.id} shown={shown} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p className="info-line mt-16">終OVR（シーズン終了時OVR）・平均評価などは行ごとに保存され、OVR増減は前シーズンの終OVR（初年度は加入時OVR）との差で自動計算されます。</p>
    </div>
  );
}

function StatRowView({ row, seasonId, shown }: { row: StatRow; seasonId: string; shown: ColDef[] }) {
  const { player, stat, baseOvr } = row;
  const endOvr = stat?.end_ovr ?? null;
  const delta = endOvr != null && baseOvr != null ? endOvr - baseOvr : null;

  return (
    <tr style={{ cursor: 'default' }}>
      <td>
        <div className="td-name">{player.name}</div>
        <div className="td-code">{player.display_code}</div>
      </td>
      {shown.map((c) => {
        if (c.key === 'code') return <td key="code" className="td-code">{player.display_code}</td>;
        if (c.key === 'pos') return <td key="pos"><span className="pill pill--pos">{player.position}</span></td>;
        if (c.key === 'delta') {
          const cls = delta == null ? '' : delta > 0 ? 'pill pill--active' : delta < 0 ? 'pill pill--out' : 'pill';
          return (
            <td key="delta" className="td-num">
              {delta == null ? <span className="muted">—</span> : <span className={cls}>{formatDelta(delta)}</span>}
            </td>
          );
        }
        const field = c.key as StatField;
        return (
          <td key={field} className="td-num">
            <EditableStat
              seasonId={seasonId}
              playerId={player.id}
              field={field}
              value={stat ? stat[field] : null}
              float={c.kind === 'float'}
            />
          </td>
        );
      })}
    </tr>
  );
}

// セル内の数値入力。フォーカス外し or Enter で保存（ライブ更新によるカーソル飛びを防ぐ）。
function EditableStat({
  seasonId, playerId, field, value, float,
}: { seasonId: string; playerId: string; field: StatField; value: number | null; float: boolean }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const dirty = useRef(false);
  useEffect(() => { if (!dirty.current) setText(value == null ? '' : String(value)); }, [value]);

  function commit() {
    dirty.current = false;
    const t = text.trim();
    const next: number | null = t === '' ? null : Number(t);
    if (t !== '' && Number.isNaN(next as number)) { setText(value == null ? '' : String(value)); return; }
    if (next !== value) {
      void upsertSeasonStat(seasonId, playerId, { [field]: next } as Partial<SeasonStats>);
    }
  }

  return (
    <input
      className="cell-input"
      type="number"
      step={float ? '0.1' : '1'}
      value={text}
      onChange={(e) => { dirty.current = true; setText(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder="—"
    />
  );
}
