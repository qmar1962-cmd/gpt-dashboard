import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, Clock, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import { Attendance15WeeklyDetail } from '../lib/dataProcessor';
import { cn } from '../lib/utils';
import { DIM_COLORS } from '../lib/theme';
import { loadCollaborationData, saveCollaborationData } from '../lib/collaborationApi';
import { idbGetRawData } from '../lib/database';
import ConfirmModal from './ConfirmModal';

// ── 排休数据结构 ──

interface DateRange {
  start: string;      // YYYY-MM-DD 排休开始
  end: string;        // YYYY-MM-DD 排休结束
}

interface LeavePlanRecord {
  ranges: DateRange[];   // 多段日期
  setDate: string;       // YYYY-MM-DD 设置日期
  savedAt: string;       // 真实保存日期（YYYY-MM-DD），用于继承判断
  name: string;
  employeeId: string;
  groupRate?: number;
  restJudgment?: string;
}

// ── 多段日期选择器弹窗 ──
interface DatePickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (ranges: DateRange[]) => void;
  onClear: () => void;
  currentRanges?: DateRange[];
}

const fmtMD = (d: string) => { const p = d.split('-'); return `${parseInt(p[1])}/${parseInt(p[2])}`; };

function DatePickerPopover({ isOpen, onClose, onSelect, onClear, currentRanges }: DatePickerPopoverProps) {
  const [ranges, setRanges] = useState<DateRange[]>([]);
  const [mode, setMode] = useState<'view' | 'add'>('view');
  const [viewDate, setViewDate] = useState(() => new Date());
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [pickEnd, setPickEnd] = useState<string | null>(null);
  const [selectingStart, setSelectingStart] = useState(true);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRanges(currentRanges ? [...currentRanges] : []);
      setMode('view');
      setPickStart(null); setPickEnd(null); setSelectingStart(true);
      setViewDate(new Date());
    }
  }, [isOpen, currentRanges]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  const isInRange = (d: string) => {
    if (pickStart && pickEnd) return d >= pickStart && d <= pickEnd;
    if (pickStart && hoverDate && !selectingStart) {
      const [a, b] = pickStart < hoverDate ? [pickStart, hoverDate] : [hoverDate, pickStart];
      return d >= a && d <= b;
    }
    return d === pickStart;
  };

  const handleDayClick = (d: string) => {
    if (selectingStart || !pickStart) { setPickStart(d); setPickEnd(null); setSelectingStart(false); }
    else { setPickStart(pickStart < d ? pickStart : d); setPickEnd(pickStart < d ? d : pickStart); }
  };

  const addRange = () => {
    if (!pickStart) return;
    const r: DateRange = { start: pickStart, end: pickEnd || pickStart };
    setRanges(prev => [...prev, r].sort((a, b) => a.start.localeCompare(b.start)));
    setMode('view'); setPickStart(null); setPickEnd(null); setSelectingStart(true);
  };

  const removeRange = (i: number) => { setRanges(prev => prev.filter((_, idx) => idx !== i)); };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className="absolute right-0 top-full mt-1 bg-[#faf7f2] rounded-xl shadow-xl border border-[#e8e2d9] z-50 w-[300px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {mode === 'view' ? (
          <>
            {/* 已选日期段列表 */}
            <div className="px-3 py-2 max-h-[160px] overflow-y-auto space-y-1">
              {ranges.length === 0 && <p className="text-[10px] text-slate-400 text-center py-3">暂未选择排休日期</p>}
              {ranges.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-blue-50 rounded px-2 py-1.5">
                  <span className="text-[11px] font-bold text-blue-700">{fmtMD(r.start)} ~ {fmtMD(r.end)}</span>
                  <button onClick={() => removeRange(i)} className="p-0.5 text-blue-400 hover:text-red-500 hover:bg-red-50 rounded"><X size={12} /></button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#e8e2d9] bg-[#f0ebe3]/50">
              <button onClick={() => setMode('add')} className="flex-1 px-2 py-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded flex items-center justify-center gap-1">
                <CalendarDays size={10} /> 添加日期段
              </button>
              {ranges.length > 0 && (
                <button onClick={() => { setRanges([]); onClear(); }} className="px-2 py-1.5 text-[10px] font-bold text-red-500 hover:bg-red-50 rounded">清空</button>
              )}
              <button onClick={() => { if (ranges.length > 0) onSelect(ranges); onClose(); }} className="px-3 py-1.5 text-[10px] font-bold bg-blue-500 text-white hover:bg-blue-600 rounded">确定</button>
            </div>
          </>
        ) : (
          <>
            {/* 日期选择模式 */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e8e2d9]">
              <button onClick={() => { setViewDate(new Date(year, month - 1, 1)); }} className="p-1 rounded hover:bg-slate-100 text-slate-400"><ChevronLeft size={14} /></button>
              <span className="text-xs font-bold text-slate-700">{year}年{month + 1}月</span>
              <button onClick={() => { setViewDate(new Date(year, month + 1, 1)); }} className="p-1 rounded hover:bg-slate-100 text-slate-400"><ChevronRight size={14} /></button>
            </div>
            <div className="grid grid-cols-7 px-2 py-1 border-b border-slate-50">
              {weekDays.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400 py-0.5">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 p-2 gap-0.5">
              {Array.from({ length: (firstDay + 6) % 7 }, (_, i) => <div key={`e-${i}`} className="h-7" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const inR = isInRange(ds);
                const isS = ds === pickStart; const isE = ds === pickEnd;
                return <button key={d} onClick={() => handleDayClick(ds)} onMouseEnter={() => setHoverDate(ds)}
                  className={cn("h-7 text-[11px] font-medium rounded-md flex items-center justify-center transition-all",
                    inR ? "bg-blue-50 text-blue-700" : "hover:bg-slate-100 text-slate-600",
                    (isS || isE) && "bg-blue-500 text-white font-bold")}>{d}</button>;
              })}
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#e8e2d9] bg-[#f0ebe3]/50">
              <span className="text-[10px] font-bold text-slate-500 truncate max-w-[160px]">
                {pickStart ? (pickEnd ? `${fmtMD(pickStart)} ~ ${fmtMD(pickEnd)}` : `起点 ${fmtMD(pickStart)}，选终点`) : '点击选择起始日期'}
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => { setMode('view'); setPickStart(null); setPickEnd(null); }} className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:bg-slate-100 rounded">返回</button>
                <button onClick={addRange} disabled={!pickStart}
                  className={cn("px-2.5 py-1 text-[10px] font-bold rounded", pickStart ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-400")}>添加</button>
              </div>
            </div>
          </>
        )}
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
  const [showAllDays, setShowAllDays] = useState(false);
  const displayDays = showAllDays ? weeklyData : [weeklyData[weeklyData.length - 1]];
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
  // 小组出勤率与排休判定：工号 → { group, rate, judgment }
  const [empGroupObj, setEmpGroupObj] = useState<Record<string, string>>({}); // 工号→组别
  const [t2PresentList, setT2PresentList] = useState<string[]>([]); // T-2出勤工号列表

  // 加载远端协作数据
  useEffect(() => {
    if (!isOpen || !weeklyData.length) return;

    const loadData = async () => {
      console.log('[加载] 开始加载协作数据, centerName:', centerName);
      // 1. 加载排休计划
      const plans = await loadCollaborationData('leave_plans.json');
      console.log('[加载] leave_plans.json 加载结果:', plans);
      // 兼容旧数据：start/end → ranges
      for (const c of Object.keys(plans)) {
        for (const d of Object.keys(plans[c] || {})) {
          for (const n of Object.keys(plans[c][d] || {})) {
            const rec = plans[c][d][n];
            if (rec && !rec.ranges && rec.start) {
              rec.ranges = [{ start: rec.start, end: rec.end || rec.start }];
            }
          }
        }
      }
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

      // 3. 自动继承：用最近一次保存的真实日期（savedAt）跟数据日期比，≤ 1 天才继承
      const matchedKeysBefore = new Set(Object.keys(matched));
      const allPeopleInWindow = new Set(weeklyData.flatMap(d => d.details.map(p => p.name)));
      const today = new Date().toISOString().slice(0, 10);
      console.log('[排休继承检查] today:', today, 'centerPlans keys:', Object.keys(centerPlans).length, 'window people:', allPeopleInWindow.size);
      let planInherited = 0;
      for (const personName of allPeopleInWindow) {
        let mostRecentSavedAt = '';
        let mostRecentPlan: LeavePlanRecord | null = null;
        for (const [histDate, histPeople] of Object.entries(centerPlans)) {
          const rec = histPeople[personName];
          const saveDate = rec?.savedAt || rec?.setDate;
          if (rec && saveDate > mostRecentSavedAt) {
            mostRecentSavedAt = saveDate;
            mostRecentPlan = rec;
          }
        }
        if (mostRecentPlan && mostRecentSavedAt) {
          let earliestDataDate = '';
          for (const d of weeklyData) {
            if (d.details.some(p => p.name === personName)) {
              if (!earliestDataDate || d.date < earliestDataDate) earliestDataDate = d.date;
            }
          }
          const refDate = earliestDataDate || today;
          const gapDays = Math.round(
            (new Date(refDate).getTime() - new Date(mostRecentSavedAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          console.log('[排休继承检查]', personName, 'savedAt:', mostRecentSavedAt, 'refDate:', refDate, 'gap:', gapDays);
          if (gapDays <= 1) {
            for (const d of weeklyData) {
              if (d.details.some(p => p.name === personName) && matched[`${d.date}_${personName}`] === undefined) {
                matched[`${d.date}_${personName}`] = mostRecentPlan;
                planInherited++;
              }
            }
          }
        }
      }
      console.log('[排休继承检查] 继承完成, 继承条数:', planInherited);

      // 4. 自动保存继承的排休计划
      const inheritedKeys = Object.keys(matched).filter(k => !matchedKeysBefore.has(k));
      if (inheritedKeys.length > 0) {
        const updatedPlans = JSON.parse(JSON.stringify(plans));
        if (!updatedPlans[centerName]) updatedPlans[centerName] = {};
        for (const key of inheritedKeys) {
          const underscoreIdx = key.indexOf('_');
          const date = key.substring(0, underscoreIdx);
          const name = key.substring(underscoreIdx + 1);
          const plan = matched[key];
          if (!plan.savedAt) plan.savedAt = today;
          if (!plan.setDate) plan.setDate = today;
          if (!updatedPlans[centerName][date]) updatedPlans[centerName][date] = {};
          updatedPlans[centerName][date][name] = plan;
        }
        setCollaborationData(updatedPlans);
        const saveResult = await saveCollaborationData('leave_plans.json', updatedPlans, `自动继承排休计划: ${centerName}`);
        console.log('[继承] 排休计划自动保存结果:', saveResult);
      }

      setLeavePlans(matched);
      console.log('[加载] 匹配到的排休计划:', matched);

      // 3. 加载花名册和考勤原始数据（只存原始数据，计算结果在渲染时用 useMemo）
      try {
        const t2Date = weeklyData[weeklyData.length - 1]?.date || '';
        const [rosterStored, dailyStored] = await Promise.all([
          idbGetRawData('employee_roster'),
          idbGetRawData('center_daily_attendance'),
        ]);

        const colVal = (row: any, patterns: string[]): string => {
          const keys = Object.keys(row);
          for (const p of patterns) { const k = keys.find(k => k.includes(p)); if (k) return String(row[k] || '').trim(); }
          return '';
        };

        // 收集花名册 → {工号: 组别}（仅当前中心 + 中心操作部门）
        const eg: Record<string, string> = {};
        const centerEids = new Set<string>();
        if (rosterStored?.rawData) {
          for (const row of rosterStored.rawData) {
            const eid = colVal(row, ['工号', '员工ID', '员工编号']);
            const g = colVal(row, ['七级部门', '组别']);
            const c = colVal(row, ['九级单位', '六级单位', '所在单位']);
            const dept = colVal(row, ['二级部门']);
            if (!eid || !g) continue;
            if (!c.includes(centerName) && !centerName.includes(c)) continue;
            if (dept && !dept.includes('中心操作')) continue;
            eg[eid] = g;
            centerEids.add(eid);
          }
        }
        setEmpGroupObj(eg);

        // 收集 T-2 出勤工号
        const tp: string[] = [];
        if (dailyStored?.rawData) {
          for (const row of dailyStored.rawData) {
            const eid = colVal(row, ['代号', '工号']);
            if (!eid || !centerEids.has(eid)) continue;
            if (colVal(row, ['日期', '数据日期']) === t2Date) tp.push(eid);
          }
        }
        setT2PresentList(tp);
        console.log('[排休判定] 花名册:', Object.keys(eg).length, '人, T-2出勤:', tp.length, '人');
      } catch (e) { console.warn('[排休判定] 小组数据加载失败:', e); }

      // 加载完成后才重置未保存标记
      setHasUnsavedChanges(false);
    };

    loadData();
  }, [isOpen, weeklyData, centerName]);

  // ════ 渲染时同步计算 groupInfo（避免异步 setState 时序问题） ════
  const groupInfo = useMemo(() => {
    const t2Set = new Set(t2PresentList);
    // 统计每组的 总人数 / T-2出勤人数
    const gTotal: Record<string, number> = {};
    const gPresent: Record<string, number> = {};
    for (const [eid, g] of Object.entries(empGroupObj)) {
      gTotal[g] = (gTotal[g] || 0) + 1;
      if (t2Set.has(eid)) gPresent[g] = (gPresent[g] || 0) + 1;
    }
    // 为每个连续出勤员工生成判定
    const info = new Map<string, { group: string; rate: number; judgment: string }>();
    for (const day of weeklyData) {
      for (const p of day.details) {
        if (info.has(p.employeeId)) continue;
        const g = empGroupObj[p.employeeId] || '未知';
        const t = gTotal[g] || 0;
        const pr = gPresent[g] || 0;
        const rate = t > 0 ? Math.round((pr / t) * 100) : 0;
        const judgment = t > 0 ? (rate >= 85 ? '无法排休' : '没排休') : '数据不足';
        info.set(p.employeeId, { group: g, rate, judgment });
      }
    }
    console.log('[排休判定] 组:', Object.keys(gTotal).length, '个, 连续出勤:', info.size, '人');
    return info;
  }, [empGroupObj, t2PresentList, weeklyData]);

  // 格式化显示：5/20~5/22, 5/28~5/30
  const formatPlanDisplay = (plan?: LeavePlanRecord | null) => {
    if (!plan?.ranges?.length) return '';
    return plan.ranges.map(r => {
      const s = new Date(r.start); const e = new Date(r.end);
      const f = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
      return r.start === r.end ? f(s) : `${f(s)}~${f(e)}`;
    }).join(', ');
  };

  const handleSelectDate = useCallback((date: string, name: string, employeeId: string, ranges: DateRange[]) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const newPlan: LeavePlanRecord = { employeeId, name, ranges, setDate: todayStr, savedAt: todayStr };

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
        plan.savedAt = new Date().toISOString().slice(0, 10);
        // 附上小组排休判定
        const gi = groupInfo.get(plan.employeeId);
        if (gi) { plan.groupRate = gi.rate; plan.restJudgment = gi.judgment; }
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
  }, [collaborationData, centerName, weeklyData, leavePlans]);

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

  // 关闭 picker 的点击外部逻辑
  useEffect(() => {
    if (!pickerFor) return;
    const handler = () => setPickerFor(null);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [pickerFor]);

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
            className="fixed inset-x-4 top-[6%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[720px] max-h-[88vh] bg-[#faf7f2] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e2d9] flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black tracking-tight">
                  {provinceName} · {centerName}中心
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  操作在职 {Object.keys(empGroupObj).length}人 · T-2出勤 {t2PresentList.length}人 · 出勤率 {Object.keys(empGroupObj).length > 0 ? Math.round(t2PresentList.length / Object.keys(empGroupObj).length * 100) : 0}%
                  （{weeklyData[weeklyData.length - 1]?.date?.slice(5) || ''}）
                </p>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                  <TrendingUp size={11} />
                  近7天连续出勤趋势（T-2 = 今天 - 2天）
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="text-blue-600">T-2: {currentCount} 人</span>
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
              <div className="bg-[#f0ebe3] rounded-xl p-4">
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
                          day.abnormalCount > 0 ? "text-blue-500" : "text-slate-300"
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
                                : "bg-slate-200",
                              isLatest && day.abnormalCount > 0 && "ring-2 ring-blue-300 ring-offset-1"
                            )}
                            style={{ alignSelf: 'flex-end' }}
                          />
                        </div>
                        {/* 日期标签 */}
                        <span className={cn(
                          "text-[9px] font-bold",
                          isLatest ? "text-blue-500 font-black" : "text-slate-400"
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
                  每日连续出勤明细（≥ 15 天）
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
                        ? "border-blue-100 bg-blue-50/30"
                        : "border-[#e8e2d9] bg-[#f0ebe3]/30"
                    )}
                  >
                    {/* 日期行 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-black text-slate-700">{day.dateLabel}</span>
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
                      <span className="text-[9px] text-slate-400 font-bold">{day.date}</span>
                    </div>

                    {day.abnormalCount > 0 ? (
                      <div className="space-y-1">
                        {/* 表头 */}
                        <div className="grid grid-cols-[1fr_1fr_5rem_5rem] gap-x-3 px-3 pb-1 border-b border-blue-50">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">姓名</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide">岗位</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide text-right">连续天数</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide text-center">排休计划</span>
                        </div>
                        {/* 数据行 */}
                        {day.details.map((detail, idx) => {
                          const plan = leavePlans[`${day.date}_${detail.name}`];
                          const isPickerOpen = pickerFor?.date === day.date && pickerFor?.name === detail.name;
                          const gi = groupInfo.get(detail.employeeId);
                          return (
                            <div
                              key={idx}
                              className="bg-[#faf7f2] rounded-md px-3 py-2 border border-blue-50 relative"
                            >
                            <div className="grid grid-cols-[1fr_1fr_5rem_5rem] gap-x-3 items-center">
                              {/* 姓名 */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Clock size={10} className="text-blue-400 flex-shrink-0" />
                                <span className="text-[11px] font-bold text-slate-700 truncate">{detail.name}</span>
                              </div>
                              {/* 岗位 */}
                              <span className="text-[11px] font-medium text-slate-500 truncate">{detail.jobName}</span>
                              {/* 连续天数 */}
                              <span className={cn(
                                "text-[11px] font-black font-mono text-right px-1.5 py-0.5 rounded",
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
                                className="relative flex items-center justify-center min-h-[26px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPickerFor(isPickerOpen ? null : { date: day.date, name: detail.name, employeeId: detail.employeeId || '' });
                                }}
                              >
                                <span
                                  title={plan ? formatPlanDisplay(plan) : '点击设置排休'}
                                  className={cn(
                                    "text-[11px] font-bold px-1.5 py-0.5 rounded cursor-pointer border transition-all w-full text-center truncate",
                                    plan
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                      : "bg-[#f0ebe3] text-slate-400 border-dashed border-slate-300 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50"
                                  )}
                                >
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
                                  onSelect={(ranges) => handleSelectDate(day.date, detail.name, detail.employeeId || '', ranges)}
                                  onClear={() => handleClearPlan(day.date, detail.name, detail.employeeId || '')}
                                  currentRanges={plan?.ranges}
                                />
                              </div>
                            </div>
                            {/* 组别 + 出勤率 + 排休判定 */}
                            {gi && (
                              <div className="flex items-center gap-3 mt-1.5 pt-1.5 border-t border-blue-50 text-[10px]">
                                <span className="text-slate-500">组别：<span className="font-bold text-slate-700">{gi.group}</span></span>
                                <span className="text-slate-500">出勤率：<span className={cn("font-bold", gi.rate >= 85 ? "text-red-600" : "text-emerald-600")}>{gi.rate}%</span></span>
                                <span className={cn("px-1.5 py-0.5 rounded font-bold text-[9px]",
                                  gi.judgment === '无法排休' ? "bg-red-100 text-red-600" :
                                  gi.judgment === '没排休' ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"
                                )}>{gi.judgment}</span>
                              </div>
                            )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-300 font-bold pl-1">无连续出勤 ≥ 15 天人员</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-[#e8e2d9] bg-[#f0ebe3]/50 flex-shrink-0">
              <p className="text-[9px] text-slate-400 font-bold text-center">
                仅展示连续出勤 ≥ 15 天的人员明细
              </p>
              {hasUnsavedChanges ? (
                <p className="text-[9px] text-amber-600 font-bold text-center mt-1 flex items-center justify-center gap-1">
                  <AlertTriangle size={12} /><span>有未保存的更改，关闭弹窗时会提示保存</span>
                </p>
              ) : (
                <p className="text-[9px] text-emerald-600 font-bold text-center mt-1 flex items-center justify-center gap-1">
                  <Check size={12} />已同步到远端，其他用户刷新即可看到
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    <ConfirmModal
      isOpen={showSaveConfirm}
      title="保存排休计划"
      message="排休计划已修改，是否保存到远端？保存后其他用户刷新页面即可看到最新数据。"
      confirmText="保存并关闭"
      cancelText="不保存，直接关闭"
      destructive
      onConfirm={handleConfirmSave}
      onCancel={() => { setShowSaveConfirm(false); onClose(); }}
    />
    </>
  );
}
