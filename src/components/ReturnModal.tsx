import { useState } from 'react';
import { recordReturn, type TransferInput } from '../repo';
import type { Player, Season, Transfer } from '../types';

interface Props {
  player: Player;
  seasons: Season[];
  defaultSeasonId: string;
  onClose: () => void;
  onDone: () => void;
}

const WINDOWS: Transfer['window'][] = ['夏', '冬'];
// 復帰種別は内部的には移籍/フリーを流用（買い戻し=移籍, レンタル終了/フリー復帰=フリー）。
const TYPE_OPTIONS: { value: Transfer['type']; label: string }[] = [
  { value: '移籍', label: '買い戻し・有償' },
  { value: 'フリー', label: 'フリー・レンタル終了' },
];

// 復帰記録モーダル。退団記録と同様のUI。記録は選手の移籍履歴にのみ残る（移籍タブには出さない）。
export function ReturnModal({ player, seasons, defaultSeasonId, onClose, onDone }: Props) {
  const [f, setF] = useState<TransferInput>({
    season_id: defaultSeasonId || seasons[0]?.id || '',
    window: '夏',
    type: 'フリー',
    fee: 0,
    market_value_at_time: 0,
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
      await recordReturn(player.id, f);
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
            <h3>復帰を記録</h3>
            <span className="td-code">{player.name}</span>
          </div>
          <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          <div className="field-grid">
            <div className="field">
              <label>復帰シーズン</label>
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
              <label>復帰種別</label>
              <select value={f.type} onChange={(e) => set('type', e.target.value as Transfer['type'])}>
                {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>買い戻し額 (€)</label>
              <input
                type="number"
                value={f.fee}
                onChange={(e) => set('fee', e.target.value === '' ? 0 : Number(e.target.value))}
                disabled={f.type === 'フリー'}
              />
            </div>
            <div className="field">
              <label>復帰時市場価値 (€)</label>
              <input
                type="number"
                value={f.market_value_at_time}
                onChange={(e) => set('market_value_at_time', e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>復帰元クラブ</label>
              <input value={f.destination} onChange={(e) => set('destination', e.target.value)} placeholder="例：レンタル先のクラブ名" />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>理由</label>
              <input value={f.reason} onChange={(e) => set('reason', e.target.value)} placeholder="例：レンタル満了で復帰 / 買い戻し条項を行使 など" />
            </div>
          </div>
          <p className="info-line mt-16">保存すると、この選手は「在籍（復帰）」に戻ります。この記録は選手の移籍履歴にのみ表示され、移籍タブには出ません。</p>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn--primary" onClick={submit} disabled={!f.season_id || busy}>
            {busy ? '記録中…' : '復帰を記録'}
          </button>
        </div>
      </div>
    </div>
  );
}
