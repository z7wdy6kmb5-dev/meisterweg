import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  listTeamRecords, createTeamRecord, updateTeamRecord, deleteTeamRecord,
  type TeamRecordInput,
} from '../repo';
import { getCompetitionNames, addCompetitionName } from '../competitions';
import { useApp } from '../AppContext';
import { COMPETITION_TYPES, type CompetitionType, type TeamRecord } from '../types';

// チーム成績（選択中シーズン）。区分ごとにテーブルを分けて表示する。
export function RecordsPage() {
  const { currentCareer, currentSeason } = useApp();
  const records = useLiveQuery(
    () => (currentSeason ? listTeamRecords(currentSeason.id) : Promise.resolve([])),
    [currentSeason?.id],
    [],
  );
  const [editing, setEditing] = useState<TeamRecord | null>(null);
  const [creatingType, setCreatingType] = useState<CompetitionType | null>(null);

  if (!currentSeason || !currentCareer) {
    return (
      <div className="card card--pad">
        <p className="info-line">シーズンがありません。ヘッダーの「＋ シーズン」から作成してください。</p>
      </div>
    );
  }

  const all = records ?? [];

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>チーム成績</h1>
          <span className="sub">{currentSeason.label}・{all.length} 大会</span>
        </div>
      </div>

      {COMPETITION_TYPES.map((type) => {
        const rows = all.filter((r) => r.competition_type === type);
        return (
          <section key={type} className="comp-section">
            <div className="comp-section__head">
              <h2>{type}</h2>
              <button className="btn btn--ghost" onClick={() => setCreatingType(type)}>＋ 追加</button>
            </div>
            {rows.length === 0 ? (
              <div className="card card--pad"><p className="info-line">この区分の成績はまだありません。</p></div>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <CompHead type={type} />
                  <tbody>
                    {rows.map((r) => <CompRow key={r.id} type={type} r={r} onClick={() => setEditing(r)} />)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      {(editing || creatingType) && (
        <RecordModal
          careerId={currentCareer.id}
          record={editing}
          presetType={creatingType ?? undefined}
          seasonId={currentSeason.id}
          onClose={() => { setEditing(null); setCreatingType(null); }}
        />
      )}
    </div>
  );
}

function signed(n: number): string { return n > 0 ? `+${n}` : String(n); }

// 区分別のヘッダー。
function CompHead({ type }: { type: CompetitionType }) {
  if (type === 'リーグ') {
    return (
      <thead><tr>
        <th>大会</th><th>最終順位</th>
        <th className="td-num">勝</th><th className="td-num">分</th><th className="td-num">敗</th>
        <th className="td-num">得点</th><th className="td-num">失点</th><th className="td-num">得失差</th><th>メモ</th>
      </tr></thead>
    );
  }
  if (type === '国内カップ') {
    return (
      <thead><tr>
        <th>大会</th><th>到達ラウンド</th>
        <th className="td-num">得点</th><th className="td-num">失点</th><th>メモ</th>
      </tr></thead>
    );
  }
  // 大陸間クラブ選手権
  return (
    <thead><tr>
      <th>大会</th><th>リーグフェーズ順位</th><th>到達ラウンド</th>
      <th className="td-num">得点</th><th className="td-num">失点</th><th>メモ</th>
    </tr></thead>
  );
}

// 区分別の行。
function CompRow({ type, r, onClick }: { type: CompetitionType; r: TeamRecord; onClick: () => void }) {
  const note = <td style={{ whiteSpace: 'normal', maxWidth: 240 }}>{r.note || '—'}</td>;
  if (type === 'リーグ') {
    return (
      <tr onClick={onClick}>
        <td className="td-name">{r.competition_name}</td>
        <td>{r.final_position || '—'}</td>
        <td className="td-num">{r.wins}</td>
        <td className="td-num">{r.draws}</td>
        <td className="td-num">{r.losses}</td>
        <td className="td-num">{r.goals_for}</td>
        <td className="td-num">{r.goals_against}</td>
        <td className="td-num">{signed(r.goals_for - r.goals_against)}</td>
        {note}
      </tr>
    );
  }
  if (type === '国内カップ') {
    return (
      <tr onClick={onClick}>
        <td className="td-name">{r.competition_name}</td>
        <td>{r.final_position || '—'}</td>
        <td className="td-num">{r.goals_for}</td>
        <td className="td-num">{r.goals_against}</td>
        {note}
      </tr>
    );
  }
  return (
    <tr onClick={onClick}>
      <td className="td-name">{r.competition_name}</td>
      <td>{r.league_phase_position || '—'}</td>
      <td>{r.final_position || '—'}</td>
      <td className="td-num">{r.goals_for}</td>
      <td className="td-num">{r.goals_against}</td>
      {note}
    </tr>
  );
}

function RecordModal({
  careerId, record, presetType, seasonId, onClose,
}: { careerId: string; record: TeamRecord | null; presetType?: CompetitionType; seasonId: string; onClose: () => void }) {
  const [f, setF] = useState<TeamRecordInput>(() => {
    const base = init(record, presetType);
    if (!record) {
      const list = getCompetitionNames(careerId, base.competition_type);
      base.competition_name = list[0] ?? '';
    }
    return base;
  });
  const [names, setNames] = useState<string[]>(() => getCompetitionNames(careerId, record?.competition_type ?? presetType ?? 'リーグ'));
  const [addingName, setAddingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const isEdit = !!record;
  const isLeague = f.competition_type === 'リーグ';
  const isCup = f.competition_type === '国内カップ';
  const isInter = f.competition_type === '大陸間クラブ選手権';

  function set<K extends keyof TeamRecordInput>(k: K, v: TeamRecordInput[K]) { setF((p) => ({ ...p, [k]: v })); }
  function num(v: string): number { return v === '' ? 0 : Number(v); }

  function changeType(type: CompetitionType) {
    const list = getCompetitionNames(careerId, type);
    setNames(list);
    setF((p) => ({ ...p, competition_type: type, competition_name: list[0] ?? '' }));
  }

  function confirmAddName() {
    const list = addCompetitionName(careerId, f.competition_type, newName);
    setNames(list);
    set('competition_name', newName.trim());
    setNewName(''); setAddingName(false);
  }

  async function save() {
    if (!f.competition_name.trim() || busy) return;
    setBusy(true);
    try {
      if (record) await updateTeamRecord(record.id, f);
      else await createTeamRecord(seasonId, f);
      onClose();
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!record) return;
    if (!window.confirm(`「${record.competition_name}」の成績を削除しますか？`)) return;
    await deleteTeamRecord(record.id);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isEdit ? '成績を編集' : '成績を追加'}</h3>
          <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          <div className="field-grid">
            <div className="field">
              <label>区分</label>
              <select value={f.competition_type} onChange={(e) => changeType(e.target.value as CompetitionType)}>
                {COMPETITION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>大会名</label>
              {addingName ? (
                <div className="row" style={{ gap: 6 }}>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="新しい大会名" autoFocus />
                  <button className="btn btn--primary" style={{ padding: '8px 12px' }} onClick={confirmAddName} disabled={!newName.trim()}>追加</button>
                  <button className="btn btn--ghost" style={{ padding: '8px 12px' }} onClick={() => setAddingName(false)}>取消</button>
                </div>
              ) : (
                <div className="row" style={{ gap: 6 }}>
                  <select value={f.competition_name} onChange={(e) => set('competition_name', e.target.value)} style={{ flex: 1 }}>
                    {names.length === 0 && <option value="">（候補なし）</option>}
                    {names.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button className="btn btn--ghost" style={{ padding: '8px 12px' }} onClick={() => setAddingName(true)} title="大会名を追加">＋</button>
                </div>
              )}
            </div>

            {/* 区分別の入力項目 */}
            {isInter && (
              <div className="field">
                <label>リーグフェーズ順位</label>
                <input value={f.league_phase_position} onChange={(e) => set('league_phase_position', e.target.value)} placeholder="例：8位 / 12位" />
              </div>
            )}
            {isLeague && (
              <div className="field">
                <label>最終順位</label>
                <input value={f.final_position} onChange={(e) => set('final_position', e.target.value)} placeholder="例：1位" />
              </div>
            )}
            {(isCup || isInter) && (
              <div className="field">
                <label>到達ラウンド</label>
                <input value={f.final_position} onChange={(e) => set('final_position', e.target.value)} placeholder="例：ベスト8 / 優勝" />
              </div>
            )}

            {isLeague && (
              <>
                <div className="field"><label>勝</label><input type="number" value={f.wins} onChange={(e) => set('wins', num(e.target.value))} /></div>
                <div className="field"><label>分</label><input type="number" value={f.draws} onChange={(e) => set('draws', num(e.target.value))} /></div>
                <div className="field"><label>敗</label><input type="number" value={f.losses} onChange={(e) => set('losses', num(e.target.value))} /></div>
              </>
            )}

            <div className="field"><label>得点</label><input type="number" value={f.goals_for} onChange={(e) => set('goals_for', num(e.target.value))} /></div>
            <div className="field"><label>失点</label><input type="number" value={f.goals_against} onChange={(e) => set('goals_against', num(e.target.value))} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>メモ</label>
              <input value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="例：終盤に失速も逃げ切り など" />
            </div>
          </div>
        </div>
        <div className="modal__foot">
          {isEdit && <button className="btn btn--danger" onClick={remove} style={{ marginRight: 'auto' }}>削除</button>}
          <button className="btn btn--ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn--primary" onClick={save} disabled={!f.competition_name.trim() || busy}>
            {busy ? '保存中…' : isEdit ? '保存' : '追加'}
          </button>
        </div>
      </div>
    </div>
  );
}

function init(r: TeamRecord | null, presetType?: CompetitionType): TeamRecordInput {
  if (r) {
    return {
      competition_type: r.competition_type,
      competition_name: r.competition_name,
      final_position: r.final_position,
      league_phase_position: r.league_phase_position ?? '',
      wins: r.wins, draws: r.draws, losses: r.losses,
      goals_for: r.goals_for, goals_against: r.goals_against, note: r.note,
    };
  }
  return {
    competition_type: presetType ?? 'リーグ',
    competition_name: '',
    final_position: '',
    league_phase_position: '',
    wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, note: '',
  };
}
