import { useState, useEffect } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { idbGetRawData } from '../lib/database';
import { DIM_COLORS } from '../lib/theme';

interface Props {
  centerName: string;
  provinceName: string;
  isOpen: boolean;
  onClose: () => void;
}

const DIMS = [
  { key: 'job',    label: DIM_COLORS.job.label,    color: DIM_COLORS.job.hex,    type: 'job_performance',      abnormal: true },
  { key: 'salary', label: DIM_COLORS.salary.label, color: DIM_COLORS.salary.hex, type: 'salary_performance',    abnormal: false },
  { key: 'att15',  label: '连续出勤≥15天',          color: DIM_COLORS.att15.hex,  type: 'attendance_15days',      abnormal: false },
  { key: 'att7',   label: '长期未出勤≥7天',          color: DIM_COLORS.att7.hex,   type: 'attendance_7days',       abnormal: false },
  { key: 'whHigh', label: '日工时高>12.5h',           color: DIM_COLORS.whHigh.hex, type: 'work_hours_high',         abnormal: false },
  { key: 'whLow',  label: '日工时低≤8h',             color: DIM_COLORS.whLow.hex,  type: 'work_hours_low',          abnormal: false },
];

const DAY_OPTIONS = [7, 14, 30, 60, 999];

function countByDate(rawData: any[], centerName: string): Record<string, number> {
  const map: Record<string, number> = {};
  if (!rawData?.length) return map;
  const keys = Object.keys(rawData[0]);
  const dateCol = keys.find(k => /日期|数据日期/i.test(k));
  const centerCol = keys.find(k => /中心|中心名称/i.test(k));
  if (!dateCol || !centerCol) return map;
  rawData.forEach(r => {
    const c = String(r[centerCol] || '').trim();
    if (c !== centerName) return;
    const d = String(r[dateCol] || '').trim();
    if (!d) return;
    map[d] = (map[d] || 0) + 1;
  });
  return map;
}

export default function CenterTrendModal({ centerName, provinceName, isOpen, onClose }: Props) {
  const [allData, setAllData] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [dim, setDim] = useState('job');
  const [days, setDays] = useState(14);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    (async () => {
      try {
        const results: Record<string, Record<string, number>> = {};
        for (const d of DIMS) {
          const stored = await idbGetRawData(d.type as any);
          const rawData = stored?.rawData || [];
          if (d.abnormal) {
            const keys = rawData.length > 0 ? Object.keys(rawData[0]) : [];
            const dateCol = keys.find(k => /日期|数据日期/i.test(k));
            const centerCol = keys.find(k => /中心|中心名称/i.test(k));
            const devCol = keys.find(k => /偏离/i.test(k));
            const map: Record<string, number> = {};
            if (dateCol && centerCol) {
              rawData.forEach((r: any) => {
                const c = String(r[centerCol] || '').trim();
                if (c !== centerName) return;
                const dt = String(r[dateCol] || '').trim();
                if (!dt) return;
                if (parseFloat(r[devCol] || '0') >= 10) map[dt] = (map[dt] || 0) + 1;
              });
            }
            results[d.key] = map;
          } else {
            results[d.key] = countByDate(rawData, centerName);
          }
        }
        setAllData(results);
      } catch (e) { console.error('趋势数据加载失败:', e); }
      finally { setLoading(false); }
    })();
  }, [isOpen, centerName]);

  if (!isOpen) return null;

  // 按全部维度合并日期列表
  const allDateSet = new Set<string>();
  Object.values(allData).forEach(m => Object.keys(m).forEach(d => allDateSet.add(d)));
  const allDates = Array.from(allDateSet).sort();
  const slicedDates = days === 999 ? allDates : allDates.slice(-days);

  const dimDef = DIMS.find(d => d.key === dim)!;
  const chartData = slicedDates.map(d => ({
    date: d.slice(5),
    fullDate: d,
    ...Object.fromEntries(DIMS.map(dd => [dd.key, allData[dd.key]?.[d] || 0])),
  }));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-[680px] max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <h2 className="text-sm font-black text-slate-900">{provinceName} · {centerName}</h2>
            <span className="text-[10px] text-slate-400">历史趋势</span>
          </div>
          <div className="flex items-center gap-2">
            {DAY_OPTIONS.map(n => (
              <button key={n} onClick={() => setDays(n)} className={cn(
                "px-1.5 py-0.5 text-[10px] rounded transition-colors",
                days === n ? "bg-slate-200 text-slate-700 font-medium" : "text-slate-400 hover:text-slate-600",
              )}>{n === 999 ? '全部' : n + '天'}</button>
            ))}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg ml-1"><X size={15} className="text-slate-400" /></button>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-16 text-sm text-slate-400">加载中...</div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-16 text-sm text-slate-400">暂无历史数据</div>
          ) : (
            <>
              {/* 折线图 */}
              <div className="mb-4">
                <div className="text-[10px] font-bold mb-2" style={{ color: dimDef.color }}>{dimDef.label}趋势</div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#ddd" interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#ddd" allowDecimals={false} width={24} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [v, dimDef.label]} />
                    <Line type="monotone" dataKey={dim} stroke={dimDef.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} name={dimDef.label} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 数据明细表 — 点表头切换维度 */}
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 sticky top-0">
                      <th className="px-2 py-2 text-left text-slate-400 font-medium">日期</th>
                      {DIMS.map(d => (
                        <th key={d.key} onClick={() => setDim(d.key)}
                          className={cn(
                            "px-1.5 py-2 text-right cursor-pointer transition-colors hover:bg-slate-100",
                            dim === d.key ? "font-bold" : "font-medium text-slate-400",
                          )}
                          style={dim === d.key ? { color: d.color } : {}}
                        >
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((d: any) => (
                      <tr key={d.fullDate} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-2 py-1.5 text-slate-600 font-medium">{d.fullDate}</td>
                        {DIMS.map(dd => (
                          <td key={dd.key} className={cn(
                            "px-1.5 py-1.5 text-right tabular-nums",
                            dim === dd.key ? "font-bold" : "text-slate-500",
                          )} style={dim === dd.key ? { color: dd.color } : {}}>
                            {d[dd.key] || 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
