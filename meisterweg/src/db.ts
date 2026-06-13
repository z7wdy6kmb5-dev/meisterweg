import Dexie, { type Table } from 'dexie';
import type {
  Career,
  Season,
  Player,
  SeasonStats,
  Transfer,
  TeamRecord,
  SeasonMemo,
  Constraint,
} from './types';

// ============================================================
// IndexedDB（Dexie）— 永続ストレージ
//
// 設計方針:
// - 全エンティティのテーブルを段階1で定義し、DBスキーマを安定させる。
//   後続段階で新テーブルを足してバージョンを上げると、その都度マイグレーション
//   が必要になるため、テーブル構造は最初に確定しておく。
// - データはブラウザのディスクに永続保存される。タブ・ブラウザを閉じても、
//   PC再起動しても消えない。再デプロイ（コード更新）でも消えない。
//   ＝ コードとデータを独立させる原則。
//
// 「Dexie のDBバージョン」と「アプリの schema_version」は別物:
// - Dexie バージョン: IndexedDB のオブジェクトストア構造（インデックス定義）
// - schema_version : データ"中身"の形。レコードに持たせ、起動時に
//   migrations.ts でデータ変換する（指示書のスキーマバージョニング要件）。
// ============================================================

export class MeisterwegDB extends Dexie {
  careers!: Table<Career, string>;
  seasons!: Table<Season, string>;
  players!: Table<Player, string>;
  seasonStats!: Table<SeasonStats, string>;
  transfers!: Table<Transfer, string>;
  teamRecords!: Table<TeamRecord, string>;
  seasonMemos!: Table<SeasonMemo, string>;
  constraints!: Table<Constraint, string>;

  constructor() {
    super('meisterweg');

    // バージョン1: 全テーブルを定義。
    // 主キーは id。検索に使う外部キー/並び順をインデックス化。
    this.version(1).stores({
      careers: 'id, created_at',
      seasons: 'id, career_id, order',
      players: 'id, career_id, current_status, join_season_id',
      seasonStats: 'id, player_id, season_id, [season_id+player_id]',
      transfers: 'id, player_id, season_id',
      teamRecords: 'id, season_id, competition_type',
      seasonMemos: 'id, season_id, [season_id+month]',
      constraints: 'id, career_id, template_key',
    });
  }
}

export const db = new MeisterwegDB();
