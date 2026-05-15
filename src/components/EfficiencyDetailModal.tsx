import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, AlertTriangle } from 'lucide-react';
import { WeeklyDetail } from '../lib/dataProcessor';
import { cn } from '../lib/utils';

interface EfficiencyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerName: string;
  provinceName: string;
  weeklyData: WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

export default function EfficiencyDetailModal({
  isOpen,
  onClose,
  centerName,
  provinceName,
  weeklyData,
  currentCount,
  prevCount,
}: EfficiencyDetailModalProps) {
  const maxAbnormal = Math.max(...weeklyData.map(d => d.abnormalCount), 1);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* 弹窗主体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[6%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[700px] max-h-[88vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-black tracking-tight">
                  {provinceName} · {centerName}中心
                </h3>
                <p className="text-[11px] font-bold text-zinc-400 mt-0.5 flex items-center gap-2">
                  <TrendingUp size={11} />
                  近7天效能异常趋势（T-2 = 今天 - 2天）
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="text-emerald-600">T-2: {currentCount} 个</span>
                    <span className="text-zinc-300">/</span>
                    <span className="text-zinc-500">T-3: {prevCount} 个</span>
                  </span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600"
              >
                <X size={16} />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* 柱状图趋势 */}
              <div className="bg-zinc-50 rounded-xl p-4">
                <div className="flex items-end gap-2 h-28">
                  {weeklyData.map((day, idx) => {
                    const barHeight = day.abnormalCount > 0
                      ? Math.max(8, (day.abnormalCount / maxAbnormal) * 100)
                      : 4;
                    const isLatest = idx === weeklyData.length - 1;
                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                        {/* 数值标签 */}
                        <span className={cn(
                          "text-[10px] font-black",
                          day.abnormalCount > 0 ? "text-red-500" : "text-zinc-300"
                        )}>
                          {day.abnormalCount > 0 ? day.abnormalCount : '—'}
                        </span>
                        {/* 柱子 */}
                        <div className="w-full flex justify-center" style={{ height: '80px' }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${barHeight}%` }}
                            transition={{ delay: idx * 0.05, duration: 0.3 }}
                            className={cn(
                              "w-6 rounded-t-md transition-all",
                              day.abnormalCount > 0
                                ? "bg-gradient-to-t from-red-500 to-red-400"
                                : "bg-zinc-200",
                              isLatest && day.abnormalCount > 0 && "ring-2 ring-red-300 ring-offset-1"
                            )}
                            style={{ alignSelf: 'flex-end' }}
                          />
                        </div>
                        {/* 日期标签 */}
                        <span className={cn(
                          "text-[9px] font-bold",
                          isLatest ? "text-red-500 font-black" : "text-zinc-400"
                        )}>
                          {day.dateLabel}
                          {isLatest && <span className="ml-0.5 text-zinc-300">T-2</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 每日明细 */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                  每日岗位异常明细
                </h4>
                {weeklyData.map(day => (
                  <div
                    key={day.date}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      day.abnormalCount > 0
                        ? "border-red-100 bg-red-50/30"
                        : "border-zinc-100 bg-zinc-50/30"
                    )}
                  >
                    {/* 日期行 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-zinc-700">{day.dateLabel}</span>
                        {day.abnormalCount > 0 ? (
                          <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded">
                            {day.abnormalCount} 个异常
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            正常
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-400 font-bold">{day.date}</span>
                    </div>

                    {day.abnormalCount > 0 ? (
                      <div className="space-y-1">
                        {/* 表头 */}
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-3 pb-1 border-b border-red-50">
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">岗位名称</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-16">实际值</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-16">目标值</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-16">偏离度</span>
                        </div>
                        {/* 数据行 */}
                        {day.details.map((detail, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 items-center bg-white rounded-md px-3 py-2 border border-red-50"
                          >
                            {/* 岗位名称 */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />
                              <span className="text-[11px] font-bold text-zinc-700 truncate">{detail.jobName}</span>
                            </div>
                            {/* 实际值 */}
                            <span className="text-[11px] font-mono font-black text-zinc-800 text-right w-16">
                              {detail.actualValue > 0 ? detail.actualValue.toFixed(1) : '—'}
                            </span>
                            {/* 目标值 */}
                            <span className="text-[11px] font-mono text-zinc-500 text-right w-16">
                              {detail.targetValue > 0 ? detail.targetValue.toFixed(1) : '—'}
                            </span>
                            {/* 偏离度 */}
                            <span className={cn(
                              "text-[11px] font-black font-mono text-right w-16 px-1.5 py-0.5 rounded",
                              detail.deviation >= 30
                                ? "bg-red-100 text-red-600"
                                : detail.deviation >= 20
                                  ? "bg-orange-100 text-orange-600"
                                  : "bg-amber-100 text-amber-600"
                            )}>
                              +{detail.deviation.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-300 font-bold pl-1">无异常岗位</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 flex-shrink-0">
              <p className="text-[9px] text-zinc-400 font-bold text-center">
                仅展示目标偏离 ≥ 10% 的岗位 · 实际值 = 当月人均日绩效 · 目标值 = 设定目标
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
