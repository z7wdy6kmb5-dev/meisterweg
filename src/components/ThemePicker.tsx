import { useEffect, useState } from 'react';
import { THEMES, applyTheme, loadThemeKey, saveThemeKey } from '../theme';

// テーマ切り替え。基本（ライト/ダーク）とチームモチーフをグループ分けで表示。
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const [key, setKey] = useState(loadThemeKey);

  useEffect(() => {
    applyTheme(key);
    saveThemeKey(key);
  }, [key]);

  const basic = THEMES.filter((t) => t.group === 'basic');
  const team = THEMES.filter((t) => t.group === 'team');

  return (
    <select
      className={compact ? 'hselect' : ''}
      value={key}
      onChange={(e) => setKey(e.target.value)}
      aria-label="テーマ"
      title="テーマを切り替え"
    >
      <optgroup label="基本">
        {basic.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </optgroup>
      <optgroup label="チームモチーフ">
        {team.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </optgroup>
    </select>
  );
}
