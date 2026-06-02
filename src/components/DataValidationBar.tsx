import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  data: any[];
}

interface Warning {
  center: string;
  province: string;
  message: string;
}

export default function DataValidationBar({ data }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const warnings: Warning[] = [];
  const threshold = 0.3; // 30% 变化阈值

  data.forEach((prov: any) => {
    (prov.subCenters || []).forEach((c: any) => {
      // 效能异常数骤变
      if (c.prevAbnormalCount != null && c.prevAbnormalCount > 0) {
        const change = Math.abs((c.abnormalCount || 0) - c.prevAbnormalCount) / c.prevAbnormalCount;
        if (change > threshold && Math.abs((c.abnormalCount || 0) - c.prevAbnormalCount) >= 2) {
          const dir = (c.abnormalCount || 0) > c.prevAbnormalCount ? '↑' : '↓';
          warnings.push({ center: c.name, province: prov.province, message: `效能异常${dir}${Math.round(change * 100)}%（${c.prevAbnormalCount}→${c.abnormalCount}个）` });
        }
      }

      // 日工时高骤变
      if (c.whHighPrevCount != null && c.whHighPrevCount > 0) {
        const change = Math.abs((c.t2WhHighCount || 0) - c.whHighPrevCount) / c.whHighPrevCount;
        if (change > threshold && Math.abs((c.t2WhHighCount || 0) - c.whHighPrevCount) >= 5) {
          const dir = (c.t2WhHighCount || 0) > c.whHighPrevCount ? '↑' : '↓';
          warnings.push({ center: c.name, province: prov.province, message: `日工时高${dir}${Math.round(change * 100)}%（${c.whHighPrevCount}→${c.t2WhHighCount || 0}人）` });
        }
      }
    });
  });

  if (warnings.length === 0 || dismissed) return null;

  return (
    <div className={cn("mx-5 mb-2 p-2.5 rounded-xl flex items-start gap-2", warnings.length >= 3 ? "bg-red-50 border border-red-200" : "bg-amber-50 border border-amber-200")}>
      <AlertTriangle size={14} className={warnings.length >= 3 ? "text-red-500 mt-0.5 shrink-0" : "text-amber-500 mt-0.5 shrink-0"} />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-bold text-red-700">数据异常校验</span>
        <span className="text-[10px] text-red-500 ml-2">以下指标变化幅度过大，请核实数据源是否有误：</span>
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {warnings.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/60 rounded text-[10px] font-medium text-red-600">
              {w.province}·{w.center} {w.message}
            </span>
          ))}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="p-0.5 hover:bg-red-100 rounded shrink-0"><X size={12} className="text-red-400" /></button>
    </div>
  );
}
