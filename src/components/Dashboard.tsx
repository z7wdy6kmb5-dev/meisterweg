import { useApp } from '../AppContext';
import { DataNotice } from './DataNotice';

// 段階1のダッシュボード：キャリア概要を表示。
// 成績・得点ランキング・縛りアラートは、それぞれのデータが入る後続段階で追加する。
export function Dashboard() {
  const { currentCareer, seasons, currentSeason } = useApp();
  if (!currentCareer) return null;

  return (
    <div>
      <div className="section-title">
        <h1>ダッシュボード</h1>
        <span className="sub">選択中シーズン：{currentSeason?.label ?? '—'}</span>
      </div>

      <div className="field-grid">
        <SummaryCard label="キャリア" value={currentCareer.name} />
        <SummaryCard
          label="チーム"
          value={`${currentCareer.team_name}${currentCareer.team_code ? `（${currentCareer.team_code}）` : ''}`}
        />
        <SummaryCard label="開始シーズン" value={currentCareer.start_season} />
        <SummaryCard label="登録シーズン数" value={`${seasons.length} シーズン`} />
      </div>

      <div className="card card--pad mt-24">
        <h3 style={{ marginBottom: 8 }}>これからの段階で見られるようになるもの</h3>
        <p className="muted" style={{ lineHeight: 1.7, fontSize: '0.88rem' }}>
          主要大会の成績サマリ、得点・アシストの上位、縛りの違反アラートなどを、
          選手・成績・縛りのデータが入る段階でここに表示します。今はキャリアの土台
          （保存・切り替え・シーズン管理）が動く状態です。
        </p>
      </div>

      <div className="mt-24">
        <DataNotice />
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card--pad summary-card">
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--mw-text-muted)' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>
        {value}
      </div>
    </div>
  );
}
