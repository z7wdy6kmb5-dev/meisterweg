import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  listTeamRecords, createTeamRecord, updateTeamRecord, deleteTeamRecord,
  type TeamRecordInput,
} from '../repo';
import { useApp } from '../AppContext';
import { COMPETITION_TYPES, type CompetitionType, type TeamRecord } from '../types';

// チーム成績（選択中シーズンの大会別成績）。
export function RecordsPage() {
  const { currentSeason } = useApp();
  const records = useLiveQuery(
    () => (currentSeason ? listTeamRecords(currentSeason.id) : Promise.resolve([])),
    [currentSeason?.id],
    [],
  );
  const [editing, setEditing] = useState<TeamRecord | null>(null);
  const [creating, setCreating] = useState(false);

  if (!currentSeason) {
    return (
      <div className="card card--pad">
        <p className="info-line">シーズンがありません。ヘッダーの「＋ シーズン」から作成してください。</p>
      </div>
    );
  }

  // 大会種別の順で並べる
  const order = (t: CompetitionType) => COMPETITION_TYPES.indexOf(t);
  const sorted = (records ?? []).slice().sort((a, b) => order(a.competition_type) - order(b.competition_type));

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>チーム成績</h1>
          <span className="sub">{currentSeason.label}・{sorted.length} 大会</span>
        </div>
        <button className="btn btn--primary" onClick={() => setCreating(true)}>＋ 成績を追加</button>
      </div>

      {sorted.length === 0 ? (
        <div className="card card--pad">
          <div className="empty" style={{ padding: '40px 12px' }}>
            <h2>このシーズンの成績がありません</h2>
            <p>リーグ・国内カップ・欧州カップなどの最終順位や勝敗を登録できます。</p>
            <button className="btn btn--primary" onClick={() => setCreating(true)}>＋ 成績を追加</button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>区分</th>
                <th>大会</th>
                <th>最終順位 / 到達</th>
                <th className="td-num">勝</th>
                <th className="td-num">分</th>
                <th className="td-num">敗</th>
                <th className="td-num">得点</th>
                <th className="td-num">失点</th>
                <th className="td-num">得失差</th>
                <th>メモ</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} onClick={() => setEditing(r)}>
                  <td><span className="pill">{r.competition_type}</span></td>
                  <td className="td-name">{r.competition_name}</td>
                  <td>{r.final_position || '—'}</td>
                  <td className="td-num">{r.wins}</td>
                  <td className="td-num">{r.draws}</td>
                  <td className="td-num">{r.losses}</td>
                  <td className="td-num">{r.goals_for}</td>
                  <td className="td-num">{r.goals_against}</td>
                  <td className="td-num">{signed(r.goals_for - r.goals_against)}</td>
                  <td style={{ whiteSpace: 'normal', maxWidth: 240 }}>{r.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(editing || creating) && (
        <RecordModal
          record={editing}
          seasonId={currentSeason.id}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function RecordModal({ record, seasonId, onClose }: { record: TeamRecord | null; seasonId: string; onClose: () => void }) {
  const [f, setF] = useState<TeamRecordInput>(() => init(record));
  const [busy, setBusy] = useState(false);
  const isEdit = !!record;

  function set<K extends keyof TeamRecordInput>(k: K, v: TeamRecordInput[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }
  function num(v: string): number { return v === '' ? 0 : Number(v); }

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
              <select value={f.competition_type} onChange={(e) => set('competition_type', e.target.value as CompetitionType)}>
                {COMPETITION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>大会名</label>
              <input value={f.competition_name} onChange={(e) => set('competition_name', e.target.value)} placeholder="例：ブンデスリーガ" autoFocus />
            </div>
            <div className="field">
              <label>最終順位 / 到達ラウンド</label>
              <input value={f.final_position} onChange={(e) => set('final_position', e.target.value)} placeholder="例：1位 / ベスト8 / 優勝" />
            </div>
            <div className="field"><label>勝</label><input type="number" value={f.wins} onChange={(e) => set('wins', num(e.target.value))} /></div>
            <div className="field"><label>分</label><input type="number" value={f.draws} onChange={(e) => set('draws', num(e.target.value))} /></div>
            <div className="field"><label>敗</label><input type="number" value={f.losses} onChange={(e) => set('losses', num(e.target.value))} /></div>
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

function init(r: TeamRecord | null): TeamRecordInput {
  if (r) {
    return {
      competition_type: r.competition_type,
      competition_name: r.competition_name,
      final_position: r.final_position,
      wins: r.wins, draws: r.draws, losses: r.losses,
      goals_for: r.goals_for, goals_against: r.goals_against, note: r.note,
    };
  }
  return {
    competition_type: 'リーグ',
    competition_name: '',
    final_position: '',
    wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, note: '',
  };
}
