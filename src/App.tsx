import { useState } from 'react';
import { useApp } from './AppContext';
import { CareerGate } from './components/CareerGate';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { PlayersPage } from './components/PlayersPage';
import { StatsPage } from './components/StatsPage';
import { TransfersPage } from './components/TransfersPage';
import { RecordsPage } from './components/RecordsPage';
import { MemoPage } from './components/MemoPage';
import { ConstraintsPage } from './components/ConstraintsPage';
import { ExportPage } from './components/ExportPage';
import { PlaceholderPage } from './components/PlaceholderPage';
import { TABS, type TabKey } from './tabs';

export function App() {
  const { currentCareer, ready } = useApp();
  const [tab, setTab] = useState<TabKey>('dashboard');

  // 初回ロード中（DB解決前）は何も描かずちらつきを防ぐ
  if (!ready) return null;

  // キャリア未選択 → 起動ゲート
  if (!currentCareer) return <CareerGate />;

  const tabDef = TABS.find((t) => t.key === tab)!;

  function renderTab() {
    switch (tab) {
      case 'dashboard': return <Dashboard />;
      case 'players': return <PlayersPage />;
      case 'stats': return <StatsPage />;
      case 'transfers': return <TransfersPage />;
      case 'records': return <RecordsPage />;
      case 'memo': return <MemoPage />;
      case 'constraints': return <ConstraintsPage />;
      case 'export': return <ExportPage />;
      default: return <PlaceholderPage label={tabDef.label} phase={tabDef.phase} />;
    }
  }

  return (
    <div className="app-shell">
      <Header activeTab={tab} onTab={setTab} />
      <main className="app-main">
        {renderTab()}
      </main>
    </div>
  );
}
