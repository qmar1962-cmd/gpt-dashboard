import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Clock, ChevronDown } from 'lucide-react';
import { WorkHoursHighWeeklyDetail } from '../lib/dataProcessor';
import { cn } from '../lib/utils';

interface WorkHoursHighDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerName: string;
  provinceName: string;
  weeklyData: WorkHoursHighWeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

export default function WorkHoursHighDetailModal({
  isOpen,
  onClose,
  centerName,
  provinceName,
  weeklyData,
  currentCount,
  prevCount,
}: WorkHoursHighDetailModalProps) {
  const [showAllDays, setShowAllDays] = useState(false);
  const displayDays = showAllDays ? weeklyData : [weeklyData[weeklyData.length - 1]];
  const maxAbnormal = Math.max(...weeklyData.map(d => d.abnormalCount), 1);

  // 关闭弹窗
  const handleClose = () => {
    onClose();
  };

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
            onClick={handleClose}
          />

          {/* 弹窗主体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[6%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[720px] max-h-[88vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black tracking-tight">
                  {provinceName} · {centerName}中心
                </h3>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                  <TrendingUp size={11} />
                  近7天日工时高趋势（T-2 = 今天 - 2天）
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="text-red-600">T-2: {currentCount} 人</span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-500">T-3: {prevCount} 人</span>
                  </span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 flex-shrink-0 ml-2"
              >
                <X size={16} />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* 柱状图趋势 */}
              <div className="bg-slate-50 rounded-xl p-4">
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
                          day.abnormalCount > 0 ? "text-red-500" : "text-slate-300"
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
                                : "bg-slate-200",
                              isLatest && day.abnormalCount > 0 && "ring-2 ring-red-300 ring-offset-1"
                            )}
                            style={{ alignSelf: 'flex-end' }}
                          />
                        </div>
                        {/* 日期标签 */}
                        <span className={cn(
                          "text-[9px] font-bold",
                          isLatest ? "text-red-500 font-black" : "text-slate-400"
                        )}>
                          {day.dateLabel}
                          {isLatest && <span className="ml-0.5 text-slate-300">T-2</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 每日明细 */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  每日日工时高明细（出勤工时 &gt; 12.5h）
                </h4>
                <button onClick={() => setShowAllDays(!showAllDays)} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 mb-1">
                  <ChevronDown size={12} className={showAllDays ? 'rotate-180' : ''} />{showAllDays ? '收起' : '展开近 7 天'}
                </button>
                {displayDays.map(day => (
                  <div
                    key={day.date}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      day.abnormalCount > 0
                        ? "border-red-100 bg-red-50/30"
                        : "border-slate-100 bg-slate-50/30"
                    )}
                  >
                    {/* 日期行 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-slate-700">{day.dateLabel}</span>
                        {day.abnormalCount > 0 ? (
                          <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded">
                            {day.abnormalCount} 人
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            正常
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold">{day.date}</span>
                    </div>

                    {day.abnormalCount > 0 ? (
                      <div className="space-y-1">
                        {/* 表头 */}
                        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 px-3 pb-1 border-b border-red-50">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">姓名</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">岗位</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide text-right w-20">出勤工时</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide text-right w-20">超过12.5h天数</span>
                        </div>
                        {/* 数据行（最多20人） */}
                        {day.details.slice(0, 20).map((detail, idx) => (
                          <div
                            key={idx}
                            className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 items-center bg-white rounded-md px-3 py-2 border border-red-50"
                          >
                            {/* 姓名 */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Clock size={10} className="text-red-400 flex-shrink-0" />
                              <span className="text-[11px] font-bold text-slate-700 truncate">{detail.name}</span>
                            </div>
                            {/* 岗位 */}
                            <span className="text-[11px] font-medium text-slate-500 truncate">{detail.jobName}</span>
                            {/* 出勤工时 */}
                            <span className="text-[11px] font-black font-mono text-right w-20 px-1.5 py-0.5 rounded bg-red-100 text-red-600">
                              {detail.workHours}h
                            </span>
                            {/* 超过12.5h天数 */}
                            <span className="text-[11px] font-bold font-mono text-right w-20 px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">
                              {detail.overHoursDays}天
                            </span>
                          </div>
                        ))}
                        {day.details.length > 20 && (
                          <p className="text-[10px] text-slate-400 font-bold text-center py-1">
                            仅显示前 20 人，共 {day.details.length} 人
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-300 font-bold pl-1">无日工时高人员</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
              <p className="text-[9px] text-slate-400 font-bold text-center">
                仅展示出勤工时 &gt; 12.5h 的人员明细
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
