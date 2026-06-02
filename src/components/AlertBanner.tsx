import { useState } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Alert {
  center: string;
  province: string;
  type: string;
  change: number;
  direction: 'up' | 'down';
  detail: string;
}

interface Props {
  data: any[];
}

export default function AlertBanner({ data }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // 分析所有中心的变化
  const alerts: Alert[] = [];
  data.forEach((prov: any) => {
    (prov.subCenters || []).forEach((c: any) => {
      // 效能异常变化
      const jobChange = (c.abnormalCount || 0) - (c.prevAbnormalCount || 0);
      if (jobChange >= 2) {
        alerts.push({ center: c.name, province: prov.province, type: '效能异常', change: jobChange, direction: 'up', detail: `${c.prevAbnormalCount || 0}→${c.abnormalCount}个` });
      } else if (jobChange <= -3) {
        alerts.push({ center: c.name, province: prov.province, type: '效能异常', change: Math.abs(jobChange), direction: 'down', detail: `${c.prevAbnormalCount || 0}→${c.abnormalCount}个` });
      }
      // 日工时高变化
      const whHighChange = (c.t2WhHighCount || 0) - (c.whHighPrevCount || 0);
      if (whHighChange >= 5) {
        alerts.push({ center: c.name, province: prov.province, type: '日工时高', change: whHighChange, direction: 'up', detail: `${c.whHighPrevCount || 0}→${c.t2WhHighCount || 0}人` });
      }
      // 日工时低变化
      const whLowChange = (c.t2WhLowCount || 0) - (c.whLowPrevCount || 0);
      if (whLowChange >= 3) {
        alerts.push({ center: c.name, province: prov.province, type: '日工时低', change: whLowChange, direction: 'up', detail: `${c.whLowPrevCount || 0}→${c.t2WhLowCount || 0}人` });
      }
      // 得分骤降
      if (c.prevScore != null && (c.score || 0) < (c.prevScore || 0) - 10) {
        alerts.push({ center: c.name, province: prov.province, type: '得分下降', change: (c.prevScore || 0) - (c.score || 0), direction: 'down', detail: `${c.prevScore}→${c.score || 0}分` });
      }
    });
  });

  // 没有告警就不显示
  if (alerts.length === 0 || dismissed) return null;

  const worsen = alerts.filter(a => a.direction === 'up' && a.type !== '得分下降').length;
  const improve = alerts.filter(a => a.direction === 'down' && a.type === '效能异常').length;

  return (
    <div className="mx-5 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-600" />
          <span className="text-xs font-bold text-amber-800">数据变化告警</span>
          <span className="text-[10px] text-amber-500">
            {worsen > 0 && `⚠️ ${worsen}项恶化`}
            {worsen > 0 && improve > 0 && ' · '}
            {improve > 0 && `✅ ${improve}项改善`}
          </span>
        </div>
        <button onClick={() => setDismissed(true)} className="p-0.5 hover:bg-amber-100 rounded"><X size={12} className="text-amber-400" /></button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {alerts.slice(0, 6).map((a, i) => (
          <span key={i} className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
            a.direction === 'up' && a.type !== '得分下降' ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700",
          )}>
            {a.direction === 'up' && a.type !== '得分下降' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {a.province}·{a.center} {a.type} {a.change > 0 && `+${a.change}`} {a.detail}
          </span>
        ))}
        {alerts.length > 6 && <span className="text-[10px] text-slate-400 self-center">等 {alerts.length} 项</span>}
      </div>
    </div>
  );
}
