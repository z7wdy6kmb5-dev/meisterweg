import { useState } from 'react';
import { createSeason } from '../repo';
import { useApp } from '../AppContext';

interface Props {
  onClose: () => void;
  onCreated: (seasonId: string) => void;
}

// 新シーズン作成。作成時に在籍選手のスタッツ行を自動展開する（3-6）。
export function NewSeasonModal({ onClose, onCreated }: Props) {
  const { currentCareer, seasons } = useApp();
  const lastLabel = seasons.length ? seasons[seasons.length - 1].label : '';
  const [label, setLabel] = useState(suggestNext(lastLabel));
  const [includeLoan, setIncludeLoan] = useState(true);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!currentCareer || !label.trim() || busy) return;
    setBusy(true);
    try {
      const s = await createSeason(currentCareer.id, label, includeLoan);
      onCreated(s.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>新しいシーズンを作成</h3>
          <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          <div className="field">
            <label>シーズン表記</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例：26-27"
              autoFocus
            />
          </div>
          <label className="row mt-16" style={{ gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeLoan}
              onChange={(e) => setIncludeLoan(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <span className="info-line">レンタル中の選手も新シーズンに展開する</span>
          </label>
          <p className="info-line mt-16">
            在籍中の選手は、新シーズンのスタッツ行が自動で用意されます（数値は後から入力）。
            退団済みの選手は対象外です。
          </p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn--primary" onClick={submit} disabled={!label.trim() || busy}>
            {busy ? '作成中…' : 'シーズンを作成'}
          </button>
        </div>
      </div>
    </div>
  );
}

// 「25-26」→「26-27」のような次シーズン候補を推定（失敗時は空）。
function suggestNext(label: string): string {
  const m = label.match(/^(\d{2})\s*[-/]\s*(\d{2})$/);
  if (!m) return '';
  const a = (parseInt(m[1], 10) + 1) % 100;
  const b = (parseInt(m[2], 10) + 1) % 100;
  return `${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
}
