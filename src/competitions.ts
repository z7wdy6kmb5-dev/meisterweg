import type { CompetitionType } from './types';

// 大会名の選択肢（区分ごと・キャリアごと）。ユーザーが追加でき、選択式で使う。
// UIの選択肢（設定）的なデータなので localStorage に保持する。
const KEY_PREFIX = 'meisterweg.compNames.';

type Store = Record<CompetitionType, string[]>;

// 初期候補（よくある大会名）。ユーザーが追加・利用すると蓄積される。
const DEFAULTS: Store = {
  'リーグ': ['ブンデスリーガ', 'プレミアリーグ', 'ラ・リーガ', 'セリエA', 'リーグ・アン'],
  '国内カップ': ['DFBポカール', 'FAカップ', 'コパ・デル・レイ', 'コッパ・イタリア', 'クープ・ドゥ・フランス'],
  '大陸間クラブ選手権': ['UEFAチャンピオンズリーグ', 'UEFAヨーロッパリーグ', 'UEFAカンファレンスリーグ'],
};

function load(careerId: string): Store {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + careerId);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Store>;
      return {
        'リーグ': parsed['リーグ'] ?? DEFAULTS['リーグ'],
        '国内カップ': parsed['国内カップ'] ?? DEFAULTS['国内カップ'],
        '大陸間クラブ選手権': parsed['大陸間クラブ選手権'] ?? DEFAULTS['大陸間クラブ選手権'],
      };
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

function save(careerId: string, store: Store): void {
  localStorage.setItem(KEY_PREFIX + careerId, JSON.stringify(store));
}

export function getCompetitionNames(careerId: string, type: CompetitionType): string[] {
  return load(careerId)[type];
}

/** 区分に大会名を追加（重複は無視）。追加後の一覧を返す。 */
export function addCompetitionName(careerId: string, type: CompetitionType, name: string): string[] {
  const n = name.trim();
  const store = load(careerId);
  if (n && !store[type].includes(n)) {
    store[type] = [...store[type], n];
    save(careerId, store);
  }
  return store[type];
}
