import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  listConstraints, createConstraint, updateConstraint, deleteConstraint, getConstraintContext,
} from '../repo';
import { TEMPLATES, getBuiltinTemplate, type ConstraintTemplate, type ParamField } from '../constraints';
import {
  listCustomTemplates, addCustomTemplate, getCustomTemplate, type CustomTemplate,
} from '../customConstraints';
import { useApp } from '../AppContext';
import type { Constraint, Player, Transfer } from '../types';

// 組み込み or カスタムのテンプレートを解決し、表示に必要な情報へ正規化する。
function resolveTemplate(careerId: string, c: Constraint): {
  label: string; description: string; isAuto: boolean; params: ParamField[];
  evaluate?: ConstraintTemplate['evaluate']; partialNote?: string;
} {
  const builtin = getBuiltinTemplate(c.template_key);
  if (builtin) return builtin;
  const custom = getCustomTemplate(careerId, c.template_key);
  return {
    label: custom?.label ?? 'カスタム縛り',
    description: custom?.description ?? '',
    isAuto: false,
    params: [],
  };
}

export function ConstraintsPage() {
  const { currentCareer } = useApp();
  const constraints = useLiveQuery(
    () => (currentCareer ? listConstraints(currentCareer.id) : Promise.resolve([])),
    [currentCareer?.id],
    [],
  );
  const ctx = useLiveQuery(
    () => (currentCareer ? getConstraintContext(currentCareer.id) : Promise.resolve({ players: [], transfers: [] })),
    [currentCareer?.id],
    { players: [], transfers: [] },
  );
  const [editing, setEditing] = useState<Constraint | null>(null);
  const [adding, setAdding] = useState(false);

  if (!currentCareer) return null;

  const list = constraints ?? [];
  const autos = list.filter((c) => c.is_auto);
  const manuals = list.filter((c) => !c.is_auto);

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>縛り</h1>
          <span className="sub">{list.length} 件</span>
        </div>
        <button className="btn btn--primary" onClick={() => setAdding(true)}>＋ 縛りを追加</button>
      </div>

      {list.length === 0 ? (
        <div className="card card--pad">
          <div className="empty" style={{ padding: '40px 12px' }}>
            <h2>縛りがまだありません</h2>
            <p>移籍金上限・能力値制限・国籍縛りは選手データから自動判定。売却規定やフォーメーション固定などは内容を記入して手動管理します。テンプレートに無い縛りも追加できます。</p>
            <button className="btn btn--primary" onClick={() => setAdding(true)}>＋ 最初の縛りを追加</button>
          </div>
        </div>
      ) : (
        <>
          {autos.length > 0 && (
            <section className="comp-section">
              <div className="comp-section__head"><h2>自動判定</h2></div>
              <div className="constraint-list">
                {autos.map((c) => (
                  <ConstraintCard key={c.id} careerId={currentCareer.id} c={c} players={ctx?.players ?? []} transfers={ctx?.transfers ?? []} onEdit={() => setEditing(c)} />
                ))}
              </div>
            </section>
          )}
          {manuals.length > 0 && (
            <section className="comp-section">
              <div className="comp-section__head"><h2>手動チェック</h2></div>
              <div className="constraint-list">
                {manuals.map((c) => (
                  <ConstraintCard key={c.id} careerId={currentCareer.id} c={c} players={ctx?.players ?? []} transfers={ctx?.transfers ?? []} onEdit={() => setEditing(c)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {(adding || editing) && (
        <ConstraintModal
          careerId={currentCareer.id}
          constraint={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ConstraintCard({ careerId, c, players, transfers, onEdit }: {
  careerId: string; c: Constraint; players: Player[]; transfers: Transfer[]; onEdit: () => void;
}) {
  const tpl = resolveTemplate(careerId, c);
  const result = tpl.isAuto && tpl.evaluate ? tpl.evaluate(c.params, { players, transfers }) : null;
  const paramSummary = tpl.params
    .filter((p) => c.params[p.key] !== '' && c.params[p.key] != null)
    .map((p) => `${p.label}: ${c.params[p.key]}`)
    .join(' / ');

  return (
    <div className={`constraint-card ${result ? (result.ok ? 'constraint-card--ok' : 'constraint-card--bad') : ''}`}>
      <div className="constraint-card__main">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <span className="constraint-card__title">{tpl.label}</span>
          {tpl.isAuto
            ? <span className={result?.ok ? 'pill pill--active' : 'pill pill--out'}>{result?.ok ? '順守' : '違反あり'}</span>
            : <span className="pill pill--loan">手動</span>}
        </div>
        {tpl.description && <p className="info-line" style={{ marginTop: 4 }}>{tpl.description}</p>}
        {paramSummary && <p className="info-line" style={{ marginTop: 2 }}>設定：{paramSummary}</p>}
        {c.note && <p className="info-line" style={{ marginTop: 2 }}>内容：{c.note}</p>}
        {c.penalty && <p className="info-line" style={{ marginTop: 2 }}>違反時：{c.penalty}</p>}
        {tpl.partialNote && <p className="info-line" style={{ marginTop: 2, opacity: 0.8 }}>※ {tpl.partialNote}</p>}

        {result && (
          <p className="info-line" style={{ marginTop: 4 }}>
            判定：{result.summary}
            {!result.ok && result.violations.length > 0 && (
              <span style={{ color: 'var(--mw-danger)' }}> ／ 違反：{result.violations.join('、')}</span>
            )}
          </p>
        )}
      </div>

      <div className="constraint-card__side">
        {!tpl.isAuto && (
          <label className="row" style={{ gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={c.manual_checked}
              onChange={(e) => void updateConstraint(c.id, { manual_checked: e.target.checked })}
              style={{ width: 'auto' }}
            />
            <span className="info-line">順守中</span>
          </label>
        )}
        <button className="btn btn--ghost" style={{ padding: '6px 10px' }} title="編集" onClick={onEdit}>編集</button>
        <button
          className="btn btn--ghost"
          style={{ padding: '6px 10px' }}
          title="削除"
          onClick={() => { if (window.confirm(`縛り「${tpl.label}」を削除しますか？`)) void deleteConstraint(c.id); }}
        >🗑</button>
      </div>
    </div>
  );
}

// 追加／編集モーダル
function ConstraintModal({ careerId, constraint, onClose }: {
  careerId: string; constraint: Constraint | null; onClose: () => void;
}) {
  const isEdit = !!constraint;
  const customs = listCustomTemplates(careerId);
  const [key, setKey] = useState<string>(constraint?.template_key ?? 'transfer_fee_cap');
  const [params, setParams] = useState<Record<string, string>>(() => toStringParams(constraint?.params));
  const [note, setNote] = useState(constraint?.note ?? '');
  const [penalty, setPenalty] = useState(constraint?.penalty ?? '');
  const [busy, setBusy] = useState(false);

  // カスタム追加用
  const [addingCustom, setAddingCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customList, setCustomList] = useState<CustomTemplate[]>(customs);

  const builtin = getBuiltinTemplate(key);
  const custom = customList.find((t) => t.key === key);
  const isAuto = builtin?.isAuto ?? false;
  const fields = builtin?.params ?? [];
  const examples = builtin?.examples ?? [];
  const description = builtin?.description ?? custom?.description ?? '';

  function selectKey(k: string) {
    setKey(k);
    setParams({});
  }

  function confirmCustom() {
    const tpl = addCustomTemplate(careerId, customLabel, customDesc);
    setCustomList((l) => [...l, tpl]);
    setKey(tpl.key);
    setParams({});
    setCustomLabel(''); setCustomDesc(''); setAddingCustom(false);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const stored: Record<string, unknown> = {};
      for (const f of fields) {
        const raw = params[f.key] ?? '';
        stored[f.key] = f.kind === 'number' ? (raw === '' ? '' : Number(raw)) : raw;
      }
      if (constraint) {
        await updateConstraint(constraint.id, { template_key: key, is_auto: isAuto, params: stored, note, penalty });
      } else {
        await createConstraint(careerId, key, isAuto, stored, note, penalty);
      }
      onClose();
    } finally { setBusy(false); }
  }

  const autoTpls = TEMPLATES.filter((t) => t.isAuto);
  const manualTpls = TEMPLATES.filter((t) => !t.isAuto);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isEdit ? '縛りを編集' : '縛りを追加'}</h3>
          <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          {!addingCustom ? (
            <div className="field">
              <label>テンプレート</label>
              <div className="row" style={{ gap: 6 }}>
                <select value={key} onChange={(e) => selectKey(e.target.value)} style={{ flex: 1 }} disabled={isEdit}>
                  <optgroup label="自動判定">
                    {autoTpls.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </optgroup>
                  <optgroup label="手動チェック">
                    {manualTpls.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </optgroup>
                  {customList.length > 0 && (
                    <optgroup label="カスタム">
                      {customList.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </optgroup>
                  )}
                </select>
                {!isEdit && (
                  <button className="btn btn--ghost" style={{ padding: '8px 12px' }} onClick={() => setAddingCustom(true)} title="独自テンプレートを追加">＋ 新規</button>
                )}
              </div>
            </div>
          ) : (
            <div className="card card--pad" style={{ marginBottom: 4 }}>
              <div className="field">
                <label>独自テンプレート名</label>
                <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="例：監督在任年数縛り" autoFocus />
              </div>
              <div className="field mt-16">
                <label>説明（任意）</label>
                <input value={customDesc} onChange={(e) => setCustomDesc(e.target.value)} placeholder="どんな縛りか" />
              </div>
              <div className="row mt-16" style={{ gap: 8 }}>
                <button className="btn btn--primary" onClick={confirmCustom} disabled={!customLabel.trim()}>追加して選択</button>
                <button className="btn btn--ghost" onClick={() => setAddingCustom(false)}>取消</button>
              </div>
              <p className="info-line mt-16">独自テンプレートは手動チェック扱いです。条件は下の「縛り内容」に記入してください。</p>
            </div>
          )}

          {!addingCustom && (
            <>
              {description && <p className="info-line mt-16">{description}</p>}
              {examples.length > 0 && (
                <p className="info-line" style={{ marginTop: 6 }}>例：{examples.join(' ／ ')}</p>
              )}

              {fields.length > 0 && (
                <>
                  <div className="subhead">設定</div>
                  <div className="field-grid">
                    {fields.map((f) => (
                      <div className="field" key={f.key}>
                        <label>{f.label}</label>
                        <input
                          type={f.kind === 'number' ? 'number' : 'text'}
                          value={params[f.key] ?? ''}
                          onChange={(e) => setParams((p) => ({ ...p, [f.key]: e.target.value }))}
                          placeholder={f.placeholder}
                        />
                        {f.help && <span className="info-line" style={{ fontSize: '0.74rem' }}>{f.help}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="subhead">縛り内容（自由記入）</div>
              <textarea
                className="memo-card__body"
                style={{ border: '1px solid var(--mw-border)', borderRadius: 'var(--mw-radius-sm)', background: 'var(--mw-surface)' }}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="この縛りの具体的な内容・例外・運用ルールなどを自由に記入"
              />

              <div className="field mt-16">
                <label>違反時ペナルティ（任意）</label>
                <input value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder="例：次シーズンの予算 -20% など" />
              </div>
            </>
          )}
        </div>
        {!addingCustom && (
          <div className="modal__foot">
            <button className="btn btn--ghost" onClick={onClose}>キャンセル</button>
            <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? '保存中…' : isEdit ? '保存' : '追加'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function toStringParams(params: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (params) for (const [k, v] of Object.entries(params)) out[k] = v == null ? '' : String(v);
  return out;
}
