import { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props { data: any[]; }

export default function StatusBar({ data }: Props) {
  // ── 计算告警 ──
  const alerts: any[] = [];
  const warnings: any[] = [];
  data.forEach((prov: any) => {
    (prov.subCenters || []).forEach((c: any) => {
      const jobChange = (c.abnormalCount || 0) - (c.prevAbnormalCount || 0);
      if (jobChange >= 2) alerts.push({ center: c.name, province: prov.province, type: '效能异常', change: jobChange, direction: 'up', detail: (c.prevAbnormalCount || 0) + '→' + c.abnormalCount + '个' });
      else if (jobChange <= -3) alerts.push({ center: c.name, province: prov.province, type: '效能异常', change: Math.abs(jobChange), direction: 'down', detail: (c.prevAbnormalCount || 0) + '→' + c.abnormalCount + '个' });
      const whHighChange = (c.t2WhHighCount || 0) - (c.whHighPrevCount || 0);
      if (whHighChange >= 5) alerts.push({ center: c.name, province: prov.province, type: '日工时高', change: whHighChange, direction: 'up', detail: (c.whHighPrevCount || 0) + '→' + (c.t2WhHighCount || 0) + '人' });
      const whLowChange = (c.t2WhLowCount || 0) - (c.whLowPrevCount || 0);
      if (whLowChange >= 3) alerts.push({ center: c.name, province: prov.province, type: '日工时低', change: whLowChange, direction: 'up', detail: (c.whLowPrevCount || 0) + '→' + (c.t2WhLowCount || 0) + '人' });
      if (c.prevScore != null && (c.score || 0) < (c.prevScore || 0) - 10) alerts.push({ center: c.name, province: prov.province, type: '得分下降', change: (c.prevScore || 0) - (c.score || 0), direction: 'down', detail: c.prevScore + '→' + (c.score || 0) + '分' });
      // 数据校验
      if (c.prevAbnormalCount != null && c.prevAbnormalCount > 0) {
        const ch = Math.abs((c.abnormalCount || 0) - c.prevAbnormalCount) / c.prevAbnormalCount;
        if (ch > 0.3 && Math.abs((c.abnormalCount || 0) - c.prevAbnormalCount) >= 2) {
          const dir = (c.abnormalCount || 0) > c.prevAbnormalCount ? '↑' : '↓';
          warnings.push({ center: c.name, province: prov.province, message: '效能异常' + dir + Math.round(ch * 100) + '%（' + c.prevAbnormalCount + '→' + c.abnormalCount + '个）' });
        }
      }
      if (c.whHighPrevCount != null && c.whHighPrevCount > 0) {
        const ch = Math.abs((c.t2WhHighCount || 0) - c.whHighPrevCount) / c.whHighPrevCount;
        if (ch > 0.3 && Math.abs((c.t2WhHighCount || 0) - c.whHighPrevCount) >= 5) {
          const dir = (c.t2WhHighCount || 0) > c.whHighPrevCount ? '↑' : '↓';
          warnings.push({ center: c.name, province: prov.province, message: '日工时高' + dir + Math.round(ch * 100) + '%（' + c.whHighPrevCount + '→' + (c.t2WhHighCount || 0) + '人）' });
        }
      }
    });
  });
  const [expanded, setExpanded] = useState(false);
  const worsen = alerts.filter(a => a.direction === 'up' && a.type !== '得分下降').length;
  const improve = alerts.filter(a => a.direction === 'down' && a.type === '效能异常').length;
  const scoreDrop = alerts.filter(a => a.type === '得分下降').length;
  const totalIssues = worsen + warnings.length + scoreDrop;

  if (totalIssues === 0) return null;

  return (
    <div className="mx-5 mt-3">
      {/* Collapsed bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-2 text-left transition-all duration-200",
          totalIssues >= 5 ? "bg-red-50/80 border border-red-200/60 rounded-xl" :
          totalIssues >= 2 ? "bg-amber-50/80 border border-amber-200/60 rounded-xl" :
          "bg-slate-50/80 border border-slate-200/60 rounded-xl",
          "hover:shadow-sm"
        )}
      >
        <span className={cn(
          "w-1.5 h-1.5 rounded-full animate-pulse",
          totalIssues >= 5 ? "bg-red-500" : "bg-amber-500",
        )} />
        <span className="text-[11px] font-bold text-slate-700">
          {totalIssues >= 5 ? `${totalIssues} 项需关注` : totalIssues >= 2 ? `${totalIssues} 项变化提醒` : '1 项变化提醒'}
        </span>
        {worsen > 0 && <span className="text-[10px] text-red-500 font-medium">● {worsen} 恶化</span>}
        {improve > 0 && <span className="text-[10px] text-emerald-500 font-medium">● {improve} 改善</span>}
        {warnings.length > 0 && <span className="text-[10px] text-amber-500 font-medium">⚠ {warnings.length} 异常</span>}
        <span className="ml-auto text-slate-300">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-1 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">变化告警</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {alerts.map((a, i) => (
                  <span key={i} className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
                    a.direction === 'up' && a.type !== '得分下降' ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600",
                  )}>
                    {a.direction === 'up' && a.type !== '得分下降' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {a.province}·{a.center} {a.type} {a.detail}
                  </span>
                ))}
              </div>
            </div>
          )}
          {/* Warnings */}
          {warnings.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">数据校验</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {warnings.map((w, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded text-[10px] font-medium text-amber-700">
                    <AlertTriangle size={10} />{w.province}·{w.center} {w.message}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
