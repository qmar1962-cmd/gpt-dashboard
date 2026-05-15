import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, User } from 'lucide-react';
import { SalaryWeeklyDetail } from '../lib/dataProcessor';
import { cn } from '../lib/utils';

interface SalaryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerName: string;
  provinceName: string;
  weeklyData: SalaryWeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

export default function SalaryDetailModal({
  isOpen,
  onClose,
  centerName,
  provinceName,
  weeklyData,
  currentCount,
  prevCount,
}: SalaryDetailModalProps) {
  const maxAbnormal = Math.max(...weeklyData.map(d => d.abnormalCount), 1);

  // T-2 当天的覆盖率信息
  const latestDay = weeklyData[weeklyData.length - 1];

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
            className="fixed inset-x-4 top-[6%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[740px] max-h-[88vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-black tracking-tight">
                  {provinceName} · {centerName}中心
                </h3>
                <p className="text-[11px] font-bold text-zinc-400 mt-0.5 flex items-center gap-2">
                  <TrendingUp size={11} />
                  近7天绩效异常趋势（T-2 = 今天 - 2天）
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="text-emerald-600">T-2: {currentCount} 人</span>
                    <span className="text-zinc-300">/</span>
                    <span className="text-zinc-500">T-3: {prevCount} 人</span>
                    {latestDay?.salaryCount && (
                      <>
                        <span className="text-zinc-300">/</span>
                        <span className="text-blue-600">算薪: {latestDay.salaryCount}</span>
                        {latestDay.coverageRate !== undefined && (
                          <span className={cn(
                            "text-[10px] font-black px-1.5 py-0.5 rounded",
                            latestDay.coverageRate >= 5
                              ? "bg-red-100 text-red-600"
                              : latestDay.coverageRate >= 3
                                ? "bg-orange-100 text-orange-600"
                                : "bg-green-50 text-green-600"
                          )}>
                            {latestDay.coverageRate}%
                          </span>
                        )}
                      </>
                    )}
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
                      <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                        {/* 覆盖率百分比 */}
                        {day.coverageRate !== undefined && (
                          <span className={cn(
                            "text-[9px] font-black leading-tight",
                            day.coverageRate >= 5
                              ? "text-red-500"
                              : day.coverageRate >= 3
                                ? "text-orange-500"
                                : "text-emerald-500"
                          )}>
                            {day.coverageRate}%
                          </span>
                        )}
                        <span className={cn(
                          "text-[10px] font-black",
                          day.abnormalCount > 0 ? "text-orange-500" : "text-zinc-300"
                        )}>
                          {day.abnormalCount > 0 ? day.abnormalCount : '—'}
                        </span>
                        <div className="w-full flex justify-center" style={{ height: '80px' }}>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${barHeight}%` }}
                            transition={{ delay: idx * 0.05, duration: 0.3 }}
                            className={cn(
                              "w-6 rounded-t-md transition-all",
                              day.abnormalCount > 0
                                ? "bg-gradient-to-t from-orange-500 to-amber-400"
                                : "bg-zinc-200",
                              isLatest && day.abnormalCount > 0 && "ring-2 ring-orange-300 ring-offset-1"
                            )}
                            style={{ alignSelf: 'flex-end' }}
                          />
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold",
                          isLatest ? "text-orange-500 font-black" : "text-zinc-400"
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
                  每日绩效异常人员明细
                </h4>
                {weeklyData.map(day => (
                  <div
                    key={day.date}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      day.abnormalCount > 0
                        ? "border-orange-100 bg-orange-50/30"
                        : "border-zinc-100 bg-zinc-50/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-zinc-700">{day.dateLabel}</span>
                        {day.abnormalCount > 0 ? (
                          <span className="text-[9px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded">
                            {day.abnormalCount} 人
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            正常
                          </span>
                        )}
                        {day.salaryCount && (
                          <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                            算薪 {day.salaryCount} 人
                          </span>
                        )}
                        {day.coverageRate !== undefined && (
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded",
                            day.coverageRate >= 5
                              ? "bg-red-100 text-red-600"
                              : day.coverageRate >= 3
                                ? "bg-orange-100 text-orange-600"
                                : "bg-green-50 text-green-600"
                          )}>
                            覆盖率 {day.coverageRate}%
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-zinc-400 font-bold">{day.date}</span>
                    </div>

                    {day.abnormalCount > 0 ? (
                      <div className="space-y-1">
                        {/* 表头 */}
                        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-3 px-3 pb-1 border-b border-orange-50">
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">姓名</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-14">岗位</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-12">出勤系数</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-16">个人日薪</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-16">岗位均值</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-16">均值偏离</span>
                        </div>
                        {/* 数据行（每天最多显示20条） */}
                        {day.details.slice(0, 20).map((detail, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-3 items-center bg-white rounded-md px-3 py-2 border border-orange-50"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <User size={10} className="text-orange-400 flex-shrink-0" />
                              <span className="text-[11px] font-bold text-zinc-700 truncate">{detail.name}</span>
                            </div>
                            <span className="text-[11px] text-zinc-600 text-right w-14 truncate">{detail.jobName}</span>
                            <span className="text-[11px] font-mono font-bold text-zinc-700 text-right w-12">
                              ×{detail.attendanceCoeff}
                            </span>
                            <span className="text-[11px] font-mono font-black text-zinc-800 text-right w-16">
                              {detail.dailySalary.toFixed(1)}
                            </span>
                            <span className="text-[11px] font-mono text-zinc-500 text-right w-16">
                              {detail.jobAvgSalary.toFixed(1)}
                            </span>
                            <span className={cn(
                              "text-[11px] font-black font-mono text-right w-16 px-1.5 py-0.5 rounded",
                              detail.avgDeviation >= 200
                                ? "bg-red-100 text-red-600"
                                : detail.avgDeviation >= 100
                                  ? "bg-orange-100 text-orange-600"
                                  : detail.avgDeviation >= 50
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-yellow-50 text-yellow-700"
                            )}>
                              +{detail.avgDeviation.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                        {day.details.length > 20 && (
                          <p className="text-[9px] text-zinc-400 font-bold text-center py-1">
                            还有 {day.details.length - 20} 人未显示
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-300 font-bold pl-1">无绩效异常人员</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 flex-shrink-0">
              <p className="text-[9px] text-zinc-400 font-bold text-center">
                工资偏高人员明细 · 个人平均日薪 vs 岗位上月均值
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
