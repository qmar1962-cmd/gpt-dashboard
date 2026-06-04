import { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, FileText, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { DIM_COLORS } from '../lib/theme';

interface Props {
  selection: any;
  data: any[];
  filteredData: any[];
  exemptCenters: Set<string>;
  onOpenReport?: () => void;
  onResetSelection?: () => void;
}

const DIMS = [
  { key: 'job',    label: DIM_COLORS.job.label,    color: DIM_COLORS.job.hex,    maxScore: 25 },
  { key: 'salary', label: DIM_COLORS.salary.label, color: DIM_COLORS.salary.hex, maxScore: 15 },
  { key: 'att15',  label: DIM_COLORS.att15.label,  color: DIM_COLORS.att15.hex,  maxScore: 25 },
  { key: 'att7',   label: DIM_COLORS.att7.label,   color: DIM_COLORS.att7.hex,   maxScore: 25 },
  { key: 'whHigh', label: DIM_COLORS.whHigh.label, color: DIM_COLORS.whHigh.hex, maxScore: 5 },
  { key: 'whLow',  label: DIM_COLORS.whLow.label,  color: DIM_COLORS.whLow.hex,  maxScore: 5 },
];

export default function SidePanel({ selection, data, filteredData, exemptCenters, onOpenReport, onResetSelection }: Props) {
  // ── 汇总指标 ──
  let overview: any = null;
  const getCenters = (provFilter?: string) => {
    const list: any[] = [];
    filteredData.forEach((prov: any) => {
      if (provFilter && prov.province !== provFilter) return;
      (prov.subCenters || []).forEach((c: any) => { if (!exemptCenters.has(c.id)) list.push({ ...c, province: prov.province }); });
    });
    return list;
  };
  if (selection.type === 'center') {
    for (const r of filteredData) {
      const c = r.subCenters?.find((c: any) => c.id === selection.id);
      if (c) {
        overview = {
          score: c.score || 0,
          nonOpRatio: c.nonOpRatio || 0,
          compositeScope: c.compositeScope || 0,
          leaderScope: c.leaderScope || 0,
          abnormalCount: c.abnormalCount || 0,
          salaryCount: c.t2SalaryCount || 0,
          salaryCoverage: parseFloat(c.salaryCoverage || '0'),
          att15Count: c.att15Count || 0,
          att15Rate: parseFloat(c.att15Rate || '0'),
          att7Count: c.att7Count || 0,
          whHighCount: c.t2WhHighCount || 0,
          whHighRate: parseFloat(c.whHighRate || '0'),
          whLowCount: c.t2WhLowCount || 0,
          rosterTotal: c.rosterTotal || 0,
          province: r.province,
        };
        break;
      }
    }
  } else if (selection.type === 'region') {
    const region = filteredData.find((r: any) => r.id === selection.id);
    const centers = getCenters(region?.province);
    if (centers.length > 0) {
      const avg = (fn: (c: any) => number) => Math.round(centers.reduce((s, c) => s + fn(c), 0) / centers.length * 10) / 10;
      const sum = (fn: (c: any) => number) => Math.round(centers.reduce((s, c) => s + fn(c), 0));
      overview = {
        score: Math.round(centers.reduce((s, c) => s + (c.score || 0), 0) / centers.length),
        nonOpRatio: avg(c => c.nonOpRatio || 0),
        compositeScope: avg(c => c.compositeScope || 0),
        leaderScope: avg(c => c.leaderScope || 0),
        abnormalCount: sum(c => c.abnormalCount || 0),
        salaryCount: sum(c => c.t2SalaryCount || 0),
        salaryCoverage: avg(c => parseFloat(c.salaryCoverage || '0')),
        att15Count: sum(c => c.t2Att15Count || 0),
        att15Rate: avg(c => parseFloat(c.att15Rate || '0')),
        att7Count: sum(c => c.t2Att7Count || 0),
        whHighCount: sum(c => c.t2WhHighCount || 0),
        whHighRate: avg(c => parseFloat(c.whHighRate || '0')),
        whLowCount: sum(c => c.t2WhLowCount || 0),
        rosterTotal: sum(c => c.rosterTotal || 0),
        province: region?.province || '',
      };
    }
  } else {
    const centers = getCenters();
    if (centers.length > 0) {
      const avg = (fn: (c: any) => number) => Math.round(centers.reduce((s, c) => s + fn(c), 0) / centers.length * 10) / 10;
      const sum = (fn: (c: any) => number) => Math.round(centers.reduce((s, c) => s + fn(c), 0));
      overview = {
        score: avg(c => c.score || 0),
        nonOpRatio: avg(c => c.nonOpRatio || 0),
        compositeScope: avg(c => c.compositeScope || 0),
        leaderScope: avg(c => c.leaderScope || 0),
        abnormalCount: sum(c => c.abnormalCount || 0),
        salaryCount: sum(c => c.t2SalaryCount || 0),
        salaryCoverage: avg(c => parseFloat(c.salaryCoverage || '0')),
        att15Count: sum(c => c.t2Att15Count || 0),
        att15Rate: avg(c => parseFloat(c.att15Rate || '0')),
        att7Count: sum(c => c.t2Att7Count || 0),
        whHighCount: sum(c => c.t2WhHighCount || 0),
        whHighRate: avg(c => parseFloat(c.whHighRate || '0')),
        whLowCount: sum(c => c.t2WhLowCount || 0),
        rosterTotal: sum(c => c.rosterTotal || 0),
        province: '全区',
      };
    }
  }

  const dimScores = DIMS.map(dim => {
    let score = 0;
    if (selection.type === 'all') {
      const valid = data.filter((r: any) => r.dimensions?.[dim.key] !== undefined);
      score = valid.length > 0 ? valid.reduce((s: number, r: any) => s + (r.dimensions?.[dim.key]?.score ?? 0), 0) / valid.length : 0;
    } else if (selection.type === 'region') {
      score = data.find((r: any) => r.id === selection.id)?.dimensions?.[dim.key]?.score ?? 0;
    } else if (selection.type === 'center') {
      for (const r of data) {
        const c = r.subCenters?.find((c: any) => c.id === selection.id);
        if (c) { score = c.metrics?.[dim.key] ?? 0; break; }
      }
    }
    return { ...dim, score: Math.round(score) };
  });

  // ── 告警 ──
  const alerts: any[] = [], warnings: any[] = [];
  filteredData.forEach((prov: any) => {
    (prov.subCenters || []).forEach((c: any) => {
      const jc = (c.abnormalCount || 0) - (c.prevAbnormalCount || 0);
      if (jc >= 2) alerts.push({ province: prov.province, center: c.name, type: '效能', dir: 'up', detail: `${c.prevAbnormalCount || 0}→${c.abnormalCount}个` });
      else if (jc <= -3) alerts.push({ province: prov.province, center: c.name, type: '效能', dir: 'down', detail: `${c.prevAbnormalCount || 0}→${c.abnormalCount}个` });
      const whc = (c.t2WhHighCount || 0) - (c.whHighPrevCount || 0);
      if (whc >= 5) alerts.push({ province: prov.province, center: c.name, type: '工时高', dir: 'up', detail: `${c.whHighPrevCount || 0}→${c.t2WhHighCount || 0}人` });
      const wlc = (c.t2WhLowCount || 0) - (c.whLowPrevCount || 0);
      if (wlc >= 3) alerts.push({ province: prov.province, center: c.name, type: '工时低', dir: 'up', detail: `${c.whLowPrevCount || 0}→${c.t2WhLowCount || 0}人` });
      if (c.prevScore != null && (c.score || 0) < (c.prevScore || 0) - 10) alerts.push({ province: prov.province, center: c.name, type: '得分↓', dir: 'down', detail: `${c.prevScore}→${c.score || 0}分` });
      if (c.prevAbnormalCount > 0) {
        const ch = Math.abs((c.abnormalCount || 0) - c.prevAbnormalCount) / c.prevAbnormalCount;
        if (ch > 0.3 && Math.abs((c.abnormalCount || 0) - c.prevAbnormalCount) >= 2) {
          warnings.push({ province: prov.province, center: c.name, msg: `效能异常${(c.abnormalCount || 0) > c.prevAbnormalCount ? '↑' : '↓'}${Math.round(ch * 100)}%（${c.prevAbnormalCount}→${c.abnormalCount}个）` });
        }
      }
      if (c.whHighPrevCount > 0) {
        const ch = Math.abs((c.t2WhHighCount || 0) - c.whHighPrevCount) / c.whHighPrevCount;
        if (ch > 0.3 && Math.abs((c.t2WhHighCount || 0) - c.whHighPrevCount) >= 5) {
          warnings.push({ province: prov.province, center: c.name, msg: `日工时高${(c.t2WhHighCount || 0) > c.whHighPrevCount ? '↑' : '↓'}${Math.round(ch * 100)}%（${c.whHighPrevCount}→${c.t2WhHighCount || 0}人）` });
        }
      }
    });
  });
  const [alertsOpen, setAlertsOpen] = useState(false);
  const worsen = alerts.filter(a => a.dir === 'up' && a.type !== '得分↓').length;
  const improve = alerts.filter(a => a.dir === 'down' && a.type === '效能').length;
  const total = worsen + warnings.length + alerts.filter(a => a.type === '得分↓').length;
  const hasAlerts = total > 0;

  // ── 行动指令 ──
  const actions: string[] = [];
  const allCenters: any[] = [];
  filteredData.forEach((prov: any) => {
    (prov.subCenters || []).forEach((c: any) => {
      if (!exemptCenters.has(c.id)) allCenters.push({ province: prov.province, center: c.name, score: c.score || 0, jobCount: c.abnormalCount || 0, salaryCount: c.t2SalaryCount || 0, att15Count: c.t2Att15Count || 0, att7Count: c.t2Att7Count || 0 });
    });
  });
  allCenters.sort((a, b) => a.score - b.score).slice(0, 2).forEach((c: any) => {
    if (c.jobCount > 0) actions.push(`${c.center}：改善岗位效能异常（${c.jobCount}个）`);
    if (c.salaryCount > 0) actions.push(`${c.center}：修正薪资异常（${c.salaryCount}人）`);
    if (c.att15Count > 0) actions.push(`${c.center}：落实调休计划（${c.att15Count}人连出勤≥15天）`);
  });

  return (
    <div className="flex flex-col h-full bg-[#faf7f2] border-l border-[#e8e2d9]">
      {/* 综合总览 */}
      <div className="p-5 border-b border-[#e8e2d9]">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
          {selection.type === 'all' ? '全区综合总览' : selection.type === 'center' ? overview?.province + ' · ' + (selection.label || '') : selection.label || '综合总览'}
        </span>

        {overview && (
          <div className="mt-3 space-y-2">
            {/* 得分大数 */}
            <div className="flex items-end justify-between">
              <span className="text-[11px] text-slate-500">综合得分</span>
              <span className={cn("text-2xl font-black tabular-nums", overview.score >= 80 ? "text-[#3d5a3d]" : overview.score >= 60 ? "text-[#3d4d5a]" : overview.score >= 40 ? "text-[#5a4d3d]" : "text-[#5a3d3d]")}>
                {overview.score}
              </span>
            </div>

            {/* KPI 网格 */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 pt-2 border-t border-[#e8e2d9]">
              <KPI label="非操占比" value={overview.nonOpRatio + '%'} />
              <KPI label="效能异常" value={overview.abnormalCount + '个'} warn={overview.abnormalCount >= 3} />
              <KPI label="绩效异常" value={overview.salaryCount + '人'} sub={overview.salaryCoverage + '%'} />
              <KPI label="连续出勤≥15天" value={overview.att15Count + '人'} sub={overview.att15Rate + '%'} />
              <KPI label="长期未出勤≥7天" value={overview.att7Count + '人'} warn={overview.att7Count > 0} />
              <KPI label="日工时高>12.5h" value={overview.whHighCount + '人'} sub={overview.whHighRate + '%'} />
              <KPI label="日工时低≤8h" value={overview.whLowCount + '人'} warn={overview.whLowCount > 0} />
              <KPI label="综合管幅" value={overview.compositeScope} />
              <KPI label="在册人数" value={overview.rosterTotal + '人'} />
            </div>

          </div>
        )}
      </div>

      {/* 生成通报 */}
      {onOpenReport && (
        <div className="px-5 pt-2">
          <button onClick={onOpenReport} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-slate-800 transition-colors">
            <FileText size={13} />生成通报报告
          </button>
        </div>
      )}

      {/* 底部对齐：维度评分 → 关键行动 */}
      <div>
        {/* 维度得分条 */}
        {overview && (
          <div className="px-5 py-3 border-t border-[#e8e2d9]">
            <div className="space-y-2.5">
              {dimScores.map(dim => (
                <div key={dim.key} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600 w-16 shrink-0">{dim.label}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: dim.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(2, (dim.score / dim.maxScore) * 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums w-8 text-right" style={{ color: dim.color }}>{dim.score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 关键行动 + 告警 */}
        {(actions.length > 0 || hasAlerts) && (
          <div className="px-5 py-4 border-t border-[#e8e2d9]">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={13} className="text-[#5a6b7a] fill-[#5a6b7a]" />
              <span className="text-[11px] font-bold text-[#3d4d5a] uppercase tracking-wider">关键行动</span>
              {hasAlerts && (
                <span className={cn("ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full", total >= 5 ? "bg-[#e6d4d4] text-[#5a3d3d]" : "bg-[#e6ddd4] text-[#5a4d3d]")}>
                  {total} 项关注
                </span>
              )}
            </div>
            {actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px] text-slate-700 leading-relaxed mb-2.5">
                <span className="text-[#5a6b7a] font-bold mt-0.5 shrink-0">{i + 1}.</span>
                <span>{a}</span>
              </div>
            ))}
            {hasAlerts && (
              <>
                <button onClick={() => setAlertsOpen(!alertsOpen)} className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                  {alertsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {alertsOpen ? '收起' : `展开详情 · ${worsen}恶化 ${improve}改善 ${warnings.length}校验`}
                </button>
                {alertsOpen && (
                  <div className="mt-3 space-y-3 max-h-64 overflow-y-auto text-[11px] leading-relaxed">
                    {alerts.filter(a => a.dir === 'up' && a.type !== '得分↓').length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 mb-1 text-[#7a5a5a]">
                          <TrendingUp size={10} /><span className="font-semibold">指标恶化</span>
                        </div>
                        {alerts.filter(a => a.dir === 'up' && a.type !== '得分↓').map((a, i) => (
                          <div key={i} className="text-slate-600 ml-3">
                            <span className="font-semibold text-slate-800">{a.center}</span>
                            <span className="text-[#7a5a5a]"> {a.type}+{a.detail.split('→')[1]?.replace('个','') || a.detail}</span>
                            <span className="text-slate-400">（前{a.detail.split('→')[0]}）</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {alerts.filter(a => a.dir === 'down' || a.type === '得分↓').length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 mb-1 text-[#3d5a3d]">
                          <TrendingDown size={10} /><span className="font-semibold">改善</span>
                        </div>
                        {alerts.filter(a => a.dir === 'down' || a.type === '得分↓').map((a, i) => (
                          <div key={i} className="text-slate-600 ml-3">
                            <span className="font-semibold text-slate-800">{a.center}</span>
                            <span className="text-[#3d5a3d]"> {a.type} {a.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {warnings.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1 mb-1 text-[#5a4d3d]">
                          <AlertTriangle size={10} /><span className="font-semibold">数据校验</span>
                        </div>
                        {warnings.map((w, i) => (
                          <div key={i} className="text-slate-600 ml-3">
                            <span className="font-semibold text-slate-800">{w.center}</span>
                            <span> {w.msg}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
      )}
    </div>
      {/* 返回全局 */}
      {selection.type !== 'all' && onResetSelection && (
        <div className="p-5 pt-0">
          <button onClick={onResetSelection} className="w-full text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors">
            ← 返回全区总览
          </button>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, sub, warn }: { label: string; value: string | number; sub?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</span>
      <span className={cn("text-[13px] font-bold tabular-nums leading-tight", warn ? "text-[#7a5a5a]" : "text-slate-800")}>{value}</span>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  );
}
