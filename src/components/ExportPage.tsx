import { useState, type ChangeEvent } from 'react';
import { exportCareerBundle, importCareerBundle } from '../repo';
import { buildMarkdownReport } from '../exportMarkdown';
import { useApp } from '../AppContext';
import type { MeisterwegBundle } from '../types';

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40) || 'career';
}

export function ExportPage() {
  const { currentCareer, selectCareer } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function doExportJson() {
    if (!currentCareer) return;
    setBusy('json'); setMsg(null);
    try {
      const bundle = await exportCareerBundle(currentCareer.id);
      const stamp = new Date().toISOString().slice(0, 10);
      download(`meisterweg_${safeName(currentCareer.name)}_${stamp}.json`, JSON.stringify(bundle, null, 2), 'application/json');
      setMsg({ kind: 'ok', text: 'JSONファイルを書き出しました。' });
    } catch (e) {
      setMsg({ kind: 'err', text: 'エクスポートに失敗しました：' + String(e) });
    } finally { setBusy(null); }
  }

  async function doExportMarkdown() {
    if (!currentCareer) return;
    setBusy('md'); setMsg(null);
    try {
      const bundle = await exportCareerBundle(currentCareer.id);
      const md = buildMarkdownReport(bundle);
      const stamp = new Date().toISOString().slice(0, 10);
      download(`meisterweg_${safeName(currentCareer.name)}_${stamp}.md`, md, 'text/markdown');
      setMsg({ kind: 'ok', text: 'Markdownレポートを書き出しました。' });
    } catch (e) {
      setMsg({ kind: 'err', text: 'エクスポートに失敗しました：' + String(e) });
    } finally { setBusy(null); }
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 同じファイルを連続選択できるようリセット
    if (!file) return;
    setBusy('import'); setMsg(null);
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as MeisterwegBundle;
      if (!bundle.career || !Array.isArray(bundle.seasons)) {
        throw new Error('Meisterwegのバックアップファイルではないようです。');
      }
      const newId = await importCareerBundle(bundle);
      selectCareer(newId);
      setMsg({ kind: 'ok', text: `インポート完了：「${bundle.career.name}（インポート）」を新しいキャリアとして追加し、選択しました。` });
    } catch (err) {
      setMsg({ kind: 'err', text: 'インポートに失敗しました：' + String(err) });
    } finally { setBusy(null); }
  }

  if (!currentCareer) {
    return <div className="card card--pad"><p className="info-line">キャリアが選択されていません。</p></div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>エクスポート / インポート</h1>
          <span className="sub">{currentCareer.name}</span>
        </div>
      </div>

      {msg && (
        <div className={`notice ${msg.kind === 'err' ? 'notice--err' : 'notice--ok'}`} style={{ marginBottom: 14 }}>
          {msg.text}
        </div>
      )}

      <div className="export-grid">
        <div className="card card--pad">
          <h2 className="subhead" style={{ marginTop: 0 }}>バックアップ（JSON）</h2>
          <p className="info-line">現在のキャリアの全データをJSONファイルに書き出します。インポートで復元できます。データはこの端末のブラウザ内にのみ保存されるため、定期的なバックアップを推奨します。</p>
          <button className="btn btn--primary mt-16" onClick={doExportJson} disabled={busy !== null}>
            {busy === 'json' ? '書き出し中…' : 'JSONをエクスポート'}
          </button>
        </div>

        <div className="card card--pad">
          <h2 className="subhead" style={{ marginTop: 0 }}>レポート（Markdown）</h2>
          <p className="info-line">成績・選手・移籍・メモ・縛りを読みやすいMarkdownにまとめて書き出します。NotionやGitHub等に貼り付けられます。</p>
          <button className="btn btn--primary mt-16" onClick={doExportMarkdown} disabled={busy !== null}>
            {busy === 'md' ? '書き出し中…' : 'Markdownをエクスポート'}
          </button>
        </div>

        <div className="card card--pad">
          <h2 className="subhead" style={{ marginTop: 0 }}>インポート（JSON）</h2>
          <p className="info-line">バックアップJSONを取り込みます。既存データは上書きせず、<strong>新しいキャリアとして追加</strong>します（古いバージョンのファイルは自動で現行形式に変換）。</p>
          <label className="btn btn--ghost mt-16" style={{ cursor: busy ? 'default' : 'pointer', display: 'inline-block' }}>
            {busy === 'import' ? '取り込み中…' : 'JSONファイルを選択'}
            <input type="file" accept="application/json,.json" onChange={onPickFile} disabled={busy !== null} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    </div>
  );
}
