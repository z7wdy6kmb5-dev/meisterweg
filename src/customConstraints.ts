// ユーザー定義の縛りテンプレート（キャリアごと）。組み込みテンプレートに無い縛りを
// ユーザーが選択肢として追加できるようにする。設定的データなので localStorage に保持。

const KEY_PREFIX = 'meisterweg.customConstraints.';

export interface CustomTemplate {
  key: string;     // 'custom:<id>'
  label: string;
  description: string;
}

function load(careerId: string): CustomTemplate[] {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + careerId);
    if (raw) return JSON.parse(raw) as CustomTemplate[];
  } catch { /* ignore */ }
  return [];
}

function save(careerId: string, list: CustomTemplate[]): void {
  localStorage.setItem(KEY_PREFIX + careerId, JSON.stringify(list));
}

export function listCustomTemplates(careerId: string): CustomTemplate[] {
  return load(careerId);
}

export function getCustomTemplate(careerId: string, key: string): CustomTemplate | undefined {
  return load(careerId).find((t) => t.key === key);
}

/** カスタムテンプレートを追加。追加したテンプレートを返す。 */
export function addCustomTemplate(careerId: string, label: string, description: string): CustomTemplate {
  const tpl: CustomTemplate = {
    key: 'custom:' + Math.random().toString(36).slice(2, 10),
    label: label.trim(),
    description: description.trim(),
  };
  const list = load(careerId);
  list.push(tpl);
  save(careerId, list);
  return tpl;
}

export function removeCustomTemplate(careerId: string, key: string): void {
  save(careerId, load(careerId).filter((t) => t.key !== key));
}
