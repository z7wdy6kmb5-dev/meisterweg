import { useLiveQuery } from 'dexie-react-hooks';
import { getDashboardData, getConstraintContext, listConstraints } from '../repo';
import { getBuiltinTemplate } from '../constraints';
import { useApp } from '../AppContext';
import { DataNotice } from './DataNotice';
import type { Constraint, Player, Transfer } from '../types';

export function Dashboard() {
  const { currentCareer, seasons, currentSeason } = useApp();
  const seasonKey = currentSeason?.id ?? 'all';

  const data = useLiveQuery(
    () => (currentCareer ? getDashboardData(currentCareer.id, seasonKey) : null),
    [currentCareer?.id, seasonKey],
    null,
  );
  const constraints = useLiveQuery(
    () => (currentCareer ? listConstraints(currentCareer.id) : Promise.resolve([])),
    [currentCareer?.id],
    [],
  );
  const ctx = useLiveQuery(
    () => (currentCareer ? getConstraintContext(currentCareer.id) : Promise.resolve({ players: [], transfers: [] })),
    [currentCareer?.id],
    { players: [], transfers: [] },
  );

  if (!currentCareer) return null;

  const violations = computeViolations(constraints ?? [], ctx?.players ?? [], ctx?.transfers ?? []);
  const played = data ? data.wins + data.draws + data.losses : 0;
  const winPct = played ? Math.round((data!.wins / played) * 100) : 0;
  const gd = data ? data.goalsFor - data.goalsAgainst : 0;

  return (
    <div>
      <div className="section-title">
        <h1>ダッシュボード</h1>
        <span className="sub">{currentCareer.team_name}{currentCareer.team_code ? `（${currentCareer.team_code}）` : ''}・{currentSeason?.label ?? '全シーズン'}</span>
      </div>

      {/* 違反アラート */}
      {violations.length > 0 && (
        <div className="notice notice--err mb-16" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <strong>⚠ 縛りの違反 {violations.length} 件</strong>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {violations.map((v, i) => (
              <li key={i} style={{ marginTop: 2 }}>{v.label}：{v.detail}</li>
            ))}
          </ul>
        </div>
      )}

      {/* KPI カード */}
      <div className="dash-kpis">
        <Kpi label="在籍選手" value={`${data?.totalPlayers ?? 0}`} sub={`うちアカデミー ${data?.academyCount ?? 0}`} />
        <Kpi label="勝率" value={`${winPct}%`} sub={`${data?.wins ?? 0}勝 ${data?.draws ?? 0}分 ${data?.losses ?? 0}敗`} accent />
        <Kpi label="得失点差" value={`${gd > 0 ? '+' : ''}${gd}`} sub={`${data?.goalsFor ?? 0} 得 / ${data?.goalsAgainst ?? 0} 失`} />
        <Kpi label="登録シーズン" value={`${seasons.length}`} sub={`縛り ${constraints?.length ?? 0} 件`} />
      </div>

      {/* 勝敗バー */}
      {played > 0 && (
        <div className="card card--pad mt-16">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="subhead" style={{ margin: 0, border: 'none', padding: 0 }}>勝敗（{currentSeason?.label ?? '通算'}・{played}試合）</span>
            <span className="info-line">{data!.wins}W {data!.draws}D {data!.losses}L</span>
          </div>
          <div className="wdl-bar">
            <span className="wdl-bar__w" style={{ flexGrow: data!.wins || 0.001 }} title={`${data!.wins}勝`} />
            <span className="wdl-bar__d" style={{ flexGrow: data!.draws || 0.001 }} title={`${data!.draws}分`} />
            <span className="wdl-bar__l" style={{ flexGrow: data!.losses || 0.001 }} title={`${data!.losses}敗`} />
          </div>
        </div>
      )}

      {/* ランキング */}
      <div className="dash-cols mt-16">
        <RankCard title="得点ランキング" rows={data?.topScorers ?? []} unit="G" />
        <RankCard title="アシストランキング" rows={data?.topAssists ?? []} unit="A" />
        <RankCard title="平均評価" rows={data?.topRated ?? []} unit="" />
      </div>

      {/* 大会成績サマリ */}
      <div className="card card--pad mt-16">
        <div className="subhead" style={{ marginTop: 0 }}>主要大会の成績</div>
        {data && data.records.length > 0 ? (
          <div className="comp-summary">
            {data.records.map((r) => (
              <div key={r.id} className="comp-summary__item">
                <span className="pill">{r.competition_type}</span>
                <span className="comp-summary__name">{r.competition_name}</span>
                <span className="comp-summary__pos">{r.final_position || '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="info-line">このシーズンの大会成績は未登録です。「成績」タブから追加できます。</p>
        )}
      </div>

      <div className="mt-24"><DataNotice /></div>
    </div>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`card card--pad dash-kpi ${accent ? 'dash-kpi--accent' : ''}`}>
      <div className="dash-kpi__label">{label}</div>
      <div className="dash-kpi__value">{value}</div>
      {sub && <div className="dash-kpi__sub">{sub}</div>}
    </div>
  );
}

function RankCard({ title, rows, unit }: { title: string; rows: { name: string; value: number }[]; unit: string }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0) || 1;
  return (
    <div className="card card--pad">
      <div className="subhead" style={{ marginTop: 0 }}>{title}</div>
      {rows.length === 0 ? (
        <p className="info-line">データがありません。</p>
      ) : (
        <div className="rank-list">
          {rows.map((r, i) => (
            <div key={i} className="rank-row">
              <span className="rank-row__no">{i + 1}</span>
              <span className="rank-row__name">{r.name}</span>
              <span className="rank-row__bar"><span style={{ width: `${(r.value / max) * 100}%` }} /></span>
              <span className="rank-row__val">{r.value}{unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 自動判定の縛りを評価して違反を集約。
function computeViolations(constraints: Constraint[], players: Player[], transfers: Transfer[]) {
  const out: { label: string; detail: string }[] = [];
  for (const c of constraints) {
    if (!c.is_auto) continue;
    const tpl = getBuiltinTemplate(c.template_key);
    if (!tpl?.evaluate) continue;
    const res = tpl.evaluate(c.params, { players, transfers });
    if (!res.ok) out.push({ label: tpl.label, detail: res.violations.join('、') || '違反あり' });
  }
  return out;
}
