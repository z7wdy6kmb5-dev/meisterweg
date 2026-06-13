import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listSeasonMemos, upsertSeasonMemo } from '../repo';
import { useApp } from '../AppContext';
import { MEMO_MONTHS, type MemoMonth } from '../types';

// シーズンメモ（月別ジャーナル）。7月開始〜翌6月の順。各月のテキストはフォーカスを外すと保存。
export function MemoPage() {
  const { currentSeason } = useApp();
  const memos = useLiveQuery(
    () => (currentSeason ? listSeasonMemos(currentSeason.id) : Promise.resolve([])),
    [currentSeason?.id],
    [],
  );

  if (!currentSeason) {
    return (
      <div className="card card--pad">
        <p className="info-line">シーズンがありません。ヘッダーの「＋ シーズン」から作成してください。</p>
      </div>
    );
  }

  const byMonth = new Map((memos ?? []).map((m) => [m.month, m.body]));
  const filled = (memos ?? []).filter((m) => m.body.trim() !== '').length;

  return (
    <div>
      <div className="toolbar">
        <div className="section-title" style={{ marginBottom: 0 }}>
          <h1>シーズンメモ</h1>
          <span className="sub">{currentSeason.label}・記入 {filled}/12 ヶ月</span>
        </div>
      </div>

      <div className="memo-grid">
        {MEMO_MONTHS.map((month) => (
          <MonthMemo
            key={month}
            seasonId={currentSeason.id}
            month={month}
            value={byMonth.get(month) ?? ''}
          />
        ))}
      </div>
    </div>
  );
}

// 月別メモ1枚。ライブ更新でのカーソル飛びを避けるため、編集中はローカル状態を優先し、blur で保存。
function MonthMemo({ seasonId, month, value }: { seasonId: string; month: MemoMonth; value: string }) {
  const [text, setText] = useState(value);
  const dirty = useRef(false);
  useEffect(() => { if (!dirty.current) setText(value); }, [value]);

  function commit() {
    dirty.current = false;
    if (text !== value) void upsertSeasonMemo(seasonId, month, text);
  }

  return (
    <div className="memo-card">
      <div className="memo-card__month">{month}</div>
      <textarea
        className="memo-card__body"
        value={text}
        onChange={(e) => { dirty.current = true; setText(e.target.value); }}
        onBlur={commit}
        placeholder="この月の出来事・移籍・戦術・心境など"
        rows={5}
      />
    </div>
  );
}
