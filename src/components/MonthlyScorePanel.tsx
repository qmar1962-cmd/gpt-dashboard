/**
 * 月度计分面板 — 汇总表格 + 可展开每日明细
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { getT2MonthLabel, formatMonth } from '../lib/dateUtils';
import type { CenterMonthlyScore, DailyDetail, MonthlyResult } from '../hooks/useMonthlyScore';

interface MonthlyScorePanelProps {
  data: MonthlyResult;
  loading: boolean;
  monthLabel: string;
  monthOffset: number;
  onOffsetChange: (offset: number) => void;
  exemptCenters: Set<string>;
}

const DIM_COLS = [
  { key: 'job' as const,     label: '效能异常',  max: 25 },
  { key: 'salary' as const,  label: '绩效异常',  max: 15 },
  { key: 'att15' as const,   label: '连续出勤',  max: 25 },
  { key: 'att7' as const,    label: '长期未出勤', max: 25 },
  { key: 'whHigh' as const,  label: '日工时高', max: 5  },
  { key: 'whLow' as const,   label: '日工时低', max: 5  },
];

function scoreColor(s: number, exempt: boolean): string {
  if (exempt) return 'text-slate-400';
  if (s >= 80) return 'text-emerald-600';
  if (s >= 60) return 'text-blue-600';
  return 'text-amber-600';
}

function dimScoreColor(s: number, max: number, exempt: boolean): string {
  if (exempt) return 'text-slate-300';
  if (s >= max * 0.8) return 'text-slate-700';
  if (s >= max * 0.6) return 'text-amber-600';
  return 'text-red-500';
}

function renderDim(d: number, max: number) {
  return `${d}/${max}`;
}

export default function MonthlyScorePanel({
  data, loading, monthLabel, monthOffset, onOffsetChange, exemptCenters = [],
}: MonthlyScorePanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const t2Month = getT2MonthLabel();
  const canGoNext = formatMonth(monthOffset) !== t2Month;

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── 加载中 ──
  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 size={28} className="animate-spin" />
        <span className="text-xs">正在从数据库读取全量数据并计算月度得分...</span>
      </div>
    );
  }

  // ── 空数据 ──
  if (!data || data.centers.length === 0) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-2 text-slate-400">
        <span className="text-lg">📭</span>
        <span className="text-xs">该月暂无数据</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onOffsetChange(monthOffset - 1)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-base font-bold text-slate-800 tabular-nums">{monthLabel}</span>
          <button
            onClick={() => canGoNext && onOffsetChange(monthOffset + 1)}
            disabled={!canGoNext}
            className={cn(
              'p-1.5 rounded transition-colors',
              canGoNext ? 'hover:bg-slate-100 text-slate-500' : 'text-slate-300 cursor-not-allowed'
            )}
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
        <div className="text-[11px] text-slate-400">
          共 {data.centers.length} 个中心
        </div>
      </div>

      {/* 省区 + 大区排名得分 */}
      <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center gap-6 text-[11px]">
        <span className="font-semibold text-slate-700">排名考核得分：</span>
        <span className="text-slate-600">大区 <span className="font-bold text-blue-600">{data.regionTieredScore}</span> 分</span>
        {data.provinceScores.map(p => (
          <span key={p.province} className="text-slate-500">{p.province} <span className="font-bold text-blue-600">{p.tieredScore}</span> 分</span>
        ))}
      </div>

      {/* 汇总表格（横向滚动） */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-[11px] border-collapse table-fixed">
          <thead className="sticky top-0 bg-slate-50 z-[5]">
            <tr>
              <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 w-8"></th>
              <th className="text-left px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200">中心</th>
              <th className="text-right px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200">月度得分</th>
              <th className="text-right px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200">排名得分</th>
              {DIM_COLS.map(d => (
                <th key={d.key} className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200">{d.label}</th>
              ))}
              <th className="text-right px-4 py-2.5 font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200">数据天数</th>
            </tr>
          </thead>
          <tbody>
            {data.centers.map(row => {
              const key = `${row.province}_${row.centerName}`;
              const isExempt = exemptCenters.has(row.centerName);
              const isOpen = expanded.has(key);
              return (
                <MonthlyRow
                  key={key}
                  row={row}
                  isExempt={isExempt}
                  isOpen={isOpen}
                  onToggle={() => toggle(key)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 中心行组件 ──
function MonthlyRow({ row, isExempt, isOpen, onToggle }: {
  row: CenterMonthlyScore;
  isExempt: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* 汇总行 */}
      <tr
        onClick={onToggle}
        className={cn(
          'border-b border-slate-100 cursor-pointer hover:bg-slate-50/60 transition-colors',
          isExempt && 'bg-slate-50/50'
        )}
      >
        <td className="px-4 py-2.5 text-slate-400">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className={cn('px-4 py-2.5 font-bold whitespace-nowrap', isExempt ? 'text-slate-400' : 'text-slate-800')}>
          {row.centerName}
        </td>
        <td className={cn('px-4 py-2.5 text-right font-black tabular-nums whitespace-nowrap', scoreColor(row.monthlyScore, isExempt))}>
          {row.monthlyScore}
        </td>
        <td className="px-4 py-2.5 text-right font-bold tabular-nums whitespace-nowrap text-blue-600">
          {row.rankingScore}
        </td>
        {DIM_COLS.map(d => {
          const note = row.dimensionNotes?.[d.key];
          return (
            <td key={d.key} className={cn('px-3 py-2.5 text-right tabular-nums whitespace-nowrap', dimScoreColor(row.dimensionAvgs[d.key], d.max, isExempt))}>
              <span className="font-medium">{renderDim(row.dimensionAvgs[d.key], d.max)}</span>
              {note && <div className="text-[9px] text-slate-400 font-normal leading-tight">{note}</div>}
            </td>
          );
        })}
        <td className="px-4 py-2.5 text-right tabular-nums whitespace-nowrap text-slate-500">
          {row.dataDays}天
        </td>
      </tr>

      {/* 展开的每日明细 */}
      {isOpen && row.dailyDetails.map(dd => (
        <tr key={dd.date} className="bg-slate-50/70 border-b border-slate-100">
          <td></td>
          <td className="px-4 py-1.5 text-[10px] text-slate-400 whitespace-nowrap pl-8">
            {dd.date.slice(5)} {/* MM-DD */}
          </td>
          <td className={cn('px-4 py-1.5 text-right text-[10px] font-bold tabular-nums whitespace-nowrap', scoreColor(dd.scores.total, isExempt))}>
            {dd.scores.total}
          </td>
          <td className="px-4 py-1.5 text-right text-[10px] text-slate-300 whitespace-nowrap">--</td>
          {DIM_COLS.map(d => (
            <td key={d.key} className={cn('px-3 py-1.5 text-right text-[10px] tabular-nums whitespace-nowrap', dimScoreColor(dd.scores[d.key], d.max, isExempt))}>
              {renderDim(dd.scores[d.key], d.max)}
            </td>
          ))}
          <td className="px-4 py-1.5 text-right text-[10px] text-slate-300 whitespace-nowrap">
            --
          </td>
        </tr>
      ))}
    </>
  );
}
