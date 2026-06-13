import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listSeasons, renameSeason, deleteSeason } from '../repo';
import { useApp } from '../AppContext';

// シーズンの一覧・改名・削除。新規作成は NewSeasonModal が担当。
export function SeasonManageModal({ onClose }: { onClose: () => void }) {
  const { currentCareer } = useApp();
  const seasons = useLiveQuery(
    () => (currentCareer ? listSeasons(currentCareer.id) : Promise.resolve([])),
    [currentCareer?.id],
    [],
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  async function saveRename(id: string) {
    if (draft.trim()) await renameSeason(id, draft);
    setEditingId(null);
  }

  async function remove(id: string, label: string) {
    if (!window.confirm(`シーズン「${label}」を削除します。\nこのシーズンのスタッツ・成績・メモも削除されます。続行しますか？`)) return;
    const res = await deleteSeason(id);
    if (!res.ok) window.alert(res.reason);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>シーズン管理</h3>
          <button className="modal__close" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="modal__body">
          {seasons && seasons.length > 0 ? (
            <div className="career-list">
              {seasons.map((s) => (
                <div key={s.id} className="career-row" style={{ cursor: 'default' }}>
                  {editingId === s.id ? (
                    <>
                      <input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                        style={{ maxWidth: 160 }}
                      />
                      <span className="row" style={{ gap: 6 }}>
                        <button className="btn btn--primary" onClick={() => saveRename(s.id)} style={{ padding: '7px 12px' }}>保存</button>
                        <button className="btn btn--ghost" onClick={() => setEditingId(null)} style={{ padding: '7px 12px' }}>取消</button>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <span className="career-row__name">{s.label}</span>
                        <span className="career-row__meta">第 {s.order} シーズン</span>
                      </span>
                      <span className="row" style={{ gap: 6 }}>
                        <button
                          className="btn btn--ghost"
                          onClick={() => { setEditingId(s.id); setDraft(s.label); }}
                          style={{ padding: '7px 11px' }}
                        >改名</button>
                        <button
                          className="btn btn--ghost"
                          onClick={() => remove(s.id, s.label)}
                          style={{ padding: '7px 11px' }}
                          title="削除"
                        >🗑</button>
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="info-line">シーズンがありません。</p>
          )}
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  );
}
