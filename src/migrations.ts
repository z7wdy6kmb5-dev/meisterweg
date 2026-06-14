import { db } from './db';
import { CURRENT_SCHEMA_VERSION, type Career } from './types';

// ============================================================
// スキーマバージョニング / マイグレーション（指示書 第1章）
//
// 各レコードは schema_version を持つ。将来データ構造を変えた際に、
// 旧構造→新構造の変換を関数として登録する。
// 起動時に runMigrations() を呼び、古いバージョンのデータを順次変換する。
//
// 段階1時点では v1 のみ。変換は不要だが、「仕組み」を最初から用意しておくのが
// この段階の主目的。後続でフィールドを足したら、ここに migration を追加する。
//
// 例（将来 v2 で Player に新フィールドを足す場合）:
//   2: async () => {
//     await db.players.toCollection().modify((p) => {
//       (p as any).new_field = defaultValue;
//     });
//   }
// ============================================================

type MigrationFn = () => Promise<void>;

/** key = 「このバージョンへ上げるための」変換。v1 は初期状態なので変換不要。 */
const migrations: Record<number, MigrationFn> = {
  // 1: 初期スキーマ。変換なし。
  // 2: Transfer に kind（退団/復帰）を追加。既存レコードは全て「退団(departure)」とみなす。
  2: async () => {
    await db.transfers.toCollection().modify((t) => {
      const rec = t as { kind?: 'departure' | 'return' };
      if (!rec.kind) rec.kind = 'departure';
    });
  },
  // 3: TeamRecord の区分「欧州カップ」を「大陸間クラブ選手権」へ改称。
  3: async () => {
    await db.teamRecords.toCollection().modify((r) => {
      const rec = r as { competition_type?: string };
      if (rec.competition_type === '欧州カップ') rec.competition_type = '大陸間クラブ選手権';
    });
  },
  // 4: Constraint に note（縛り内容の自由記入）を追加。
  4: async () => {
    await db.constraints.toCollection().modify((c) => {
      const rec = c as { note?: string };
      if (rec.note == null) rec.note = '';
    });
  },
};

/**
 * 全キャリアの schema_version を確認し、CURRENT_SCHEMA_VERSION まで引き上げる。
 * Career の schema_version を「そのキャリア配下データ全体のバージョン」とみなす。
 */
export async function runMigrations(): Promise<void> {
  const careers = await db.careers.toArray();

  for (const career of careers) {
    let version = career.schema_version ?? 1;

    while (version < CURRENT_SCHEMA_VERSION) {
      const next = version + 1;
      const migrate = migrations[next];
      if (migrate) {
        await migrate();
      }
      version = next;
    }

    if (version !== career.schema_version) {
      await db.careers.update(career.id, { schema_version: version });
    }
  }
}

/**
 * インポートされたバンドルの schema_version を確認し、必要なら変換する。
 * （段階7のインポートで使用。段階1では枠のみ用意。）
 */
export function isBundleVersionSupported(version: number): boolean {
  return version <= CURRENT_SCHEMA_VERSION;
}

/** 新規 Career 作成時に現行バージョンを刻む際のヘルパ。 */
export function stampCurrentVersion(): Pick<Career, 'schema_version'> {
  return { schema_version: CURRENT_SCHEMA_VERSION };
}
