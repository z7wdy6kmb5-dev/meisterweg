import { useMemo, useState } from 'react';

// ============================================================
// 汎用の並び替え・絞り込みフック＆UI部品
// 各データページのテーブルで再利用する。
// ============================================================

export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string> { key: K | null; dir: SortDir; }

export interface FilterDef {
  key: string;
  label: string;
  options: string[]; // 選択肢（'すべて' は内部で付与）
}

export interface UseTableControls<T, K extends string> {
  sort: SortState<K>;
  setSort: (key: K) => void;
  query: string;
  setQuery: (q: string) => void;
  filters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  reset: () => void;
  result: T[];
  activeCount: number;
}

interface Config<T, K extends string> {
  rows: T[];
  // 並び替え値の取り出し（数値 or 文字列）
  sortValue: (row: T, key: K) => number | string | null | undefined;
  // 全文検索の対象テキスト
  searchText?: (row: T) => string;
  // 絞り込み：定義 + 各行の該当値
  filterValue?: (row: T, key: string) => string;
  initialSort?: SortState<K>;
}

export function useTableControls<T, K extends string>(cfg: Config<T, K>): UseTableControls<T, K> {
  const [sort, setSortState] = useState<SortState<K>>(cfg.initialSort ?? { key: null, dir: 'asc' });
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  function setSort(key: K) {
    setSortState((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  }
  function setFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }
  function reset() { setSortState(cfg.initialSort ?? { key: null, dir: 'asc' }); setQuery(''); setFilters({}); }

  const result = useMemo(() => {
    let rows = cfg.rows.slice();

    // 絞り込み
    if (cfg.filterValue) {
      for (const [key, val] of Object.entries(filters)) {
        if (!val || val === 'すべて') continue;
        rows = rows.filter((r) => cfg.filterValue!(r, key) === val);
      }
    }

    // 検索
    const q = query.trim().toLowerCase();
    if (q && cfg.searchText) {
      rows = rows.filter((r) => cfg.searchText!(r).toLowerCase().includes(q));
    }

    // 並び替え
    if (sort.key) {
      const k = sort.key;
      rows.sort((a, b) => {
        const va = cfg.sortValue(a, k);
        const vb = cfg.sortValue(b, k);
        const cmp = compare(va, vb);
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return rows;
  }, [cfg, filters, query, sort]);

  const activeCount =
    (query.trim() ? 1 : 0) +
    Object.values(filters).filter((v) => v && v !== 'すべて').length +
    (sort.key ? 1 : 0);

  return { sort, setSort, query, setQuery, filters, setFilter, reset, result, activeCount };
}

function compare(a: number | string | null | undefined, b: number | string | null | undefined): number {
  const an = a == null || a === '';
  const bn = b == null || b === '';
  if (an && bn) return 0;
  if (an) return 1;   // 空は末尾
  if (bn) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ja');
}

// 並び替え可能な見出しセル
export function SortableTh<K extends string>({ label, sortKey, sort, onSort, numeric }: {
  label: string; sortKey: K; sort: SortState<K>; onSort: (k: K) => void; numeric?: boolean;
}) {
  const active = sort.key === sortKey;
  return (
    <th
      className={`th-sort ${numeric ? 'td-num' : ''} ${active ? 'th-sort--active' : ''}`}
      onClick={() => onSort(sortKey)}
      title="クリックで並び替え"
    >
      <span className="th-sort__inner">
        {label}
        <span className="th-sort__arrow">{active ? (sort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  );
}

// 検索＋フィルタのツールバー
export function FilterBar({ query, setQuery, filters, setFilter, defs, activeCount, reset, placeholder }: {
  query: string; setQuery: (q: string) => void;
  filters: Record<string, string>; setFilter: (k: string, v: string) => void;
  defs: FilterDef[]; activeCount: number; reset: () => void; placeholder?: string;
}) {
  return (
    <div className="filter-bar">
      <input
        className="filter-bar__search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? '検索…'}
      />
      {defs.map((d) => (
        <select key={d.key} value={filters[d.key] ?? 'すべて'} onChange={(e) => setFilter(d.key, e.target.value)}>
          <option value="すべて">{d.label}：すべて</option>
          {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ))}
      {activeCount > 0 && (
        <button className="btn btn--ghost" style={{ padding: '8px 12px' }} onClick={reset}>クリア</button>
      )}
    </div>
  );
}
