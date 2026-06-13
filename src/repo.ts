import { v4 as uuid } from 'uuid';
import { db } from './db';
import {
  CURRENT_SCHEMA_VERSION,
  type Career,
  type Season,
  type Player,
  type SeasonStats,
  type Transfer,
  type Position,
  type JoinType,
  type PlayerStatus,
} from './types';

// ============================================================
// データアクセス層（リポジトリ）
// 段階1: Career / Season 基本操作
// 段階2: Player CRUD（加入時スナップショット）/ シーズン作成時の在籍選手自動展開 / 集計値
// 後続段階は同じ db を使い、ここに関数を足していく。
// ============================================================

// ---- Career ------------------------------------------------

export interface NewCareerInput {
  name: string;
  team_name: string;
  team_code: string;
  start_season: string;
}

export async function createCareer(input: NewCareerInput): Promise<Career> {
  const career: Career = {
    id: uuid(),
    name: input.name.trim(),
    team_name: input.team_name.trim(),
    team_code: input.team_code.trim(),
    start_season: input.start_season.trim(),
    created_at: new Date().toISOString(),
    schema_version: CURRENT_SCHEMA_VERSION,
  };
  const firstSeason: Season = {
    id: uuid(),
    career_id: career.id,
    label: career.start_season || 'シーズン1',
    order: 1,
  };
  await db.transaction('rw', db.careers, db.seasons, async () => {
    await db.careers.add(career);
    await db.seasons.add(firstSeason);
  });
  return career;
}

export function listCareers(): Promise<Career[]> {
  return db.careers.orderBy('created_at').reverse().toArray();
}

export function getCareer(id: string): Promise<Career | undefined> {
  return db.careers.get(id);
}

export async function deleteCareer(careerId: string): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.careers, db.seasons, db.players, db.seasonStats,
      db.transfers, db.teamRecords, db.seasonMemos, db.constraints,
    ],
    async () => {
      const seasons = await db.seasons.where('career_id').equals(careerId).toArray();
      const seasonIds = seasons.map((s) => s.id);
      const players = await db.players.where('career_id').equals(careerId).toArray();
      const playerIds = players.map((p) => p.id);
      await db.seasonStats.where('player_id').anyOf(playerIds).delete();
      await db.transfers.where('player_id').anyOf(playerIds).delete();
      await db.teamRecords.where('season_id').anyOf(seasonIds).delete();
      await db.seasonMemos.where('season_id').anyOf(seasonIds).delete();
      await db.constraints.where('career_id').equals(careerId).delete();
      await db.players.where('career_id').equals(careerId).delete();
      await db.seasons.where('career_id').equals(careerId).delete();
      await db.careers.delete(careerId);
    },
  );
}

// ---- Season ------------------------------------------------

export function listSeasons(careerId: string): Promise<Season[]> {
  return db.seasons.where('career_id').equals(careerId).sortBy('order');
}

/** 在籍とみなすステータス（自動展開・現役判定の基準）。 */
const ACTIVE_STATUSES: PlayerStatus[] = ['在籍', '在籍（復帰）'];

/**
 * 新シーズンを作成する。
 * 指示書 3-6: 作成時点で在籍（または在籍復帰）の選手に、新シーズンの
 * 空 SeasonStats 行を自動生成する。ユーザーは数値を埋めるだけでよい。
 * includeLoan=false でレンタル中の選手を展開対象から除外できる。
 */
export async function createSeason(
  careerId: string,
  label: string,
  includeLoan = true,
): Promise<Season> {
  return db.transaction('rw', db.seasons, db.players, db.seasonStats, async () => {
    const seasons = await db.seasons.where('career_id').equals(careerId).toArray();
    const maxOrder = seasons.reduce((m, s) => Math.max(m, s.order), 0);
    const season: Season = {
      id: uuid(),
      career_id: careerId,
      label: label.trim() || `シーズン${maxOrder + 1}`,
      order: maxOrder + 1,
    };
    await db.seasons.add(season);

    // 在籍選手の自動展開
    const players = await db.players.where('career_id').equals(careerId).toArray();
    const targets = players.filter(
      (p) => ACTIVE_STATUSES.includes(p.current_status) && (includeLoan || !p.is_on_loan),
    );
    if (targets.length > 0) {
      const rows: SeasonStats[] = targets.map((p) => ({
        id: uuid(),
        player_id: p.id,
        season_id: season.id,
        appearances: null,
        goals: null,
        assists: null,
        avg_rating: null,
        end_ovr: null,
      }));
      await db.seasonStats.bulkAdd(rows);
    }
    return season;
  });
}

export async function renameSeason(seasonId: string, label: string): Promise<void> {
  await db.seasons.update(seasonId, { label: label.trim() });
}

/**
 * シーズン削除。そのシーズンの SeasonStats / TeamRecord / SeasonMemo も削除する。
 * いずれかの選手の加入シーズンに使われている場合は、参照が壊れるため削除を拒否する。
 */
export async function deleteSeason(seasonId: string): Promise<{ ok: boolean; reason?: string }> {
  const joinRef = await db.players.where('join_season_id').equals(seasonId).count();
  if (joinRef > 0) {
    return { ok: false, reason: `このシーズンを加入シーズンとする選手が ${joinRef} 名います。先に選手の加入シーズンを変更してください。` };
  }
  await db.transaction('rw', db.seasons, db.seasonStats, db.teamRecords, db.seasonMemos, async () => {
    await db.seasonStats.where('season_id').equals(seasonId).delete();
    await db.teamRecords.where('season_id').equals(seasonId).delete();
    await db.seasonMemos.where('season_id').equals(seasonId).delete();
    await db.seasons.delete(seasonId);
  });
  return { ok: true };
}

// ---- Player ------------------------------------------------

export interface PlayerInput {
  display_code?: string;
  name: string;
  position: Position;
  nationality: string;
  height_cm: number;
  join_season_id: string;
  join_type: JoinType;
  is_on_loan: boolean;
  current_status: PlayerStatus;
  join_fee: number;
  join_wage: number;
  join_ovr: number;
  join_pace: number;
  join_shooting: number;
  join_passing: number;
  join_dribbling: number;
  join_defending: number;
  join_physical: number;
  join_market_value?: number;
}

function compactSeason(label: string): string {
  return label.replace(/[^0-9A-Za-z]/g, '');
}

/** 表示コードの自動採番: {略号}-{加入シーズン}-{連番3桁}（例 WM-2526-001）。 */
export async function nextDisplayCode(
  careerId: string,
  teamCode: string,
  joinSeasonLabel: string,
): Promise<string> {
  const prefix = `${teamCode || 'P'}-${compactSeason(joinSeasonLabel)}-`;
  const players = await db.players.where('career_id').equals(careerId).toArray();
  const n = players.filter((p) => p.display_code?.startsWith(prefix)).length + 1;
  return `${prefix}${String(n).padStart(3, '0')}`;
}

export function listPlayers(careerId: string): Promise<Player[]> {
  return db.players.where('career_id').equals(careerId).toArray();
}

export function getPlayer(id: string): Promise<Player | undefined> {
  return db.players.get(id);
}

export async function createPlayer(careerId: string, input: PlayerInput): Promise<Player> {
  let code = input.display_code?.trim();
  if (!code) {
    const career = await db.careers.get(careerId);
    const season = await db.seasons.get(input.join_season_id);
    code = await nextDisplayCode(careerId, career?.team_code ?? '', season?.label ?? '');
  }
  const player: Player = {
    id: uuid(),
    display_code: code,
    career_id: careerId,
    name: input.name.trim(),
    position: input.position,
    nationality: input.nationality.trim(),
    height_cm: input.height_cm,
    join_season_id: input.join_season_id,
    join_type: input.join_type,
    is_academy: input.join_type === 'アカデミー',
    is_on_loan: input.is_on_loan,
    current_status: input.current_status,
    join_fee: input.join_fee,
    join_wage: input.join_wage,
    join_ovr: input.join_ovr,
    join_pace: input.join_pace,
    join_shooting: input.join_shooting,
    join_passing: input.join_passing,
    join_dribbling: input.join_dribbling,
    join_defending: input.join_defending,
    join_physical: input.join_physical,
    join_market_value: input.join_market_value,
  };
  await db.players.add(player);
  return player;
}

export async function updatePlayer(id: string, input: PlayerInput): Promise<void> {
  await db.players.update(id, {
    display_code: input.display_code?.trim() || undefined,
    name: input.name.trim(),
    position: input.position,
    nationality: input.nationality.trim(),
    height_cm: input.height_cm,
    join_season_id: input.join_season_id,
    join_type: input.join_type,
    is_academy: input.join_type === 'アカデミー', // 自動導出を維持
    is_on_loan: input.is_on_loan,
    current_status: input.current_status,
    join_fee: input.join_fee,
    join_wage: input.join_wage,
    join_ovr: input.join_ovr,
    join_pace: input.join_pace,
    join_shooting: input.join_shooting,
    join_passing: input.join_passing,
    join_dribbling: input.join_dribbling,
    join_defending: input.join_defending,
    join_physical: input.join_physical,
    join_market_value: input.join_market_value,
  });
}

export async function deletePlayer(id: string): Promise<void> {
  await db.transaction('rw', db.players, db.seasonStats, db.transfers, async () => {
    await db.seasonStats.where('player_id').equals(id).delete();
    await db.transfers.where('player_id').equals(id).delete();
    await db.players.delete(id);
  });
}

// ---- 集計値（保存しない／表示のたびに再計算：指示書 第3章） ----

export interface PlayerAggregates {
  appearances: number;
  goals: number;
  assists: number;
  /** 現OVR＝最新シーズンの end_ovr（無ければ null） */
  currentOvr: number | null;
}

/**
 * 選手の総得点・総アシスト・総試合数・現OVRを算出する。
 * 現OVR は order の大きいシーズンから探し、最初に見つかった end_ovr。
 */
export async function getPlayerAggregates(playerId: string): Promise<PlayerAggregates> {
  const player = await db.players.get(playerId);
  const stats = await db.seasonStats.where('player_id').equals(playerId).toArray();
  let appearances = 0;
  let goals = 0;
  let assists = 0;
  for (const s of stats) {
    appearances += s.appearances ?? 0;
    goals += s.goals ?? 0;
    assists += s.assists ?? 0;
  }

  let currentOvr: number | null = null;
  if (player) {
    const seasons = await db.seasons.where('career_id').equals(player.career_id).sortBy('order');
    const orderById = new Map(seasons.map((s) => [s.id, s.order]));
    const withOvr = stats
      .filter((s) => s.end_ovr != null)
      .sort((a, b) => (orderById.get(b.season_id) ?? 0) - (orderById.get(a.season_id) ?? 0));
    currentOvr = withOvr.length > 0 ? withOvr[0].end_ovr : null;
  }
  return { appearances, goals, assists, currentOvr };
}

// ============================================================
// 段階3: シーズンスタッツ
// ============================================================

export interface StatRow {
  player: Player;
  stat: SeasonStats | null;
  /** 直前シーズンの end_ovr（無ければ加入時OVR）。OVR増減の基準。 */
  baseOvr: number | null;
}

/**
 * 指定シーズンのスタッツ表データを組み立てる。
 * 対象選手 = そのシーズンに stat 行を持つ、または「在籍中かつ加入シーズン≦当該シーズン」。
 * baseOvr = その選手の当該シーズンより前で最も新しい end_ovr。無ければ join_ovr。
 */
export async function getSeasonStatRows(careerId: string, seasonId: string): Promise<StatRow[]> {
  const seasons = await db.seasons.where('career_id').equals(careerId).sortBy('order');
  const orderById = new Map(seasons.map((s) => [s.id, s.order]));
  const curOrder = orderById.get(seasonId) ?? 0;

  const players = await db.players.where('career_id').equals(careerId).toArray();
  const seasonIds = seasons.map((s) => s.id);
  const allStats = await db.seasonStats.where('season_id').anyOf(seasonIds).toArray();

  const statsByPlayer = new Map<string, SeasonStats[]>();
  for (const s of allStats) {
    const arr = statsByPlayer.get(s.player_id) ?? [];
    arr.push(s);
    statsByPlayer.set(s.player_id, arr);
  }

  const rows: StatRow[] = [];
  for (const p of players) {
    const mine = statsByPlayer.get(p.id) ?? [];
    const statHere = mine.find((s) => s.season_id === seasonId) ?? null;
    const active = p.current_status === '在籍' || p.current_status === '在籍（復帰）';
    const joinedBy = (orderById.get(p.join_season_id) ?? 0) <= curOrder;
    if (!statHere && !(active && joinedBy)) continue;

    // 直前の end_ovr（order が現在未満で最大、end_ovr 非 null）
    const prev = mine
      .filter((s) => (orderById.get(s.season_id) ?? 0) < curOrder && s.end_ovr != null)
      .sort((a, b) => (orderById.get(b.season_id) ?? 0) - (orderById.get(a.season_id) ?? 0))[0];
    const baseOvr = prev?.end_ovr ?? p.join_ovr;

    rows.push({ player: p, stat: statHere, baseOvr });
  }

  rows.sort((a, b) => a.player.name.localeCompare(b.player.name, 'ja'));
  return rows;
}

/**
 * スタッツの1項目を更新（無ければ新規作成）。compound index [season_id+player_id] で同定。
 */
export async function upsertSeasonStat(
  seasonId: string,
  playerId: string,
  patch: Partial<Omit<SeasonStats, 'id' | 'season_id' | 'player_id'>>,
): Promise<void> {
  const existing = await db.seasonStats
    .where('[season_id+player_id]').equals([seasonId, playerId]).first();
  if (existing) {
    await db.seasonStats.update(existing.id, patch);
  } else {
    await db.seasonStats.add({
      id: uuid(),
      player_id: playerId,
      season_id: seasonId,
      appearances: null, goals: null, assists: null, avg_rating: null, end_ovr: null,
      ...patch,
    });
  }
}

// ============================================================
// 段階4: 移籍（退団記録・復帰・履歴）
// ============================================================

export interface TransferInput {
  season_id: string;
  window: Transfer['window'];
  type: Transfer['type'];
  fee: number;
  market_value_at_time: number;
  destination: string;
  reason: string;
}

/**
 * 退団を記録する。Transfer を1件作成し、選手のステータスを「退団」に、
 * レンタル中フラグを解除する（3-4 の退団モーダル連動）。
 */
export async function recordDeparture(playerId: string, input: TransferInput): Promise<void> {
  await db.transaction('rw', db.transfers, db.players, async () => {
    await db.transfers.add({
      id: uuid(),
      player_id: playerId,
      season_id: input.season_id,
      window: input.window,
      type: input.type,
      fee: input.fee,
      market_value_at_time: input.market_value_at_time,
      destination: input.destination.trim(),
      reason: input.reason.trim(),
    });
    await db.players.update(playerId, { current_status: '退団', is_on_loan: false });
  });
}

/** 復帰させる。ステータスを「在籍（復帰）」に戻す。移籍記録は履歴として残す。 */
export async function setPlayerReturned(playerId: string): Promise<void> {
  await db.players.update(playerId, { current_status: '在籍（復帰）' });
}

export function listTransfersForPlayer(playerId: string): Promise<Transfer[]> {
  return db.transfers.where('player_id').equals(playerId).toArray();
}

export async function deleteTransfer(id: string): Promise<void> {
  await db.transfers.delete(id);
}

export interface TransferRow {
  transfer: Transfer;
  player: Player;
  seasonLabel: string;
  order: number;
}

/**
 * 移籍履歴の表示用データ。seasonId='all' で全シーズン、指定で当該シーズンのみ。
 * 新しいシーズン順 → 選手名順。
 */
export async function getTransferRows(careerId: string, seasonId: string): Promise<TransferRow[]> {
  const players = await listPlayers(careerId);
  const pmap = new Map(players.map((p) => [p.id, p]));
  const seasons = await listSeasons(careerId);
  const smap = new Map(seasons.map((s) => [s.id, s]));
  const ids = players.map((p) => p.id);
  let transfers = await db.transfers.where('player_id').anyOf(ids).toArray();
  if (seasonId !== 'all') transfers = transfers.filter((t) => t.season_id === seasonId);

  const rows: TransferRow[] = transfers
    .map((t) => ({
      transfer: t,
      player: pmap.get(t.player_id)!,
      seasonLabel: smap.get(t.season_id)?.label ?? '—',
      order: smap.get(t.season_id)?.order ?? 0,
    }))
    .filter((r) => r.player);
  rows.sort((a, b) => b.order - a.order || a.player.name.localeCompare(b.player.name, 'ja'));
  return rows;
}
