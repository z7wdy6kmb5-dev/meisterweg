import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './AppContext';
import { runMigrations } from './migrations';
import { applyTheme, loadThemeKey } from './theme';
import './styles.css';

// 起動時:
// 1) 保存済みテーマを即適用（描画前に色を確定させ、ちらつきを防ぐ）
// 2) スキーマバージョンを確認し、必要ならマイグレーションを実行
applyTheme(loadThemeKey());

runMigrations()
  .catch((err) => {
    console.error('マイグレーションに失敗しました:', err);
  })
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppProvider>
          <App />
        </AppProvider>
      </StrictMode>,
    );
  });
