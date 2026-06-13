import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  listConstraints, createConstraint, updateConstraint, deleteConstraint, getConstraintContext,
} from '../repo';
import { TEMPLATES, getTemplate } from '../constraints';
import { useApp } from '../AppContext';
import type { Constraint, ConstraintTemplateKey, Player, Transfer } from '../types';

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
            <p>移籍金上限・国籍縛りなどは選手データから自動で順守状況を判定します。フォーメーション固定などは手動チェックで管理します。</p>
            <button className="btn btn--primary" onClick={() => setAdding(true)}>＋ 最初の縛りを追加</button>
          </div>
        </div>
      ) : (
        <>
          {autos.length > 0 && (
            <section className="comp-section">
              <div className="comp-section__head"><h2>自動判定</h2></div>
              <div className="constraint-list">
                {autos.map((c) => <ConstraintCard key={c.id} c={c} players={ctx?.players ?? []} transfers={ctx?.transfers ?? []} />)}
              </div>
            </section>
          )}
          {manuals.length > 0 && (
            <section className="comp-section">
              <div className="comp-section__head"><h2>手動チェック</h2></div>
              <div className="constraint-list">
                {manuals.map((c) => <ConstraintCard key={c.id} c={c} players={ctx?.players ?? []} transfers={ctx?.transfers ?? []} />)}
              </div>
            </section>
          )}
        </>
      )}

      {adding && <AddConstraintModal careerId={currentCareer.id} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ConstraintCard({ c, players, transfers }: { c: Constraint; players: Player[]; transfers: Transfer[] }) {
  const tpl = getTemplate(c.template_key);
  if (!tpl) return null;

  const result = tpl.isAuto && tpl.evaluate ? tpl.evaluate(c.params, { players, transfers }) : null;
  const paramSummary = tpl.params
    .map((p) => `${p.label}: ${c.params[p.key] ?? '—'}`)
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
        <p className="info-line" style={{ marginTop: 4 }}>{tpl.description}</p>
        {paramSummary && <p className="info-line" style={{ marginTop: 2 }}>{paramSummary}</p>}
        {c.penalty && <p className="info-line" style={{ marginTop: 2 }}>違反時：{c.penalty}</p>}

        {result && (
          <p className="info-line" style={{ marginTop: 4 }}>
            {result.summary}
            {!result.ok && result.violations.length > 0 && (
              <span style={{ color: 'var(--mw-danger)' }}> ／ {result.violations.join('、')}</span>
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

function AddConstraintModal({ careerId, onClose }: { careerId: string; onClose: () => void }) {
  const [key, setKey] = useState<ConstraintTemplateKey>('transfer_fee_cap');
  const [params, setParams] = useState<Record<string, string>>({});
  const [penalty, setPenalty] = useState('');
  const [busy, setBusy] = useState(false);
  const tpl = getTemplate(key)!;

  function selectTemplate(k: ConstraintTemplateKey) { setKey(k); setParams({}); }

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      // number 項目は数値化して保存
      const stored: Record<string, unknown> = {};
      for (const f of tpl.params) {
        const raw = params[f.key] ?? '';
        stored[f.key] = f.kind === 'number' ? (raw === '' ? 0 : Number(raw)) : raw;
      }
      await createConstraint(careerId, key, tpl.isAuto, stored, penalty);
      onClose();
    } finally { setBusy(false); }
  }

  const autoTpls = TEMPLATES.filter((t) => t.isAuto);
  const manualTpls = TEMPLATES.filter((t) => !t.isAuto);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>縛りを追加</h3>
          <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          <div className="field">
            <label>テンプレート</label>
            <select value={key} onChange={(e) => selectTemplate(e.target.value as ConstraintTemplateKey)}>
              <optgroup label="自動判定">
                {autoTpls.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
              <optgroup label="手動チェック">
                {manualTpls.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </optgroup>
            </select>
          </div>
          <p className="info-line mt-16">{tpl.description}</p>

          {tpl.params.length > 0 && (
            <div className="field-grid mt-16">
              {tpl.params.map((f) => (
                <div className="field" key={f.key}>
                  <label>{f.label}</label>
                  <input
                    type={f.kind === 'number' ? 'number' : 'text'}
                    value={params[f.key] ?? ''}
                    onChange={(e) => setParams((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="field mt-16">
            <label>違反時ペナルティ（任意）</label>
            <input value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder="例：次シーズンの予算 -20% など" />
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>キャンセル</button>
          <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? '追加中…' : '追加'}</button>
        </div>
      </div>
    </div>
  );
}
