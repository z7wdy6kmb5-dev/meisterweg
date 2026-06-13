import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listCareers, deleteCareer } from '../repo';
import { useApp } from '../AppContext';
import { NewCareerModal } from './NewCareerModal';
import { DataNotice } from './DataNotice';
import { ThemePicker } from './ThemePicker';

// 起動ゲート：キャリア未選択時に表示。選択 or 新規作成でアプリ本体に入る。
export function CareerGate() {
  const { selectCareer } = useApp();
  const careers = useLiveQuery(() => listCareers(), [], []);
  const [showNew, setShowNew] = useState(false);

  async function handleDelete(id: string, name: string) {
    const ok = window.confirm(
      `キャリア「${name}」と、それに含まれる全データ（選手・シーズン・成績・移籍・メモ・縛り）を削除します。\nこの操作は取り消せません。続行しますか？`,
    );
    if (ok) await deleteCareer(id);
  }

  return (
    <div className="gate">
      <div className="gate__panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <h1 className="gate__title">
            <small>Meisterweg</small>
            キャリアを選ぶ
          </h1>
          <ThemePicker />
        </div>

        <div className="card card--pad mt-24">
          {careers && careers.length > 0 ? (
            <div className="career-list">
              {careers.map((c) => (
                <div key={c.id} className="row" style={{ gap: 8 }}>
                  <button className="career-row" onClick={() => selectCareer(c.id)}>
                    <span>
                      <span className="career-row__name">{c.name}</span>
                      <span className="career-row__meta">
                        {c.team_name}
                        {c.team_code ? `（${c.team_code}）` : ''} ・ 開始 {c.start_season}
                      </span>
                    </span>
                    <span aria-hidden>→</span>
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => handleDelete(c.id, c.name)}
                    title="このキャリアを削除"
                    style={{ padding: '9px 11px' }}
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ padding: '36px 12px' }}>
              <h2>まだキャリアがありません</h2>
              <p>監督キャリアを作成すると、シーズンの記録を残せるようになります。</p>
            </div>
          )}

          <div className="mt-24">
            <button className="btn btn--primary" onClick={() => setShowNew(true)}>
              ＋ 新しいキャリアを作成
            </button>
          </div>
        </div>

        <div className="mt-16">
          <DataNotice />
        </div>
      </div>

      {showNew && (
        <NewCareerModal
          onClose={() => setShowNew(false)}
          onCreated={(career) => {
            setShowNew(false);
            selectCareer(career.id);
          }}
        />
      )}
    </div>
  );
}
