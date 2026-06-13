import {
  createContext, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { listSeasons } from './repo';
import type { Career, Season } from './types';

// ============================================================
// アプリ状態（選択中キャリア / グローバルシーズン）
//
// 指示書の中核要件:
// - すべての操作は「選択中のキャリア」にスコープされる。
// - シーズンセレクタは1つだけで、全ページに共通で効く。
//
// 段階1でこのコンテキストを確立しておくことで、後続の各ページは
// useApp() から currentCareer / currentSeason を受け取るだけで済む。
// ============================================================

const CAREER_KEY = 'meisterweg.currentCareerId';
const SEASON_KEY_PREFIX = 'meisterweg.currentSeasonId.';

interface AppState {
  currentCareer: Career | null;
  seasons: Season[];
  currentSeason: Season | null;
  selectCareer: (id: string | null) => void;
  selectSeason: (id: string) => void;
  ready: boolean;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [careerId, setCareerId] = useState<string | null>(
    () => localStorage.getItem(CAREER_KEY),
  );
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // 選択中キャリア（live: DB変更に追従）
  const currentCareer = useLiveQuery(
    async () => (careerId ? (await db.careers.get(careerId)) ?? null : null),
    [careerId],
    undefined,
  );

  // 選択中キャリアのシーズン一覧（order順）
  const seasons = useLiveQuery(
    async () => (careerId ? await listSeasons(careerId) : []),
    [careerId],
    [],
  );

  // キャリアが解決したら ready 化（初回ロードのちらつき防止）
  useEffect(() => {
    if (currentCareer !== undefined && seasons !== undefined) setReady(true);
  }, [currentCareer, seasons]);

  // 保存していたシーズン選択を復元、無ければ先頭シーズン。
  useEffect(() => {
    if (!careerId || !seasons) return;
    if (seasons.length === 0) { setSeasonId(null); return; }
    const saved = localStorage.getItem(SEASON_KEY_PREFIX + careerId);
    const valid = saved && seasons.some((s) => s.id === saved) ? saved : seasons[0].id;
    setSeasonId(valid);
  }, [careerId, seasons]);

  const selectCareer = (id: string | null) => {
    setCareerId(id);
    setSeasonId(null);
    if (id) localStorage.setItem(CAREER_KEY, id);
    else localStorage.removeItem(CAREER_KEY);
  };

  const selectSeason = (id: string) => {
    setSeasonId(id);
    if (careerId) localStorage.setItem(SEASON_KEY_PREFIX + careerId, id);
  };

  const currentSeason = useMemo(
    () => (seasons ?? []).find((s) => s.id === seasonId) ?? null,
    [seasons, seasonId],
  );

  const value: AppState = {
    currentCareer: currentCareer ?? null,
    seasons: seasons ?? [],
    currentSeason,
    selectCareer,
    selectSeason,
    ready,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
