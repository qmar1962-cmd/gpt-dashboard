import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Clock, CalendarDays, ChevronLeft, ChevronRight, Check, Edit3, User } from 'lucide-react';
import { Attendance15WeeklyDetail } from '../lib/dataProcessor';
import { cn } from '../lib/utils';
import { loadCollaborationData, saveCollaborationData } from '../lib/collaborationApi';

// ── 排休数据结构 ──

interface LeavePlanRecord {
  start: string;      // YYYY-MM-DD 排休开始
  end: string;        // YYYY-MM-DD 排休结束
  setDate: string;    // YYYY-MM-DD 设置日期（用于判断过期）
  name: string;       // 姓名（显示用）
  employeeId: string; // 工号（主键）
}

// ── 日期范围选择器弹窗 ──
interface DatePickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (start: string, end: string) => void;
  onClear: () => void;
  currentPlan?: LeavePlanRecord | null;
}

function DatePickerPopover({ isOpen, onClose, onSelect, onClear, currentPlan }: DatePickerPopoverProps) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [rangeStart, setRangeStart] = useState<string | null>(currentPlan?.start || null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(currentPlan?.end || null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // 当弹窗打开时重置状态
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      setViewDate(today);
      setSelectingStart(true);
      setRangeStart(currentPlan?.start || null);
      setRangeEnd(currentPlan?.end || null);
      setHoverDate(null);
    }
  }, [isOpen, currentPlan]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay(); // 0=周日
  const daysInMonth = new Date(year, month + 1,0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const formatDateShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

  const isInRange = (d: string) => {
    if (!rangeStart) return false;
    if (rangeEnd) return d >= rangeStart && d <= rangeEnd;
    // 只选了开始日期，显示 hover 范围
    if (hoverDate && selectingStart === false) {
      const [s, h] = rangeStart < hoverDate ? [rangeStart, hoverDate] : [hoverDate, rangeStart];
      return d >= s && d <= h;
    }
    return d === rangeStart;
  };

  const isStart = (d: string) => d === rangeStart;
  const isEnd = (d: string) => d === rangeEnd;

  const handleDayClick = (dayStr: string) => {
    if (selectingStart || !rangeStart) {
      // 选择开始日期
      setRangeStart(dayStr);
      setRangeEnd(null);
      setSelectingStart(false);
    } else {
      // 选择结束日期
      const start = rangeStart < dayStr ? rangeStart : dayStr;
      const end = rangeStart < dayStr ? dayStr : rangeStart;
      setRangeStart(start);
      setRangeEnd(end);
    }
  };

  const handleConfirm = () => {
    if (rangeStart && rangeEnd) {
      onSelect(rangeStart, rangeEnd);
    } else if (rangeStart) {
      // 单日选择，起止同一天
      onSelect(rangeStart, rangeStart);
    }
    onClose();
  };

  const handleClear = () => {
    setRangeStart(null);
    setRangeEnd(null);
    setSelectingStart(true);
    onClear(); // 通知外层清除 localStorage 和状态
  };

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-zinc-200 z-50 w-[300px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部：月份导航 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-bold text-zinc-700">{year}年{month + 1}月</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">
            <ChevronRight size={14} />
          </button>
        </div>

        {/* 星期头 */}
        <div className="grid grid-cols-7 px-2 py-1 border-b border-zinc-50">
          {weekDays.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-zinc-400 py-0.5">{d}</div>
          ))}
        </div>

        {/* 日期格子 */}
        <div className="grid grid-cols-7 p-2 gap-0.5">
          {/* 前导空格 */}
          {Array.from({ length: (firstDay + 6) % 7 }, (_, i) => (
            <div key={`empty-${i}`} className="h-7" />
          ))}
          {/* 实际日期 */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const inRange = isInRange(dayStr);
            const isStartDate = isStart(dayStr);
            const isEndDate = isEnd(dayStr);

            return (
              <button
                key={day}
                onClick={() => handleDayClick(dayStr)}
                onMouseEnter={() => setHoverDate(dayStr)}
                className={cn(
                  "h-7 text-[11px] font-medium rounded-md flex items-center justify-center transition-all",
                  inRange ? "bg-blue-50 text-blue-700" : "hover:bg-zinc-100 text-zinc-600",
                  (isStartDate || isEndDate) && "bg-blue-500 text-white font-bold hover:bg-blue-600 ring-2 ring-blue-200"
                )}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* 已选范围提示 + 操作按钮 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-100 bg-zinc-50/50">
          <span className="text-[10px] font-bold text-zinc-500 truncate max-w-[180px]">
            {rangeStart && rangeEnd
              ? `${formatDateShort(new Date(rangeStart))} - ${formatDateShort(new Date(rangeEnd))}`
              : rangeStart
                ? `已选 ${formatDateShort(new Date(rangeStart))}，再点结束日`
                : '点击选择起始日期'}
          </span>
          <div className="flex gap-1.5">
            {(rangeStart || rangeEnd) && (
              <button
                onClick={handleClear}
                className="px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded"
              >
                清除
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={!rangeStart}
              className={cn(
                "px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1",
                rangeStart
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
              )}
            >
              <Check size={10} /> 确定
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface Attendance15DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerName: string;
  provinceName: string;
  weeklyData: Attendance15WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

export default function Attendance15DetailModal({
  isOpen,
  onClose,
  centerName,
  provinceName,
  weeklyData,
  currentCount,
  prevCount,
}: Attendance15DetailModalProps) {
  const maxAbnormal = Math.max(...weeklyData.map(d => d.abnormalCount), 1);

  // 排休计划状态：按「日期_姓名」key → 显示用的排休记录
  const [leavePlans, setLeavePlans] = useState<Record<string, LeavePlanRecord>>({});
  // 远端协作数据（按中心-日期-姓名组织）
  const [collaborationData, setCollaborationData] = useState<Record<string, Record<string, Record<string, LeavePlanRecord>>>>({});
  // 当前打开的日期选择器位置
  const [pickerFor, setPickerFor] = useState<{ date: string; name: string; employeeId: string } | null>(null);
  // 未保存修改标记
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // 保存中状态
  const [isSaving, setIsSaving] = useState(false);
  // 考勤负责人
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [isEditingResponsible, setIsEditingResponsible] = useState(false);
  const [responsibleInput, setResponsibleInput] = useState('');

  // 加载远端协作数据
  useEffect(() => {
    if (!isOpen || !weeklyData.length) return;

    const loadData = async () => {
      console.log('[加载] 开始加载协作数据, centerName:', centerName);
      // 1. 加载排休计划
      const plans = await loadCollaborationData('leave_plans.json');
      console.log('[加载] leave_plans.json 加载结果:', plans);
      setCollaborationData(plans);

      // 2. 按中心名和日期匹配到当前列表
      const centerPlans = plans[centerName] || {};
      const matched: Record<string, LeavePlanRecord> = {};
      for (const day of weeklyData) {
        const dayPlans = centerPlans[day.date] || {};
        for (const person of day.details) {
          const plan = dayPlans[person.name];
          if (plan) {
            matched[`${day.date}_${person.name}`] = plan;
          }
        }
      }

      // 3. 自动继承：对当前7天窗口内每个缺失排休计划的条目，检查历史数据并继承最近一次排休计划
      const allPeopleInWindow = new Set(weeklyData.flatMap(d => d.details.map(p => p.name)));
      for (const personName of allPeopleInWindow) {
        // 先找到此人最近一次历史排休计划（无论当前窗口有没有）
        let mostRecentDate = '';
        let mostRecentPlan: LeavePlanRecord | null = null;
        for (const [histDate, histPeople] of Object.entries(centerPlans)) {
          if (histPeople[personName] && histDate > mostRecentDate) {
            mostRecentDate = histDate;
            mostRecentPlan = histPeople[personName];
          }
        }
        // 如果找到历史排休计划，填充当前窗口内所有缺失的日期
        if (mostRecentPlan) {
          for (const d of weeklyData) {
            if (d.details.some(p => p.name === personName) && matched[`${d.date}_${personName}`] === undefined) {
              matched[`${d.date}_${personName}`] = mostRecentPlan;
            }
          }
        }
      }

      setLeavePlans(matched);
      console.log('[加载] 匹配到的排休计划:', matched);

      // 3. 加载中心元数据（负责人）
      const meta = await loadCollaborationData('center_meta.json');
      console.log('[加载] center_meta.json 加载结果:', meta);
      const centerMeta = meta[centerName] || {};
      if (centerMeta['考勤负责人']) {
        setResponsiblePerson(centerMeta['考勤负责人']);
      }
      // 加载完成后才重置未保存标记
      setHasUnsavedChanges(false);
    };

    loadData();
  }, [isOpen, weeklyData, centerName]);

  // 格式化显示：4/27-4/30
  const formatPlanDisplay = (plan?: LeavePlanRecord | null) => {
    if (!plan || !plan.start) return '';
    const s = new Date(plan.start);
    const e = new Date(plan.end);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    if (plan.start === plan.end) return fmt(s);
    return `${fmt(s)}-${fmt(e)}`;
  };

  const handleSelectDate = useCallback((date: string, name: string, employeeId: string, start: string, end: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const newPlan: LeavePlanRecord = { employeeId, name, start, end, setDate: todayStr };

    // 更新远端协作数据结构（只更新当前日期，保存时统一清理）
    setCollaborationData(prev => {
      const updated = { ...prev };
      if (!updated[centerName]) updated[centerName] = {};
      if (!updated[centerName][date]) updated[centerName][date] = {};
      updated[centerName][date][name] = newPlan;
      return updated;
    });

    // 更新显示状态：同一个人所有日期都填上这个排休计划（覆盖）
    setLeavePlans(prev => {
      const updated = { ...prev };
      for (const day of weeklyData) {
        if (day.details.some(p => p.name === name)) {
          updated[`${day.date}_${name}`] = newPlan;
        }
      }
      return updated;
    });

    setHasUnsavedChanges(true);
    setPickerFor(null);
  }, [centerName, weeklyData]);

  const handleClearPlan = useCallback((date: string, name: string, employeeId: string) => {
    // 从远端协作数据结构删除（只删当前日期）
    setCollaborationData(prev => {
      const updated = { ...prev };
      if (updated[centerName]?.[date]?.[name]) {
        delete updated[centerName][date][name];
      }
      return updated;
    });

    // 更新显示状态：同一个人所有日期都清除
    setLeavePlans(prev => {
      const updated = { ...prev };
      for (const day of weeklyData) {
        if (day.details.some(p => p.name === name)) {
          delete updated[`${day.date}_${name}`];
        }
      }
      return updated;
    });

    setHasUnsavedChanges(true);
  }, [centerName, weeklyData]);

  // 保存排休计划到远端
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // 第一步：根据 leavePlans 重建 collaborationData[centerName]（确保同一个人所有日期都存进去）
      const rebuiltData = JSON.parse(JSON.stringify(collaborationData));
      if (!rebuiltData[centerName]) rebuiltData[centerName] = {};
      // 遍历 leavePlans，重建 centerName 下的数据结构
      for (const [key, plan] of Object.entries(leavePlans)) {
        // key 格式: YYYY-MM-DD_name（名字无下划线，用第一个下划线分割）
        const underscoreIdx = key.indexOf('_');
        const date = key.substring(0, underscoreIdx);
        const name = key.substring(underscoreIdx + 1);
        if (!rebuiltData[centerName][date]) rebuiltData[centerName][date] = {};
        rebuiltData[centerName][date][name] = plan;
      }

      // 第二步：清理当前7天窗口内不在异常列表里的人（不碰历史数据）
      const validNames = new Set(weeklyData.flatMap(d => d.details.map(p => p.name)));
      const currentDates = new Set(weeklyData.map(d => d.date));
      if (rebuiltData[centerName]) {
        const centerPlans = rebuiltData[centerName];
        for (const date of Object.keys(centerPlans)) {
          // 只清理当前窗口的日期，不碰历史数据
          if (!currentDates.has(date)) continue;
          
          for (const personName of Object.keys(centerPlans[date])) {
            if (!validNames.has(personName)) {
              delete centerPlans[date][personName];
            }
          }
          if (Object.keys(centerPlans[date]).length === 0) {
            delete centerPlans[date];
          }
        }
      }

      console.log('[保存] 开始保存 leave_plans.json, rebuiltData:', rebuiltData);
      const result = await saveCollaborationData(
        'leave_plans.json',
        rebuiltData,
        `Update leave plans for ${centerName}`
      );
      console.log('[保存] leave_plans.json 保存结果:', result);
      if (result.success) {
        setCollaborationData(rebuiltData);
        setHasUnsavedChanges(false);
        // 同时保存中心元数据（负责人）
        if (responsiblePerson) {
          console.log('[保存] 开始保存 center_meta.json');
          const meta = await loadCollaborationData('center_meta.json');
          const updatedMeta = { ...meta };
          if (!updatedMeta[centerName]) updatedMeta[centerName] = {};
          updatedMeta[centerName]['考勤负责人'] = responsiblePerson;
          updatedMeta[centerName]['updatedAt'] = new Date().toISOString();
          const metaResult = await saveCollaborationData('center_meta.json', updatedMeta, `Update responsible for ${centerName}`);
          console.log('[保存] center_meta.json 保存结果:', metaResult);
          if (!metaResult.success) {
            alert(`负责人保存失败: ${metaResult.error}`);
          }
        }
        return true;
      } else {
        alert(`保存失败: ${result.error}`);
        return false;
      }
    } catch (error) {
      console.error('[保存] 保存失败:', error);
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [collaborationData, centerName, responsiblePerson, weeklyData, leavePlans]);

  // 处理关闭弹窗（检查未保存修改）
  const handleClose = useCallback(async () => {
    if (hasUnsavedChanges) {
      const confirmed = confirm('排休计划已修改，是否保存到远端？\n保存后其他用户刷新页面即可看到最新数据。');
      if (confirmed) {
        const saved = await handleSave();
        if (saved) onClose();
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasUnsavedChanges, handleSave, onClose]);

  // 保存考勤负责人
  const handleSaveResponsible = useCallback(async () => {
    setResponsiblePerson(responsibleInput);
    setIsEditingResponsible(false);
    setHasUnsavedChanges(true);
  }, [responsibleInput]);

  // 关闭 picker 的点击外部逻辑
  useEffect(() => {
    if (!pickerFor) return;
    const handler = () => setPickerFor(null);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [pickerFor]);

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
            className="fixed inset-x-4 top-[6%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[700px] max-h-[88vh] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black tracking-tight">
                  {provinceName} · {centerName}中心
                </h3>
                {/* 考勤负责人编辑 */}
                <div className="mt-1 flex items-center gap-2">
                  {isEditingResponsible ? (
                    <div className="flex items-center gap-1.5">
                      <User size={11} className="text-zinc-400" />
                      <input
                        type="text"
                        value={responsibleInput}
                        onChange={e => setResponsibleInput(e.target.value)}
                        placeholder="输入负责人姓名"
                        className="text-[11px] px-2 py-0.5 border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 w-32"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveResponsible();
                          if (e.key === 'Escape') setIsEditingResponsible(false);
                        }}
                      />
                      <button
                        onClick={handleSaveResponsible}
                        className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 font-bold"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setIsEditingResponsible(false)}
                        className="text-[10px] px-1.5 py-0.5 text-zinc-400 hover:text-zinc-600"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setResponsibleInput(responsiblePerson);
                        setIsEditingResponsible(true);
                      }}
                      className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-700 transition-colors group"
                    >
                      <User size={11} className="text-zinc-400 group-hover:text-zinc-600" />
                      <span>考勤负责人：{responsiblePerson || '未设置'}</span>
                      <Edit3 size={10} className="text-zinc-300 group-hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                </div>
                <p className="text-[11px] font-bold text-zinc-400 mt-0.5 flex items-center gap-2">
                  <TrendingUp size={11} />
                  近7天连续出勤趋势（T-2 = 今天 - 2天）
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="text-emerald-600">T-2: {currentCount} 人</span>
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
                        {/* 数值标签 */}
                        <span className={cn(
                          "text-[10px] font-black",
                          day.abnormalCount > 0 ? "text-blue-500" : "text-zinc-300"
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
                                ? "bg-gradient-to-t from-blue-500 to-blue-400"
                                : "bg-zinc-200",
                              isLatest && day.abnormalCount > 0 && "ring-2 ring-blue-300 ring-offset-1"
                            )}
                            style={{ alignSelf: 'flex-end' }}
                          />
                        </div>
                        {/* 日期标签 */}
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
                  每日连续出勤明细（≥ 15 天）
                </h4>
                {weeklyData.map(day => (
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
                        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 px-3 pb-1 border-b border-blue-50">
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">姓名</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide">岗位</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-right w-20">连续天数</span>
                          <span className="text-[9px] font-black text-zinc-400 uppercase tracking-wide text-center w-28">排休计划</span>
                        </div>
                        {/* 数据行 */}
                        {day.details.map((detail, idx) => {
                          const plan = leavePlans[`${day.date}_${detail.name}`];
                          const isPickerOpen = pickerFor?.date === day.date && pickerFor?.name === detail.name;
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-[1fr_1fr_auto_auto] gap-x-3 items-center bg-white rounded-md px-3 py-2 border border-blue-50 relative"
                            >
                              {/* 姓名 */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Clock size={10} className="text-blue-400 flex-shrink-0" />
                                <span className="text-[11px] font-bold text-zinc-700 truncate">{detail.name}</span>
                              </div>
                              {/* 岗位 */}
                              <span className="text-[11px] font-medium text-zinc-500 truncate">{detail.jobName}</span>
                              {/* 连续天数 */}
                              <span className={cn(
                                "text-[11px] font-black font-mono text-right w-20 px-1.5 py-0.5 rounded",
                                detail.continuousDays >= 30
                                  ? "bg-red-100 text-red-600"
                                  : detail.continuousDays >= 20
                                    ? "bg-orange-100 text-orange-600"
                                    : "bg-blue-100 text-blue-600"
                              )}>
                                {detail.continuousDays} 天
                              </span>
                              {/* 排休计划（可点击） */}
                              <div
                                className="relative w-28 flex items-center justify-center"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPickerFor(isPickerOpen ? null : { date: day.date, name: detail.name, employeeId: detail.employeeId || '' });
                                }}
                              >
                                <span className={cn(
                                  "text-[10px] font-bold px-2 py-1 rounded-md cursor-pointer border transition-all min-w-[80px] text-center",
                                  plan
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-zinc-50 text-zinc-400 border-dashed border-zinc-300 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50"
                                )}>
                                  {plan ? formatPlanDisplay(plan) : (
                                    <span className="flex items-center justify-center gap-1">
                                      <CalendarDays size={10} /> 排休
                                    </span>
                                  )}
                                </span>

                                {/* 日期选择器弹窗 */}
                                <DatePickerPopover
                                  isOpen={isPickerOpen}
                                  onClose={() => setPickerFor(null)}
                                  onSelect={(start, end) => handleSelectDate(day.date, detail.name, detail.employeeId || '', start, end)}
                                  onClear={() => handleClearPlan(day.date, detail.name, detail.employeeId || '')}
                                  currentPlan={plan}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-300 font-bold pl-1">无连续出勤 ≥ 15 天人员</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50/50 flex-shrink-0">
              <p className="text-[9px] text-zinc-400 font-bold text-center">
                仅展示连续出勤 ≥ 15 天的人员明细
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
  );
}
