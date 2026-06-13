import { useState } from 'react';
import { useApp } from '../AppContext';
import { ThemePicker } from './ThemePicker';
import { NewSeasonModal } from './NewSeasonModal';
import { SeasonManageModal } from './SeasonManageModal';
import { TABS, type TabKey } from '../tabs';

interface Props {
  activeTab: TabKey;
  onTab: (t: TabKey) => void;
}

// ヘッダー＋タブ。キャリア名・キャリア切替・グローバルシーズンセレクタ（＋作成/管理）を常時表示。
export function Header({ activeTab, onTab }: Props) {
  const { currentCareer, seasons, currentSeason, selectCareer, selectSeason } = useApp();
  const [newSeason, setNewSeason] = useState(false);
  const [manageSeason, setManageSeason] = useState(false);

  return (
    <header className="app-header">
      <div className="app-header__top">
        <div className="app-header__brand">
          Meisterweg
          <small>FC Manager Journal</small>
        </div>

        <div className="app-header__career">
          <span className="app-header__career-name" title={currentCareer?.name}>
            {currentCareer?.name ?? '—'}
          </span>
          <button className="hbtn" onClick={() => selectCareer(null)} title="キャリアを切り替え／新規作成">
            切り替え
          </button>
        </div>

        <div className="app-header__spacer" />

        <div className="row" style={{ gap: 8 }}>
          <label className="row" style={{ gap: 6 }}>
            <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>シーズン</span>
            <select
              className="hselect"
              value={currentSeason?.id ?? ''}
              onChange={(e) => selectSeason(e.target.value)}
              disabled={seasons.length === 0}
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <button className="hbtn" onClick={() => setNewSeason(true)} title="新しいシーズンを作成">＋</button>
          <button className="hbtn" onClick={() => setManageSeason(true)} title="シーズン管理">管理</button>
          <ThemePicker compact />
        </div>
      </div>

      <nav className="app-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`app-tab ${activeTab === t.key ? 'app-tab--active' : ''}`}
            onClick={() => onTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {newSeason && (
        <NewSeasonModal
          onClose={() => setNewSeason(false)}
          onCreated={(id) => { setNewSeason(false); selectSeason(id); }}
        />
      )}
      {manageSeason && <SeasonManageModal onClose={() => setManageSeason(false)} />}
    </header>
  );
}
