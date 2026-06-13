import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createPlayer, updatePlayer, deletePlayer, getPlayerAggregates,
  listTransfersForPlayer, deleteTransfer,
  type PlayerInput,
} from '../repo';
import { useApp } from '../AppContext';
import {
  POSITIONS, JOIN_TYPES,
  type Player, type Position, type JoinType,
} from '../types';
import { TransferModal } from './TransferModal';
import { ReturnModal } from './ReturnModal';
import { formatMoney, formatNumber } from '../format';

type Mode = 'view' | 'edit' | 'new';

interface Props {
  player: Player | null; // null = 新規
  onClose: () => void;
}

// 6カテゴリの内部フィールド（順序固定）。GK でもこの6フィールドを流用する（指示書 2.3 注）。
const SIX_KEYS = [
  'join_pace', 'join_shooting', 'join_passing',
  'join_dribbling', 'join_defending', 'join_physical',
] as const;

const OUTFIELD_LABELS = ['ペース', 'シュート', 'パス', 'ドリブル', '守備', 'フィジカル'];
// GK はゲーム内の6ステータス表示に合わせてラベルだけ差し替える（データは同じフィールド）。
const GK_LABELS = ['ダイビング', 'ハンドリング', 'キック', '反射神経', 'スピード', 'ポジショニング'];

/** ポジションに応じた [フィールドキー, 表示ラベル] の6組を返す。 */
function sixFields(position: Position): ReadonlyArray<readonly [typeof SIX_KEYS[number], string]> {
  const labels = position === 'GK' ? GK_LABELS : OUTFIELD_LABELS;
  return SIX_KEYS.map((k, i) => [k, labels[i]] as const);
}

export function PlayerModal({ player, onClose }: Props) {
  const { currentCareer, seasons, currentSeason } = useApp();
  const [mode, setMode] = useState<Mode>(player ? 'view' : 'new');
  const [showTransfer, setShowTransfer] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  // このモーダルを開いている間に退団／復帰を記録したら、左下のアクションボタンを隠す。
  const [actionTaken, setActionTaken] = useState(false);

  const defaultSeasonId = currentSeason?.id ?? seasons[0]?.id ?? '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        {mode === 'view' && player ? (
          <ProfileView
            player={player}
            actionTaken={actionTaken}
            onEdit={() => setMode('edit')}
            onClose={onClose}
            onDepart={() => setShowTransfer(true)}
            onReturn={() => setShowReturn(true)}
          />
        ) : (
          <PlayerForm
            player={mode === 'edit' ? player : null}
            careerId={currentCareer!.id}
            seasons={seasons}
            defaultSeasonId={defaultSeasonId}
            onCancel={() => (player ? setMode('view') : onClose())}
            onSaved={() => (player ? setMode('view') : onClose())}
            onDeleted={onClose}
          />
        )}
      </div>

      {showTransfer && player && (
        <TransferModal
          player={player}
          seasons={seasons}
          defaultSeasonId={defaultSeasonId}
          onClose={() => setShowTransfer(false)}
          onDone={() => { setShowTransfer(false); setActionTaken(true); setMode('view'); }}
        />
      )}
      {showReturn && player && (
        <ReturnModal
          player={player}
          seasons={seasons}
          defaultSeasonId={defaultSeasonId}
          onClose={() => setShowReturn(false)}
          onDone={() => { setShowReturn(false); setActionTaken(true); setMode('view'); }}
        />
      )}
    </div>
  );
}

// ---- プロフィール表示（4.5.3） ----
function ProfileView({ player, actionTaken, onEdit, onClose, onDepart, onReturn }: {
  player: Player; actionTaken: boolean; onEdit: () => void; onClose: () => void; onDepart: () => void; onReturn: () => void;
}) {
  const { seasons } = useApp();
  const agg = useLiveQuery(() => getPlayerAggregates(player.id), [player.id]);
  const transfers = useLiveQuery(() => listTransfersForPlayer(player.id), [player.id]);
  const joinSeason = seasons.find((s) => s.id === player.join_season_id);
  const orderById = new Map(seasons.map((s) => [s.id, s.order]));
  const seasonLabel = (id: string) => seasons.find((s) => s.id === id)?.label ?? '—';
  const sortedTransfers = (transfers ?? []).slice()
    .sort((a, b) => (orderById.get(b.season_id) ?? 0) - (orderById.get(a.season_id) ?? 0));
  const isOut = player.current_status === '退団';

  return (
    <>
      <div className="modal__head">
        <div>
          <h3>{player.name}</h3>
          <span className="td-code">{player.display_code}</span>
        </div>
        <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
      </div>
      <div className="modal__body">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="pill pill--pos">{player.position}</span>
          <span className="pill">{player.nationality || '国籍未設定'}</span>
          <span className="pill">{player.height_cm ? `${player.height_cm}cm` : '身長未設定'}</span>
          <StatusPill status={player.current_status} />
          {player.is_on_loan && <span className="pill pill--loan">レンタル中</span>}
          {player.is_academy && <span className="pill">アカデミー出身</span>}
        </div>

        <div className="subhead">サマリー</div>
        <div className="profile-grid">
          <Box k="現OVR" v={agg ? formatNumber(agg.currentOvr) : '…'} />
          <Box k="初期OVR" v={formatNumber(player.join_ovr)} />
          <Box k="総得点" v={agg ? formatNumber(agg.goals) : '…'} />
          <Box k="総アシスト" v={agg ? formatNumber(agg.assists) : '…'} />
          <Box k="総試合数" v={agg ? formatNumber(agg.appearances) : '…'} />
        </div>

        <div className="subhead">初期能力値（加入時）</div>
        <div className="profile-grid">
          {sixFields(player.position).map(([key, label]) => (
            <Box key={key} k={label} v={formatNumber(player[key])} />
          ))}
        </div>

        <div className="subhead">加入情報</div>
        <div className="profile-grid">
          <Box k="加入シーズン" v={joinSeason?.label ?? '—'} />
          <Box k="加入種別" v={player.join_type} />
          <Box k="加入時移籍金" v={formatMoney(player.join_fee)} />
          <Box k="加入時給与" v={formatMoney(player.join_wage)} />
          <Box k="加入時市場価値" v={formatMoney(player.join_market_value)} />
        </div>

        <div className="subhead">移籍履歴</div>
        {sortedTransfers.length === 0 ? (
          <p className="info-line">移籍記録はありません。{isOut ? '下の「復帰させる」で復帰を記録できます。' : '下の「退団記録」から退団を登録できます。'}</p>
        ) : (
          <div className="transfer-history">
            {sortedTransfers.map((t) => {
              const isReturn = t.kind === 'return';
              return (
                <div key={t.id} className="transfer-row">
                  <div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className={isReturn ? 'pill pill--active' : 'pill pill--out'}>{isReturn ? '復帰' : '退団'}</span>
                      <span className="pill pill--pos">{seasonLabel(t.season_id)}</span>
                      <span className="pill">{t.window}</span>
                      <span className="pill">{t.type}</span>
                    </div>
                    <div className="info-line" style={{ marginTop: 4 }}>
                      {(isReturn ? '復帰元 ' : '移籍先 ')}{t.destination || '未記入'} ・ {isReturn ? '買い戻し' : '移籍金'} {formatMoney(t.fee)} ・ 市場価値 {formatMoney(t.market_value_at_time)}
                      {t.reason ? ` ・ ${t.reason}` : ''}
                    </div>
                  </div>
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '6px 10px' }}
                    title="この記録を削除"
                    onClick={() => { if (window.confirm('この記録を削除しますか？')) void deleteTransfer(t.id); }}
                  >🗑</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="modal__foot">
        {!actionTaken && (isOut ? (
          <button className="btn btn--ghost" onClick={onReturn} style={{ marginRight: 'auto' }}>復帰させる</button>
        ) : (
          <button className="btn btn--ghost" onClick={onDepart} style={{ marginRight: 'auto', color: 'var(--mw-danger)' }}>退団記録</button>
        ))}
        <button className="btn btn--ghost" onClick={onClose}>閉じる</button>
        <button className="btn btn--primary" onClick={onEdit}>編集</button>
      </div>
    </>
  );
}

function Box({ k, v }: { k: string; v: string }) {
  return <div className="stat-box"><div className="k">{k}</div><div className="v">{v}</div></div>;
}

function StatusPill({ status }: { status: Player['current_status'] }) {
  const cls = status === '退団' ? 'pill pill--out' : 'pill pill--active';
  return <span className={cls}>{status}</span>;
}

// ---- 作成 / 編集フォーム ----
interface FormProps {
  player: Player | null;
  careerId: string;
  seasons: { id: string; label: string }[];
  defaultSeasonId: string;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}

function PlayerForm({ player, careerId, seasons, defaultSeasonId, onCancel, onSaved, onDeleted }: FormProps) {
  const [f, setF] = useState<PlayerInput>(() => initForm(player, defaultSeasonId));
  const [busy, setBusy] = useState(false);
  const isEdit = !!player;

  const canSave = useMemo(() => f.name.trim() && f.join_season_id && !busy, [f, busy]);

  function set<K extends keyof PlayerInput>(key: K, value: PlayerInput[K]) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      if (player) await updatePlayer(player.id, f);
      else await createPlayer(careerId, f);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!player) return;
    if (!window.confirm(`選手「${player.name}」と、そのスタッツ・移籍記録を削除します。続行しますか？`)) return;
    setBusy(true);
    try {
      await deletePlayer(player.id);
      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="modal__head">
        <h3>{isEdit ? '選手を編集' : '選手を追加'}</h3>
        <button className="modal__close" onClick={onCancel} aria-label="閉じる">×</button>
      </div>
      <div className="modal__body">
        <div className="subhead">基本情報</div>
        <div className="field-grid">
          <Field label="選手名">
            <input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label="表示コード（空欄なら自動採番）">
            <input value={f.display_code ?? ''} onChange={(e) => set('display_code', e.target.value)} placeholder="例：WM-2526-001" />
          </Field>
          <Field label="ポジション">
            <select value={f.position} onChange={(e) => set('position', e.target.value as Position)}>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="国籍">
            <input value={f.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="例：ドイツ" />
          </Field>
          <Field label="身長(cm)">
            <NumInput value={f.height_cm} onChange={(v) => set('height_cm', v)} />
          </Field>
        </div>

        <div className="subhead">加入情報</div>
        <div className="field-grid">
          <Field label="加入シーズン">
            <select value={f.join_season_id} onChange={(e) => set('join_season_id', e.target.value)}>
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="加入種別">
            <select value={f.join_type} onChange={(e) => set('join_type', e.target.value as JoinType)}>
              {JOIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="加入時移籍金 (€)">
            <NumInput value={f.join_fee} onChange={(v) => set('join_fee', v)} />
          </Field>
          <Field label="加入時給与 (€)">
            <NumInput value={f.join_wage} onChange={(v) => set('join_wage', v)} />
          </Field>
          <Field label="加入時市場価値 (€・任意)">
            <NumInputOpt value={f.join_market_value ?? null} onChange={(v) => set('join_market_value', v ?? undefined)} />
          </Field>
        </div>

        <div className="subhead">初期能力値（加入時スナップショット）</div>
        <div className="field-grid">
          <Field label="初期OVR">
            <NumInput value={f.join_ovr} onChange={(v) => set('join_ovr', v)} />
          </Field>
          {sixFields(f.position).map(([key, label]) => (
            <Field key={key} label={label}>
              <NumInput value={f[key]} onChange={(v) => set(key, v)} />
            </Field>
          ))}
        </div>

        <div className="subhead">在籍状況</div>
        <div className="field-grid">
          <Field label="レンタル">
            <label className="row" style={{ gap: 8, height: 38, cursor: 'pointer' }}>
              <input type="checkbox" checked={f.is_on_loan} onChange={(e) => set('is_on_loan', e.target.checked)} style={{ width: 'auto' }} />
              <span className="info-line">レンタル中</span>
            </label>
          </Field>
        </div>
        <p className="info-line mt-16">
          退団・復帰はプロフィール画面の「退団記録」「復帰させる」から行います（退団時に移籍金・移籍先などの記録を残せます）。
        </p>
      </div>
      <div className="modal__foot">
        {isEdit && <button className="btn btn--danger" onClick={remove} style={{ marginRight: 'auto' }}>削除</button>}
        <button className="btn btn--ghost" onClick={onCancel}>キャンセル</button>
        <button className="btn btn--primary" onClick={save} disabled={!canSave}>
          {busy ? '保存中…' : isEdit ? '保存' : '追加'}
        </button>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>;
}

// 数値入力（必須・空欄は0扱い）。能力値・金額など number フィールド用。
function NumInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  return (
    <input
      type="number"
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t === '') onChange(0);
        else {
          const n = Number(t);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
    />
  );
}

// 数値入力（任意・空欄は null）。市場価値など省略可フィールド用。
function NumInputOpt({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => { setText(value == null ? '' : String(value)); }, [value]);
  return (
    <input
      type="number"
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t === '') onChange(null);
        else {
          const n = Number(t);
          if (!Number.isNaN(n)) onChange(n);
        }
      }}
    />
  );
}

function initForm(player: Player | null, defaultSeasonId: string): PlayerInput {
  if (player) {
    return {
      display_code: player.display_code,
      name: player.name,
      position: player.position,
      nationality: player.nationality,
      height_cm: player.height_cm,
      join_season_id: player.join_season_id,
      join_type: player.join_type,
      is_on_loan: player.is_on_loan,
      current_status: player.current_status,
      join_fee: player.join_fee,
      join_wage: player.join_wage,
      join_ovr: player.join_ovr,
      join_pace: player.join_pace,
      join_shooting: player.join_shooting,
      join_passing: player.join_passing,
      join_dribbling: player.join_dribbling,
      join_defending: player.join_defending,
      join_physical: player.join_physical,
      join_market_value: player.join_market_value,
    };
  }
  return {
    display_code: '',
    name: '',
    position: 'CM',
    nationality: '',
    height_cm: 180,
    join_season_id: defaultSeasonId,
    join_type: '移籍金あり',
    is_on_loan: false,
    current_status: '在籍',
    join_fee: 0,
    join_wage: 0,
    join_ovr: 70,
    join_pace: 70,
    join_shooting: 70,
    join_passing: 70,
    join_dribbling: 70,
    join_defending: 70,
    join_physical: 70,
    join_market_value: undefined,
  };
}
