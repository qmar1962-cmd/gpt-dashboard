import { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, FileText, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  selection: any;
  data: any[];
  filteredData: any[];
  exemptCenters: Set<string>;
  onOpenReport?: () => void;
  onResetSelection?: () => void;
}

const DIMS = [
  { key: 'job', label: '效能异常', color: '#ef4444', maxScore: 25 },
  { key: 'salary', label: '绩效异常', color: '#f59e0b', maxScore: 15 },
  { key: 'att15', label: '连续出勤', color: '#10b981', maxScore: 25 },
  { key: 'att7', label: '长期未出勤', color: '#8b5cf6', maxScore: 25 },
  { key: 'whHigh', label: '日工时高', color: '#f97316', maxScore: 5 },
  { key: 'whLow', label: '日工时低', color: '#06b6d4', maxScore: 5 },
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
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* 综合总览 */}
      <div className="p-5 border-b border-slate-100">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">
          {selection.type === 'all' ? '全区综合总览' : selection.type === 'center' ? overview?.province + ' · ' + (selection.label || '') : selection.label || '综合总览'}
        </span>

        {overview && (
          <div className="mt-3 space-y-2">
            {/* 得分大数 */}
            <div className="flex items-end justify-between">
              <span className="text-[10px] text-slate-400">综合得分</span>
              <span className={cn("text-2xl font-black tabular-nums", overview.score >= 80 ? "text-emerald-600" : overview.score >= 60 ? "text-blue-600" : overview.score >= 40 ? "text-amber-600" : "text-red-600")}>
                {overview.score}
              </span>
            </div>

            {/* KPI 网格 */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-1 border-t border-slate-100">
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

            {/* 维度得分条 */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">维度评分</span>
              <div className="mt-2 space-y-1.5">
                {dimScores.map(dim => (
                  <div key={dim.key} className="flex items-center gap-2">
                    <span className="text-[9px] text-slate-500 w-16 shrink-0">{dim.label}</span>
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ backgroundColor: dim.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(2, (dim.score / dim.maxScore) * 100)}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums w-8 text-right" style={{ color: dim.color }}>{dim.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 生成通报 */}
      {onOpenReport && (
        <div className="px-5 pt-3">
          <button onClick={onOpenReport} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-slate-800 transition-colors">
            <FileText size={13} />生成通报报告
          </button>
        </div>
      )}

      {/* 关键行动 + 告警 */}
      {(actions.length > 0 || hasAlerts) && (
        <div className="p-5 pt-3 flex-1">
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={13} className="text-blue-500 fill-blue-500" />
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">关键行动</span>
              {hasAlerts && (
                <span className={cn("ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full", total >= 5 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600")}>
                  {total} 项关注
                </span>
              )}
            </div>
            {actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px] text-slate-700 leading-relaxed mb-2">
                <span className="text-blue-400 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                <span>{a}</span>
              </div>
            ))}
            {hasAlerts && (
              <>
                <button onClick={() => setAlertsOpen(!alertsOpen)} className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
                  {alertsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                  {alertsOpen ? '收起变化详情' : `查看变化详情 · ${worsen}项恶化 · ${improve}项改善 · ${warnings.length}项异常`}
                </button>
                {alertsOpen && (
                  <div className="mt-3 space-y-3 max-h-64 overflow-y-auto">
                    {/* 恶化项 */}
                    {alerts.filter(a => a.dir === 'up' && a.type !== '得分↓').length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <TrendingUp size={11} className="text-red-500" />
                          <span className="text-[10px] font-bold text-red-600">指标恶化</span>
                        </div>
                        {alerts.filter(a => a.dir === 'up' && a.type !== '得分↓').map((a, i) => (
                          <div key={i} className="ml-5 pl-3 py-1 border-l-2 border-red-200 text-[10px] text-slate-600 leading-relaxed">
                            <span className="font-semibold text-slate-800">{a.province} {a.center}</span>
                            <span className="text-red-500 font-medium"> {a.type}+{a.detail.split('→')[1]?.replace('个','') || a.detail}</span>
                            <span className="text-slate-400">（前一天{a.detail.split('→')[0]}）</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 改善项 */}
                    {alerts.filter(a => a.dir === 'down' || a.type === '得分↓').length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <TrendingDown size={11} className="text-emerald-500" />
                          <span className="text-[10px] font-bold text-emerald-600">指标改善 / 得分下降</span>
                        </div>
                        {alerts.filter(a => a.dir === 'down' || a.type === '得分↓').map((a, i) => (
                          <div key={i} className="ml-5 pl-3 py-1 border-l-2 border-emerald-200 text-[10px] text-slate-600 leading-relaxed">
                            <span className="font-semibold text-slate-800">{a.province} {a.center}</span>
                            <span className="text-emerald-500 font-medium"> {a.type} {a.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* 数据校验异常 */}
                    {warnings.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <AlertTriangle size={11} className="text-amber-500" />
                          <span className="text-[10px] font-bold text-amber-600">数据校验异常</span>
                          <span className="text-[9px] text-amber-400">可能数据源有误，建议核实</span>
                        </div>
                        {warnings.map((w, i) => (
                          <div key={i} className="ml-5 pl-3 py-1 border-l-2 border-amber-200 text-[10px] text-slate-600 leading-relaxed">
                            <span className="font-semibold text-slate-800">{w.province} {w.center}</span>
                            <span className="text-amber-600"> {w.msg}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
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
      <span className="text-[8px] text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={cn("text-[12px] font-bold tabular-nums leading-tight", warn ? "text-red-500" : "text-slate-800")}>{value}</span>
      {sub && <span className="text-[9px] text-slate-400">{sub}</span>}
    </div>
  );
}
