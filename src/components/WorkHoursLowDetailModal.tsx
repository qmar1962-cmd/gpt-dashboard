import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Clock, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { WorkHoursLowWeeklyDetail } from '../lib/dataProcessor';
import { cn } from '../lib/utils';
import { loadCollaborationData, saveCollaborationData } from '../lib/collaborationApi';
import ConfirmModal from './ConfirmModal';

// ── 日工时低原因选项 ──
const REASON_OPTIONS = [
  '倒班', '临时事假', '脱岗', '其他',
];

// ── 原因记录结构 ──
interface ReasonRecord {
  reason: string;
  employeeId: string;
  name: string;
  date: string;
  savedAt: string;     // 真实保存日期（YYYY-MM-DD），用于继承判断
}

interface WorkHoursLowDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerName: string;
  provinceName: string;
  weeklyData: WorkHoursLowWeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

export default function WorkHoursLowDetailModal({
  isOpen,
  onClose,
  centerName,
  provinceName,
  weeklyData,
  currentCount,
  prevCount,
}: WorkHoursLowDetailModalProps) {
  const [showAllDays, setShowAllDays] = useState(false);
  const displayDays = showAllDays ? weeklyData : [weeklyData[weeklyData.length - 1]];
  const maxAbnormal = Math.max(...weeklyData.map(d => d.abnormalCount), 1);

  // 原因状态：按「date_name」key → 原因字符串
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  // 远端协作数据（按中心-日期-姓名组织）
  const [collaborationData, setCollaborationData] = useState<Record<string, Record<string, Record<string, ReasonRecord>>>>({});
  // 当前展开的下拉框位置
  const [openDropdownFor, setOpenDropdownFor] = useState<{ date: string; name: string; employeeId: string } | null>(null);
  // 未保存修改标记
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // 保存中状态
  const [isSaving, setIsSaving] = useState(false);

  // 加载远端协作数据
  useEffect(() => {
    if (!isOpen || !weeklyData.length) return;

    const loadData = async () => {
      console.log('[工时低原因] 开始加载协作数据, centerName:', centerName);
      // 1. 加载日工时低原因
      const reasons = await loadCollaborationData('work_hours_low_reasons.json');
      console.log('[工时低原因] work_hours_low_reasons.json 加载结果:', reasons);
      setCollaborationData(reasons);

      // 2. 按中心名和日期匹配到当前列表
      const centerReasons = reasons[centerName] || {};
      const matched: Record<string, string> = {};
      for (const day of weeklyData) {
        const dayReasons = centerReasons[day.date] || {};
        for (const person of day.details) {
          const rec = dayReasons[person.name];
          if (rec) {
            matched[`${day.date}_${person.name}`] = rec.reason;
          }
        }
      }

      // 3. 自动继承：用最近一次保存的真实日期（savedAt）跟今天比，≤ 1 天才继承
      const allPeopleInWindow = new Set(weeklyData.flatMap(d => d.details.map(p => p.name)));
      const today = new Date().toISOString().slice(0, 10);
      for (const personName of allPeopleInWindow) {
        let mostRecentSavedAt = '';
        let mostRecentReason = '';
        for (const [histDate, histPeople] of Object.entries(centerReasons)) {
          const rec = histPeople[personName];
          const saveDate = rec?.savedAt || rec?.date; // 兼容旧数据（无 savedAt 字段）
          if (rec && saveDate > mostRecentSavedAt) {
            mostRecentSavedAt = saveDate;
            mostRecentReason = rec.reason;
          }
        }
        if (mostRecentReason && mostRecentSavedAt) {
          const gapDays = Math.abs(
            (new Date(today).getTime() - new Date(mostRecentSavedAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (gapDays <= 1) {
            for (const d of weeklyData) {
              if (d.details.some(p => p.name === personName) && matched[`${d.date}_${personName}`] === undefined) {
                matched[`${d.date}_${personName}`] = mostRecentReason;
              }
            }
          }
        }
      }

      setReasonMap(matched);
      console.log('[工时低原因] 匹配到的原因:', matched);

      // 加载完成后才重置未保存标记
      setHasUnsavedChanges(false);
    };

    loadData();
  }, [isOpen, weeklyData, centerName]);

  // 选择原因
  const handleSelectReason = useCallback((date: string, name: string, employeeId: string, reason: string) => {
    const savedAt = new Date().toISOString().slice(0, 10);
    const newRecord: ReasonRecord = { employeeId: employeeId || '', name, reason, date, savedAt };

    // 更新远端协作数据结构（只更新当前日期，保存时统一清理）
    setCollaborationData(prev => {
      const updated = { ...prev };
      if (!updated[centerName]) updated[centerName] = {};
      if (!updated[centerName][date]) updated[centerName][date] = {};
      updated[centerName][date][name] = newRecord;
      return updated;
    });

    // 更新显示状态：同一个人所有日期都填上这个原因（覆盖）
    setReasonMap(prev => {
      const updated = { ...prev };
      for (const day of weeklyData) {
        if (day.details.some(p => p.name === name)) {
          updated[`${day.date}_${name}`] = reason;
        }
      }
      return updated;
    });

    setHasUnsavedChanges(true);
    setOpenDropdownFor(null);
  }, [centerName, weeklyData]);

  // 删除原因（选错了可以清除）
  const handleClearReason = useCallback((date: string, name: string, employeeId: string) => {
    // 从远端协作数据结构删除（只删当前日期）
    setCollaborationData(prev => {
      const updated = { ...prev };
      if (updated[centerName]?.[date]?.[name]) {
        delete updated[centerName][date][name];
      }
      return updated;
    });

    // 更新显示状态：同一个人所有日期都清除
    setReasonMap(prev => {
      const updated = { ...prev };
      for (const day of weeklyData) {
        if (day.details.some(p => p.name === name)) {
          delete updated[`${day.date}_${name}`];
        }
      }
      return updated;
    });

    setHasUnsavedChanges(true);
    setOpenDropdownFor(null);
  }, [centerName, weeklyData]);

  // 保存原因到远端
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // 第一步：根据 reasonMap 重建 collaborationData[centerName]
      const rebuiltData = JSON.parse(JSON.stringify(collaborationData));
      if (!rebuiltData[centerName]) rebuiltData[centerName] = {};
      for (const [key, reason] of Object.entries(reasonMap)) {
        const underscoreIdx = key.indexOf('_');
        const date = key.substring(0, underscoreIdx);
        const name = key.substring(underscoreIdx + 1);
        if (!rebuiltData[centerName][date]) rebuiltData[centerName][date] = {};
        let employeeId = '';
        for (const day of weeklyData) {
          const person = day.details.find(p => p.name === name);
          if (person) { employeeId = person.employeeId || ''; break; }
        }
        const savedAt = new Date().toISOString().slice(0, 10);
        rebuiltData[centerName][date][name] = { employeeId, name, reason, date, savedAt };
      }

      // 第二步：清理当前7天窗口内不在异常列表里的人（不碰历史数据）
      const validNames = new Set(weeklyData.flatMap(d => d.details.map(p => p.name)));
      const currentDates = new Set(weeklyData.map(d => d.date));
      if (rebuiltData[centerName]) {
        const centerReasons = rebuiltData[centerName];
        for (const date of Object.keys(centerReasons)) {
          if (!currentDates.has(date)) continue;
          for (const personName of Object.keys(centerReasons[date])) {
            if (!validNames.has(personName)) {
              delete centerReasons[date][personName];
            }
          }
          if (Object.keys(centerReasons[date]).length === 0) {
            delete centerReasons[date];
          }
        }
      }

      console.log('[工时低原因] 开始保存 work_hours_low_reasons.json, rebuiltData:', rebuiltData);
      const result = await saveCollaborationData(
        'work_hours_low_reasons.json',
        rebuiltData,
        `Update work hours low reasons for ${centerName}`
      );
      console.log('[工时低原因] work_hours_low_reasons.json 保存结果:', result);
      if (result.success) {
        setCollaborationData(rebuiltData);
        setHasUnsavedChanges(false);
        return true;
      } else {
        alert(`保存失败: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('[工时低原因] 保存失败:', error);
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [collaborationData, centerName, weeklyData, reasonMap]);

  // 处理关闭弹窗（检查未保存修改）
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowSaveConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, onClose]);

  const handleConfirmSave = () => {
    setShowSaveConfirm(false);
    handleSave().then(saved => { if (saved) onClose(); });
  };

  // 获取每个原因对应的颜色标签样式
  const getReasonStyle = (reason: string | undefined) => {
    if (!reason) return '';
    const colorMap: Record<string, string> = {
      '倒班': 'bg-blue-100 text-blue-700 border-blue-200',
      '临时事假': 'bg-amber-100 text-amber-700 border-amber-200',
      '脱岗': 'bg-red-100 text-red-700 border-red-200',
      '其他': 'bg-zinc-100 text-zinc-700 border-zinc-300',
    };
    return colorMap[reason] || 'bg-zinc-50 text-zinc-600 border-zinc-200';
  };

  return (
    <>
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black tracking-tight">
                  {provinceName} · {centerName}中心
                </h3>
                <p className="text-[11px] font-bold text-zinc-400 mt-0.5 flex items-center gap-2">
                  <TrendingUp size={11} />
                  近7天日工时低趋势（T-2 = 今天 - 2天）
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="text-blue-600">T-2: {currentCount} 人</span>
                    <span className="text-zinc-300">/</span>
                    <span className="text-zinc-500">T-3: {prevCount} 人</span>
                  </span>
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-400 hover:text-zinc-600 flex-shrink-0 ml-2"
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
                          day.abnormalCount > 0 ? "text-blue-500" : "text-zinc-300"
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
                                ? "bg-gradient-to-t from-blue-500 to-blue-400"
                                : "bg-zinc-200",
                              isLatest && day.abnormalCount > 0 && "ring-2 ring-blue-300 ring-offset-1"
                            )}
                            style={{ alignSelf: 'flex-end' }}
                          />
                        </div>
                        <span className={cn(
                          "text-[9px] font-bold",
                          isLatest ? "text-blue-500 font-black" : "text-zinc-400"
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
                  每日日工时低明细（出勤工时 ≤ 8h）
                </h4>
                <button onClick={() => setShowAllDays(!showAllDays)} className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-600 mb-1">
                  <ChevronDown size={12} className={showAllDays ? 'rotate-180' : ''} />{showAllDays ? '收起' : '展开近 7 天'}
                </button>
                {displayDays.map(day => (
                  <div
                    key={day.date}
                    className={cn(
                      "rounded-lg border p-3 transition-all",
                      day.abnormalCount > 0
                        ? "border-blue-100 bg-blue-50/30"
                        : "border-zinc-100 bg-zinc-50/30"
                    )}
                  >
                    {/* 日期行 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-zinc-700">{day.dateLabel}</span>
                        {day.abnormalCount > 0 ? (
                          <span className="text-[9px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded">
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
                        <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-x-3 px-3 pb-1 border-b border-blue-50">
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">姓名</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">岗位</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-20">出勤工时</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-20">低于8h天数</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-center w-28">原因</span>
                        </div>
                        {/* 数据行 */}
                        {day.details.slice(0, 20).map((detail, idx) => {
                          const reason = reasonMap[`${day.date}_${detail.name}`];
                          const isOpen = openDropdownFor?.date === day.date && openDropdownFor?.name === detail.name;
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-x-3 items-center bg-white rounded-md px-3 py-2 border border-blue-50 relative"
                            >
                              {/* 姓名 */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Clock size={10} className="text-blue-400 flex-shrink-0" />
                                <span className="text-[11px] font-bold text-zinc-700 truncate">{detail.name}</span>
                              </div>
                              {/* 岗位 */}
                              <span className="text-[11px] font-medium text-zinc-500 truncate">{detail.jobName}</span>
                              {/* 出勤工时 */}
                              <span className={cn(
                                "text-[11px] font-black font-mono text-right w-20 px-1.5 py-0.5 rounded",
                                detail.workHours < 8 ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                              )}>
                                {detail.workHours}h
                              </span>
                              {/* 低于8h天数 */}
                              <span className="text-[11px] font-bold font-mono text-right w-20 px-1.5 py-0.5 rounded bg-orange-100 text-orange-600">
                                {detail.underHoursDays}天
                              </span>

                              {/* 原因（下拉选择） */}
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
                        {day.details.length > 20 && (
                          <p className="text-[10px] text-zinc-400 font-bold text-center py-1">
                            仅显示前 20 人，共 {day.details.length} 人
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-300 font-bold pl-1">无日工时低人员</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 flex-shrink-0">
              <p className="text-[9px] text-zinc-400 font-bold text-center">
                仅展示出勤工时 ≤ 8h 的人员明细
              </p>
              {hasUnsavedChanges ? (
                <p className="text-[9px] text-amber-600 font-bold text-center mt-1 flex items-center justify-center gap-1">
                  <span>⚠️ 有未保存的更改，关闭弹窗时会提示保存</span>
                </p>
              ) : (
                <p className="text-[9px] text-emerald-600 font-bold text-center mt-1">
                  ✓ 已同步到远端，其他用户刷新即可看到
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    <ConfirmModal
      isOpen={showSaveConfirm}
      title="保存日工时低原因"
      message="日工时低原因已修改，是否保存到远端？保存后其他用户刷新页面即可看到最新数据。"
      confirmText="保存并关闭"
      cancelText="不保存，直接关闭"
      destructive
      onConfirm={handleConfirmSave}
      onCancel={() => { setShowSaveConfirm(false); onClose(); }}
    />
    </>
  );
}
