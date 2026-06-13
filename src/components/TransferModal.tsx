import { useState } from 'react';
import { recordDeparture, type TransferInput } from '../repo';
import type { Player, Season, Transfer } from '../types';

interface Props {
  player: Player;
  seasons: Season[];
  defaultSeasonId: string;
  onClose: () => void;
  onDone: () => void;
}

const WINDOWS: Transfer['window'][] = ['夏', '冬'];
const TYPES: Transfer['type'][] = ['移籍', 'フリー'];

// 退団記録モーダル。保存すると Transfer を作成し、選手を「退団」にする。
export function TransferModal({ player, seasons, defaultSeasonId, onClose, onDone }: Props) {
  const [f, setF] = useState<TransferInput>({
    season_id: defaultSeasonId || seasons[0]?.id || '',
    window: '夏',
    type: '移籍',
    fee: 0,
    market_value_at_time: player.join_market_value ?? 0,
    destination: '',
    reason: '',
  });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof TransferInput>(k: K, v: TransferInput[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    if (!f.season_id || busy) return;
    setBusy(true);
    try {
      await recordDeparture(player.id, f);
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 60 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <div>
            <h3>退団を記録</h3>
            <span className="td-code">{player.name}</span>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          <div className="field-grid">
            <div className="field">
              <label>退団シーズン</label>
              <select value={f.season_id} onChange={(e) => set('season_id', e.target.value)}>
                {seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>ウィンドウ</label>
              <select value={f.window} onChange={(e) => set('window', e.target.value as Transfer['window'])}>
                {WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div className="field">
              <label>種別</label>
              <select value={f.type} onChange={(e) => set('type', e.target.value as Transfer['type'])}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>移籍金 (€)</label>
              <input
                type="number"
                value={f.fee}
                onChange={(e) => set('fee', e.target.value === '' ? 0 : Number(e.target.value))}
                disabled={f.type === 'フリー'}
              />
            </div>
            <div className="field">
              <label>退団時市場価値 (€)</label>
              <input
                type="number"
                value={f.market_value_at_time}
                onChange={(e) => set('market_value_at_time', e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>移籍先</label>
              <input value={f.destination} onChange={(e) => set('destination', e.target.value)} placeholder="例：レアル・マドリード" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>理由</label>
              <input value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder="例：契約満了 / ステップアップ など" />
            </div>
          </div>
          <p className="info-line mt-16">保存すると、この選手は「退団」になります。後で「復帰させる」で在籍に戻せます（記録は履歴として残ります）。</p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn--danger" onClick={submit} disabled={!f.season_id || busy}>
            {busy ? '記録中…' : '退団を記録'}
          </button>
        </div>
      </div>
    </div>
  );
}
