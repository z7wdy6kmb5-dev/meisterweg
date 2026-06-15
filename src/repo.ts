import { v4 as uuid } from 'uuid';
import { db } from './db';
import {
  CURRENT_SCHEMA_VERSION,
  type Career,
  type Season,
  type Player,
  type SeasonStats,
  type Transfer,
  type TeamRecord,
  type SeasonMemo,
  type Constraint,
  type ConstraintTemplateKey,
  type CompetitionType,
  type MemoMonth,
  type Position,
  type JoinType,
  type PlayerStatus,
  type MeisterwegBundle,
} from './types';
import { isBundleVersionSupported, migrateBundleData } from './migrations';

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

/** キャリア全選手の集計をまとめて取得（一覧の並び替え用）。playerId→集計。 */
export async function getAllPlayerAggregates(careerId: string): Promise<Map<string, PlayerAggregates>> {
  const players = await listPlayers(careerId);
  const ids = players.map((p) => p.id);
  const stats = ids.length ? await db.seasonStats.where('player_id').anyOf(ids).toArray() : [];
  const seasons = await db.seasons.where('career_id').equals(careerId).sortBy('order');
  const orderById = new Map(seasons.map((s) => [s.id, s.order]));

  const map = new Map<string, PlayerAggregates>();
  for (const p of players) map.set(p.id, { appearances: 0, goals: 0, assists: 0, currentOvr: null });
  const latestOrder = new Map<string, number>();
  for (const s of stats) {
    const a = map.get(s.player_id);
    if (!a) continue;
    a.appearances += s.appearances ?? 0;
    a.goals += s.goals ?? 0;
    a.assists += s.assists ?? 0;
    if (s.end_ovr != null) {
      const ord = orderById.get(s.season_id) ?? 0;
      if (ord >= (latestOrder.get(s.player_id) ?? -1)) {
        latestOrder.set(s.player_id, ord);
        a.currentOvr = s.end_ovr;
      }
    }
  }
  return map;
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
 * 退団を記録する。Transfer(kind=departure) を1件作成し、選手のステータスを「退団」に、
 * レンタル中フラグを解除する（3-4 の退団モーダル連動）。
 */
export async function recordDeparture(playerId: string, input: TransferInput): Promise<void> {
  await db.transaction('rw', db.transfers, db.players, async () => {
    await db.transfers.add({
      id: uuid(),
      player_id: playerId,
      kind: 'departure',
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

/**
 * 復帰を記録する。Transfer(kind=return) を1件作成し、ステータスを「在籍（復帰）」に戻す。
 * この記録は移籍タブには出さず、選手プロフィールの移籍履歴にのみ表示する。
 */
export async function recordReturn(playerId: string, input: TransferInput): Promise<void> {
  await db.transaction('rw', db.transfers, db.players, async () => {
    await db.transfers.add({
      id: uuid(),
      player_id: playerId,
      kind: 'return',
      season_id: input.season_id,
      window: input.window,
      type: input.type,
      fee: input.fee,
      market_value_at_time: input.market_value_at_time,
      destination: input.destination.trim(),
      reason: input.reason.trim(),
    });
    await db.players.update(playerId, { current_status: '在籍（復帰）' });
  });
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
  // 移籍タブは「退団」のみ。復帰は選手履歴だけに表示する。
  transfers = transfers.filter((t) => (t.kind ?? 'departure') === 'departure');
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

// ============================================================
// 段階5: チーム成績（TeamRecord）／シーズンメモ（SeasonMemo）
// ============================================================

export interface TeamRecordInput {
  competition_type: CompetitionType;
  competition_name: string;
  final_position: string;
  league_phase_position: string;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  note: string;
}

export function listTeamRecords(seasonId: string): Promise<TeamRecord[]> {
  return db.teamRecords.where('season_id').equals(seasonId).toArray();
}

export async function createTeamRecord(seasonId: string, input: TeamRecordInput): Promise<void> {
  await db.teamRecords.add({ id: uuid(), season_id: seasonId, ...normalizeRecord(input) });
}

export async function updateTeamRecord(id: string, input: TeamRecordInput): Promise<void> {
  await db.teamRecords.update(id, normalizeRecord(input));
}

export async function deleteTeamRecord(id: string): Promise<void> {
  await db.teamRecords.delete(id);
}

function normalizeRecord(input: TeamRecordInput): Omit<TeamRecord, 'id' | 'season_id'> {
  // リーグは到達ラウンド/リーグフェーズ順位を持たない等、区分で不要な項目は空に。
  const isLeague = input.competition_type === 'リーグ';
  const isInter = input.competition_type === '大陸間クラブ選手権';
  return {
    competition_type: input.competition_type,
    competition_name: input.competition_name.trim(),
    final_position: isLeague ? input.final_position.trim() : input.final_position.trim(), // リーグ=順位 / カップ=到達ラウンド
    league_phase_position: isInter ? input.league_phase_position.trim() : '',
    wins: input.wins,
    draws: input.draws,
    losses: input.losses,
    goals_for: input.goals_for,
    goals_against: input.goals_against,
    note: input.note.trim(),
  };
}

// ---- シーズンメモ（月別） ----

export function listSeasonMemos(seasonId: string): Promise<SeasonMemo[]> {
  return db.seasonMemos.where('season_id').equals(seasonId).toArray();
}

/** 月別メモを保存（無ければ作成、空文字なら削除してすっきり保つ）。 */
export async function upsertSeasonMemo(seasonId: string, month: MemoMonth, body: string): Promise<void> {
  const existing = await db.seasonMemos
    .where('[season_id+month]').equals([seasonId, month]).first();
  const trimmed = body;
  if (existing) {
    if (trimmed.trim() === '') await db.seasonMemos.delete(existing.id);
    else await db.seasonMemos.update(existing.id, { body: trimmed });
  } else if (trimmed.trim() !== '') {
    await db.seasonMemos.add({ id: uuid(), season_id: seasonId, month, body: trimmed });
  }
}

// ============================================================
// 段階6: 縛り（Constraint）
// ============================================================

export function listConstraints(careerId: string): Promise<Constraint[]> {
  return db.constraints.where('career_id').equals(careerId).toArray();
}

export async function createConstraint(
  careerId: string, templateKey: ConstraintTemplateKey, isAuto: boolean,
  params: Record<string, unknown>, note: string, penalty: string,
): Promise<void> {
  await db.constraints.add({
    id: uuid(),
    career_id: careerId,
    template_key: templateKey,
    is_auto: isAuto,
    params,
    note: note.trim(),
    penalty: penalty.trim(),
    manual_checked: false,
    enabled: true,
  });
}

export async function updateConstraint(id: string, patch: Partial<Constraint>): Promise<void> {
  await db.constraints.update(id, patch);
}

export async function deleteConstraint(id: string): Promise<void> {
  await db.constraints.delete(id);
}

/** 自動判定に必要な選手・移籍データをまとめて取得。 */
export async function getConstraintContext(careerId: string): Promise<{ players: Player[]; transfers: Transfer[] }> {
  const players = await listPlayers(careerId);
  const ids = players.map((p) => p.id);
  const transfers = await db.transfers.where('player_id').anyOf(ids).toArray();
  return { players, transfers };
}

// ============================================================
// 段階7: エクスポート / インポート（JSON バンドル & Markdown）
// ============================================================

/** 指定キャリアの全データを1つのバンドルにまとめる。 */
export async function exportCareerBundle(careerId: string): Promise<MeisterwegBundle> {
  const career = await db.careers.get(careerId);
  if (!career) throw new Error('career not found');
  const seasons = await db.seasons.where('career_id').equals(careerId).toArray();
  const players = await db.players.where('career_id').equals(careerId).toArray();
  const playerIds = players.map((p) => p.id);
  const seasonIds = seasons.map((s) => s.id);

  const season_stats = (await db.seasonStats.where('player_id').anyOf(playerIds).toArray());
  const transfers = await db.transfers.where('player_id').anyOf(playerIds).toArray();
  const team_records = (await db.teamRecords.where('season_id').anyOf(seasonIds).toArray());
  const season_memos = (await db.seasonMemos.where('season_id').anyOf(seasonIds).toArray());
  const constraints = await db.constraints.where('career_id').equals(careerId).toArray();

  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    career, seasons, players, season_stats, transfers, team_records, season_memos, constraints,
  };
}

/**
 * バンドルを取り込み、新しいIDを振って別キャリアとして復元する。
 * （既存データを壊さないよう常に新規キャリアとして追加する。）
 */
export async function importCareerBundle(bundle: MeisterwegBundle): Promise<string> {
  if (!isBundleVersionSupported(bundle.schema_version)) {
    throw new Error(`このファイルのバージョン(${bundle.schema_version})はサポート対象外です。アプリを更新してください。`);
  }
  // 旧バージョンなら現行へ変換（メモリ上）
  migrateBundleData(bundle as unknown as {
    schema_version: number;
    transfers: Array<Record<string, unknown>>;
    team_records: Array<Record<string, unknown>>;
    constraints: Array<Record<string, unknown>>;
  });

  // ID 再割り当てマップ
  const careerId = uuid();
  const seasonMap = new Map<string, string>();
  const playerMap = new Map<string, string>();
  for (const s of bundle.seasons) seasonMap.set(s.id, uuid());
  for (const p of bundle.players) playerMap.set(p.id, uuid());

  const career: Career = {
    ...bundle.career,
    id: careerId,
    name: bundle.career.name + '（インポート）',
    schema_version: CURRENT_SCHEMA_VERSION,
  };
  const seasons = bundle.seasons.map((s) => ({
    ...s, id: seasonMap.get(s.id)!, career_id: careerId,
  }));
  const players = bundle.players.map((p) => ({
    ...p, id: playerMap.get(p.id)!, career_id: careerId,
    join_season_id: seasonMap.get(p.join_season_id) ?? p.join_season_id,
  }));
  const season_stats = bundle.season_stats.map((st) => ({
    ...st, id: uuid(),
    player_id: playerMap.get(st.player_id) ?? st.player_id,
    season_id: seasonMap.get(st.season_id) ?? st.season_id,
  }));
  const transfers = bundle.transfers.map((t) => ({
    ...t, id: uuid(),
    player_id: playerMap.get(t.player_id) ?? t.player_id,
    season_id: seasonMap.get(t.season_id) ?? t.season_id,
  }));
  const team_records = bundle.team_records.map((r) => ({
    ...r, id: uuid(), season_id: seasonMap.get(r.season_id) ?? r.season_id,
  }));
  const season_memos = bundle.season_memos.map((m) => ({
    ...m, id: uuid(), season_id: seasonMap.get(m.season_id) ?? m.season_id,
  }));
  const constraints = bundle.constraints.map((c) => ({
    ...c, id: uuid(), career_id: careerId,
  }));

  await db.transaction('rw',
    [db.careers, db.seasons, db.players, db.seasonStats, db.transfers, db.teamRecords, db.seasonMemos, db.constraints],
    async () => {
      await db.careers.add(career);
      await db.seasons.bulkAdd(seasons);
      await db.players.bulkAdd(players);
      await db.seasonStats.bulkAdd(season_stats);
      await db.transfers.bulkAdd(transfers);
      await db.teamRecords.bulkAdd(team_records);
      await db.seasonMemos.bulkAdd(season_memos);
      await db.constraints.bulkAdd(constraints);
    });

  return careerId;
}

// ============================================================
// ダッシュボード用集計
// ============================================================

export interface DashboardData {
  seasonId: string | 'all';
  totalPlayers: number;       // 在籍選手数
  academyCount: number;       // アカデミー出身の在籍数
  topScorers: { name: string; value: number }[];
  topAssists: { name: string; value: number }[];
  topRated: { name: string; value: number }[];
  records: TeamRecord[];      // 対象シーズンのチーム成績
  goalsFor: number;
  goalsAgainst: number;
  wins: number; draws: number; losses: number;
}

export async function getDashboardData(careerId: string, seasonId: string | 'all'): Promise<DashboardData> {
  const players = await listPlayers(careerId);
  const roster = players.filter((p) => p.current_status !== '退団');
  const byId = new Map(players.map((p) => [p.id, p]));
  const ids = players.map((p) => p.id);

  let stats = ids.length ? await db.seasonStats.where('player_id').anyOf(ids).toArray() : [];
  if (seasonId !== 'all') stats = stats.filter((s) => s.season_id === seasonId);

  // 選手ごとに合計
  const agg = new Map<string, { goals: number; assists: number; ratingSum: number; ratingN: number }>();
  for (const s of stats) {
    const a = agg.get(s.player_id) ?? { goals: 0, assists: 0, ratingSum: 0, ratingN: 0 };
    a.goals += s.goals ?? 0;
    a.assists += s.assists ?? 0;
    if (s.avg_rating != null) { a.ratingSum += s.avg_rating; a.ratingN += 1; }
    agg.set(s.player_id, a);
  }
  const name = (id: string) => byId.get(id)?.name ?? '—';
  const entries = [...agg.entries()];
  const topScorers = entries.filter(([, a]) => a.goals > 0)
    .map(([id, a]) => ({ name: name(id), value: a.goals }))
    .sort((x, y) => y.value - x.value).slice(0, 5);
  const topAssists = entries.filter(([, a]) => a.assists > 0)
    .map(([id, a]) => ({ name: name(id), value: a.assists }))
    .sort((x, y) => y.value - x.value).slice(0, 5);
  const topRated = entries.filter(([, a]) => a.ratingN > 0)
    .map(([id, a]) => ({ name: name(id), value: Math.round((a.ratingSum / a.ratingN) * 100) / 100 }))
    .sort((x, y) => y.value - x.value).slice(0, 5);

  const seasonIds = seasonId === 'all'
    ? (await listSeasons(careerId)).map((s) => s.id)
    : [seasonId];
  let records = seasonIds.length ? await db.teamRecords.where('season_id').anyOf(seasonIds).toArray() : [];
  const wins = records.reduce((n, r) => n + r.wins, 0);
  const draws = records.reduce((n, r) => n + r.draws, 0);
  const losses = records.reduce((n, r) => n + r.losses, 0);
  const goalsFor = records.reduce((n, r) => n + r.goals_for, 0);
  const goalsAgainst = records.reduce((n, r) => n + r.goals_against, 0);
  // 表示用：リーグ→国内カップ→大陸間 の順
  const order: Record<string, number> = { 'リーグ': 0, '国内カップ': 1, '大陸間クラブ選手権': 2 };
  records = records.slice().sort((a, b) => (order[a.competition_type] ?? 9) - (order[b.competition_type] ?? 9));

  return {
    seasonId,
    totalPlayers: roster.length,
    academyCount: roster.filter((p) => p.is_academy).length,
    topScorers, topAssists, topRated,
    records, goalsFor, goalsAgainst, wins, draws, losses,
  };
}
