import { useState } from 'react';
import { useApp } from '../AppContext';
import { ThemePicker } from './ThemePicker';
import { MeisterMark } from './Logo';
import { NewSeasonModal } from './NewSeasonModal';
import { SeasonManageModal } from './SeasonManageModal';
import { TABS, type TabKey } from '../tabs';

interface Props {
  activeTab: TabKey;
  onTab: (t: TabKey) => void;
}

// ヘッダー＋タブ。広幅ではアクションをインライン表示、狭幅ではハンバーガーに集約する。
export function Header({ activeTab, onTab }: Props) {
  const { currentCareer, seasons, currentSeason, selectCareer, selectSeason } = useApp();
  const [newSeason, setNewSeason] = useState(false);
  const [manageSeason, setManageSeason] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="app-header">
      <div className="app-header__top">
        <div className="app-header__brand">
          <MeisterMark size={32} className="app-header__mark" />
          <span className="app-header__brand-text">
            Meisterweg
            <small>FC Manager Journal</small>
          </span>
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

        <div className="header-right">
          <label className="season-field">
            <span className="season-label">シーズン</span>
            <select
              className="hselect"
              value={currentSeason?.id ?? ''}
              onChange={(e) => selectSeason(e.target.value)}
              disabled={seasons.length === 0}
              aria-label="シーズン"
            >
              {seasons.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>

          {/* 広幅: インライン */}
          <div className="header-actions">
            <button className="hbtn" onClick={() => setNewSeason(true)} title="新しいシーズンを作成">＋ シーズン</button>
            <button className="hbtn" onClick={() => setManageSeason(true)} title="シーズン管理">管理</button>
            <ThemePicker compact />
          </div>

          {/* 狭幅: ハンバーガー */}
          <button
            className="hbtn header-menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="メニュー"
            aria-expanded={menuOpen}
          >☰</button>
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

      {menuOpen && (
        <>
          <div className="header-menu-backdrop" onClick={closeMenu} />
          <div className="header-menu" role="menu">
            <button className="menu-item" onClick={() => { closeMenu(); selectCareer(null); }}>キャリアを切り替え</button>
            <div className="menu-sep" />
            <button className="menu-item" onClick={() => { closeMenu(); setNewSeason(true); }}>＋ 新しいシーズン</button>
            <button className="menu-item" onClick={() => { closeMenu(); setManageSeason(true); }}>シーズン管理</button>
            <div className="menu-sep" />
            <label>テーマ</label>
            <ThemePicker />
          </div>
        </>
      )}

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
