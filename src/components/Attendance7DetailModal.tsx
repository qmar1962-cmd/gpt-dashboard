import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, AlertCircle, ChevronDown } from 'lucide-react';
import { Attendance7WeeklyDetail } from '../lib/dataProcessor';
import { cn } from '../lib/utils';
import { saveSharedData, readSharedData, isFirebaseReady } from '../lib/firebase';

// ── 未出勤原因选项 ──
const REASON_OPTIONS = [
  '工伤', '事假', '病假', '纠纷',
  '挂编', '出差', '离职未清', '已返岗',
];

// ── 未出勤原因持久化（按工号全局记忆，断天即失效 + Firestore 跨设备同步） ──

const ABSENCE_REASON_KEY = 'absence_reasons_global';
const FIRESTORE_DOC_ID = 'shared_absence_reasons';

interface AbsenceReasonRecord {
  reason: string;      // 选中的原因
  employeeId: string;  // 工号（主键）
  name: string;        // 姓名（显示用）
}

/** 加载全局原因数据（仅 localStorage） */
function loadAbsenceReasonsFromLocal(): Record<string, AbsenceReasonRecord> {
  try {
    const raw = localStorage.getItem(ABSENCE_REASON_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** 加载全局原因数据：本地优先 + 异步合并 Firestore 云端数据 */
async function loadAbsenceReasons(activeIds?: Set<string>): Promise<Record<string, AbsenceReasonRecord>> {
  const local = loadAbsenceReasonsFromLocal();
  if (!isFirebaseReady()) return local;

  try {
    const cloud = await readSharedData(FIRESTORE_DOC_ID) as Record<string, AbsenceReasonRecord> | null;
    if (cloud && typeof cloud === 'object') {
      // 合并：本地覆盖优先，云端补充本地没有的
      const merged: Record<string, AbsenceReasonRecord> = { ...cloud, ...local };

      // 如果提供了 activeIds，只保留当前视图中的工号（断天清理）
      if (activeIds) {
        const cleaned: Record<string, AbsenceReasonRecord> = {};
        for (const [id, rec] of Object.entries(merged)) {
          if (activeIds.has(id)) cleaned[id] = rec;
        }
        localStorage.setItem(ABSENCE_REASON_KEY, JSON.stringify(cleaned));
        // 同步清理云端
        saveSharedData(FIRESTORE_DOC_ID, cleaned).catch(() => {});
        return cleaned;
      }

      localStorage.setItem(ABSENCE_REASON_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch { /* 降级到纯本地 */ }
  return local;
}

/** 保存并清理：只保留当前视图内出现的工号记录，其余删除（断天失效） */
function saveAndCleanAbsenceReasons(
  all: Record<string, AbsenceReasonRecord>,
  activeEmployeeIds: Set<string>
): void {
  const cleaned: Record<string, AbsenceReasonRecord> = {};
  for (const [id, rec] of Object.entries(all)) {
    if (activeEmployeeIds.has(id)) {
      cleaned[id] = rec;
    }
    // 不在 activeSet 中的 → 断天了，不保留
  }
  localStorage.setItem(ABSENCE_REASON_KEY, JSON.stringify(cleaned));
  // 异步同步到 Firestore
  saveSharedData(FIRESTORE_DOC_ID, cleaned).catch(() => {});
}

interface Attendance7DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerName: string;
  provinceName: string;
  weeklyData: Attendance7WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

export default function Attendance7DetailModal({
  isOpen,
  onClose,
  centerName,
  provinceName,
  weeklyData,
  currentCount,
  prevCount,
}: Attendance7DetailModalProps) {
  const maxAbnormal = Math.max(...weeklyData.map(d => d.abnormalCount), 1);

  // 未出勤原因状态：按「date_name」key → 原因字符串
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  // 当前展开的下拉框位置
  const [openDropdownFor, setOpenDropdownFor] = useState<{ date: string; name: string; employeeId: string } | null>(null);

  // 加载未出勤原因：按工号自动匹配 + 断天清理 + Firestore 合并
  useEffect(() => {
    if (!isOpen || !weeklyData.length) return;

    // 收集当前视图中所有出现的工号（用于断天清理）
    const activeIds = new Set<string>();

    const matchAndSet = (allStored: Record<string, AbsenceReasonRecord>) => {
      const matched: Record<string, string> = {};
      for (const day of weeklyData) {
        for (const person of day.details) {
          if (person.employeeId) {
            activeIds.add(person.employeeId);
            const rec = allStored[person.employeeId];
            if (rec) {
              matched[`${day.date}_${person.name}`] = rec.reason;
            }
          }
        }
      }
      return matched;
    };

    // 先用本地数据立即渲染
    const localAll = loadAbsenceReasonsFromLocal();
    setReasonMap(matchAndSet(localAll));
    saveAndCleanAbsenceReasons(localAll, activeIds);

    // 异步合并 Firestore 云端数据
    loadAbsenceReasons(activeIds).then(merged => {
      setReasonMap(matchAndSet(merged));
    });
  }, [isOpen, weeklyData]);

  // 选择原因
  const handleSelectReason = useCallback((date: string, name: string, employeeId: string, reason: string) => {
    setReasonMap(prev => ({
      ...prev,
      [`${date}_${name}`]: reason,
    }));

    // 写入全局存储
    if (employeeId) {
      const all = loadAbsenceReasonsFromLocal();
      all[employeeId] = { employeeId, name, reason };
      localStorage.setItem(ABSENCE_REASON_KEY, JSON.stringify(all));
      // 异步同步到 Firestore
      saveSharedData(FIRESTORE_DOC_ID, all).catch(() => {});
    }

    setOpenDropdownFor(null);
  }, []);

  // 删除原因（选错了可以清除）
  const handleClearReason = useCallback((date: string, name: string, employeeId: string) => {
    setReasonMap(prev => {
      const updated = { ...prev };
      delete updated[`${date}_${name}`];
      return updated;
    });

    if (employeeId) {
      const all = loadAbsenceReasonsFromLocal();
      delete all[employeeId];
      localStorage.setItem(ABSENCE_REASON_KEY, JSON.stringify(all));
      // 异步同步到 Firestore
      saveSharedData(FIRESTORE_DOC_ID, all).catch(() => {});
    }

    setOpenDropdownFor(null);
  }, []);

  // 获取每个原因对应的颜色标签样式
  const getReasonStyle = (reason: string | undefined) => {
    if (!reason) return '';
    const colorMap: Record<string, string> = {
      '工伤': 'bg-red-100 text-red-700 border-red-200',
      '事假': 'bg-amber-100 text-amber-700 border-amber-200',
      '病假': 'bg-purple-100 text-purple-700 border-purple-200',
      '纠纷': 'bg-orange-100 text-orange-700 border-orange-200',
      '挂编': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      '出差': 'bg-blue-100 text-blue-700 border-blue-200',
      '离职未清': 'bg-zinc-100 text-zinc-700 border-zinc-300',
      '已返岗': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
    return colorMap[reason] || 'bg-zinc-50 text-zinc-600 border-zinc-200';
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
            onClick={onClose}
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-black tracking-tight">
                  {provinceName} · {centerName}中心
                </h3>
                <p className="text-[11px] font-bold text-zinc-400 mt-0.5 flex items-center gap-2">
                  <TrendingUp size={11} />
                  近7天连续未出勤趋势（T-2 = 今天 - 2天）
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="text-red-600">T-2: {currentCount} 人</span>
                    <span className="text-zinc-300">/</span>
                    <span className="text-zinc-500">T-3: {prevCount} 人</span>
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
                        <span className={cn(
                          "text-[10px] font-black",
                          day.abnormalCount > 0 ? "text-red-500" : "text-zinc-300"
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
                                ? "bg-gradient-to-t from-red-500 to-red-400"
                                : "bg-zinc-200",
                              isLatest && day.abnormalCount > 0 && "ring-2 ring-red-300 ring-offset-1"
                            )}
                            style={{ alignSelf: 'flex-end' }}
                          />
                        </div>
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
                  每日连续未出勤明细（≥ 7 天）
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
                            {day.abnormalCount} 人
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
                        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 px-3 pb-1 border-b border-red-50">
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">姓名</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">岗位</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-20">未出勤天数</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-center w-28">未出勤原因</span>
                        </div>
                        {/* 数据行 */}
                        {day.details.map((detail, idx) => {
                          const reason = reasonMap[`${day.date}_${detail.name}`];
                          const isOpen = openDropdownFor?.date === day.date && openDropdownFor?.name === detail.name;
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 items-center bg-white rounded-md px-3 py-2 border border-red-50 relative"
                            >
                              {/* 姓名 */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <AlertCircle size={10} className="text-red-400 flex-shrink-0" />
                                <span className="text-[11px] font-bold text-zinc-700 truncate">{detail.name}</span>
                              </div>
                              {/* 岗位 */}
                              <span className="text-[11px] font-medium text-zinc-500 truncate">{detail.jobName}</span>
                              {/* 未出勤天数 */}
                              <span className={cn(
                                "text-[11px] font-black font-mono text-right w-20 px-1.5 py-0.5 rounded",
                                detail.continuousDays >= 30
                                  ? "bg-red-100 text-red-600"
                                  : detail.continuousDays >= 14
                                    ? "bg-orange-100 text-orange-600"
                                    : "bg-red-50 text-red-500"
                              )}>
                                {detail.continuousDays} 天
                              </span>

                              {/* 未出勤原因（下拉选择） */}
                              <div
                                className="relative w-28 flex items-center justify-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => setOpenDropdownFor(isOpen ? null : { date: day.date, name: detail.name, employeeId: detail.employeeId || '' })}
                                  className={cn(
                                    "text-[10px] font-bold px-2 py-1 rounded-md cursor-pointer border transition-all text-center flex items-center justify-center gap-1",
                                    reason
                                      ? `${getReasonStyle(reason)} pr-0`
                                      : "bg-zinc-50 text-zinc-400 border-dashed border-zinc-300 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 min-w-[80px]"
                                  )}
                                >
                                  {reason || (
                                    <>
                                      <ChevronDown size={10} /> 原因
                                    </>
                                  )}
                                  {reason && (
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleClearReason(day.date, detail.name, detail.employeeId || '');
                                      }}
                                      className="ml-0.5 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-black/10 text-[9px] font-bold leading-none"
                                      title="删除此原因"
                                    >×</span>
                                  )}
                                </button>

                                {/* 下拉选项 */}
                                <AnimatePresence>
                                  {isOpen && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -4, scale: 0.95 }}
                                      transition={{ duration: 0.12 }}
                                      className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-zinc-200 z-50 w-28 overflow-hidden"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {REASON_OPTIONS.map(opt => (
                                        <button
                                          key={opt}
                                          onClick={() => handleSelectReason(day.date, detail.name, detail.employeeId || '', opt)}
                                          className={cn(
                                            "w-full text-left px-3 py-1.5 text-[11px] font-medium transition-colors",
                                            opt === reason
                                              ? "bg-blue-50 text-blue-700 font-bold"
                                              : "hover:bg-zinc-50 text-zinc-600"
                                          )}
                                        >
                                          {opt}
                                        </button>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-300 font-bold pl-1">无连续未出勤 ≥ 7 天人员</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 flex-shrink-0">
              <p className="text-[9px] text-zinc-400 font-bold text-center">
                仅展示连续未出勤 ≥ 7 天的人员明细 · 原因按工号记忆，断天后自动清除
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
