import { useState } from 'react';
import { createCareer } from '../repo';
import type { Career } from '../types';

interface Props {
  onCreated: (career: Career) => void;
  onClose: () => void;
}

// 新規キャリア作成モーダル。
// 開始シーズンは createCareer 側で Season レコードを1件自動生成する。
export function NewCareerModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [startSeason, setStartSeason] = useState('25-26');
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim() && teamName.trim() && startSeason.trim() && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const career = await createCareer({
        name,
        team_name: teamName,
        team_code: teamCode,
        start_season: startSeason,
      });
      onCreated(career);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>新しいキャリアを作成</h3>
          <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          <div className="field-grid">
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>キャリア名</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：FC26 マンハイム監督キャリア"
                autoFocus
              />
            </div>
            <div className="field">
              <label>チーム名</label>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="例：マンハイム"
              />
            </div>
            <div className="field">
              <label>チーム略号（表示コード用）</label>
              <input
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                placeholder="例：WM"
                maxLength={5}
              />
            </div>
            <div className="field">
              <label>開始シーズン</label>
              <input
                value={startSeason}
                onChange={(e) => setStartSeason(e.target.value)}
                placeholder="例：25-26"
              />
            </div>
          </div>
          <p className="muted" style={{ marginTop: 14, fontSize: '0.82rem', lineHeight: 1.6 }}>
            開始シーズンは最初のシーズンとして自動で登録されます。選手やスタッツの追加は次の段階で実装予定です。
          </p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn--primary" onClick={submit} disabled={!canSubmit}>
            {busy ? '作成中…' : '作成する'}
          </button>
        </div>
      </div>
    </div>
  );
}
