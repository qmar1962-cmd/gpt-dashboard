import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, TrendingUp, AlertCircle, ChevronDown } from 'lucide-react';
import { Attendance7WeeklyDetail } from '../lib/dataProcessor';
import { cn } from '../lib/utils';
import { loadCollaborationData, saveCollaborationData } from '../lib/collaborationApi';
import ConfirmModal from './ConfirmModal';

// ── 未出勤原因选项 ──
const REASON_OPTIONS = [
  '工伤', '事假', '病假', '纠纷',
  '挂编', '出差', '离职未清', '已返岗', '实习生返校',
];

// ── 未出勤原因数据结构 ──

interface AbsenceReasonRecord {
  reason: string;      // 选中的原因
  employeeId: string;  // 工号（主键）
  name: string;        // 姓名（显示用）
  date: string;        // 记录这是哪一天的异常（格式：YYYY-MM-DD）
  savedAt: string;     // 真实保存日期（YYYY-MM-DD），用于继承判断
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
  const [showAllDays, setShowAllDays] = useState(false);
  const displayDays = showAllDays ? weeklyData : [weeklyData[weeklyData.length - 1]];
  const maxAbnormal = Math.max(...weeklyData.map(d => d.abnormalCount), 1);

  // 未出勤原因状态：按「date_name」key → 原因字符串
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  // 远端协作数据（按中心-日期-姓名组织）
  const [collaborationData, setCollaborationData] = useState<Record<string, Record<string, Record<string, AbsenceReasonRecord>>>>({});
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
      console.log('[加载] 开始加载协作数据, centerName:', centerName);
      // 1. 加载未出勤原因
      const reasons = await loadCollaborationData('absence_reasons.json');
      console.log('[加载] absence_reasons.json 加载结果:', reasons);
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

      // 3. 自动继承：用最近一次保存的真实日期（savedAt）与数据日期对比，≤ 1 天才继承
      const matchedKeysBefore = new Set(Object.keys(matched));
      const allPeopleInWindow = new Set(weeklyData.flatMap(d => d.details.map(p => p.name)));
      const today = new Date().toISOString().slice(0, 10);
      console.log('[继承检查] today:', today, 'centerReasons keys:', Object.keys(centerReasons).length, 'window people:', allPeopleInWindow.size);
      let inheritedCount = 0;
      for (const personName of allPeopleInWindow) {
        let mostRecentSavedAt = '';
        let mostRecentReason = '';
        for (const [histDate, histPeople] of Object.entries(centerReasons)) {
          const rec = histPeople[personName];
          const saveDate = rec?.savedAt || rec?.date;
          if (rec && saveDate > mostRecentSavedAt) {
            mostRecentSavedAt = saveDate;
            mostRecentReason = rec.reason;
          }
        }
        if (mostRecentReason && mostRecentSavedAt) {
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
          if (gapDays <= 1) {
            for (const d of weeklyData) {
              if (d.details.some(p => p.name === personName) && matched[`${d.date}_${personName}`] === undefined) {
                matched[`${d.date}_${personName}`] = mostRecentReason;
                inheritedCount++;
              }
            }
          }
        }
      }
      console.log('[继承检查] 继承完成, 继承条数:', inheritedCount);

      // 4. 自动保存继承的条目（新出现的 key 写回 Supabase）
      const inheritedKeys = Object.keys(matched).filter(k => !matchedKeysBefore.has(k));
      console.log('[继承检查] matched before:', matchedKeysBefore.size, 'after:', Object.keys(matched).length, 'new:', inheritedKeys.length);
      if (inheritedKeys.length > 0) {
        const updatedReasons = JSON.parse(JSON.stringify(reasons));
        if (!updatedReasons[centerName]) updatedReasons[centerName] = {};
        for (const key of inheritedKeys) {
          const underscoreIdx = key.indexOf('_');
          const date = key.substring(0, underscoreIdx);
          const name = key.substring(underscoreIdx + 1);
          // 从 weeklyData 里找 employeeId
          let employeeId = '';
          for (const day of weeklyData) {
            const person = day.details.find(p => p.name === name);
            if (person) { employeeId = person.employeeId || ''; break; }
          }
          if (!updatedReasons[centerName][date]) updatedReasons[centerName][date] = {};
          updatedReasons[centerName][date][name] = {
            reason: matched[key],
            date,
            savedAt: today,
            employeeId,
            name,
          };
        }
        setCollaborationData(updatedReasons);
        const saveResult = await saveCollaborationData('absence_reasons.json', updatedReasons, `自动继承未出勤原因: ${centerName}`);
        console.log('[继承] 自动保存结果:', saveResult);
      }

      setReasonMap(matched);
      console.log('[加载] 匹配到的原因:', matched);

      // 加载完成后才重置未保存标记
      setHasUnsavedChanges(false);
    };

    loadData();
  }, [isOpen, weeklyData, centerName]);

  // 选择原因
  const handleSelectReason = useCallback((date: string, name: string, employeeId: string, reason: string) => {
    const savedAt = new Date().toISOString().slice(0, 10);
    const newRecord: AbsenceReasonRecord = { employeeId: employeeId || '', name, reason, date, savedAt };

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

  // 保存未出勤原因到远端
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // 第一步：根据 reasonMap 重建 collaborationData[centerName]（确保同一个人所有日期都存进去）
      const rebuiltData = JSON.parse(JSON.stringify(collaborationData));
      if (!rebuiltData[centerName]) rebuiltData[centerName] = {};
      // 遍历 reasonMap，重建 centerName 下的数据结构
      for (const [key, reason] of Object.entries(reasonMap)) {
        // key 格式: YYYY-MM-DD_name（名字无下划线，用第一个下划线分割）
        const underscoreIdx = key.indexOf('_');
        const date = key.substring(0, underscoreIdx);
        const name = key.substring(underscoreIdx + 1);
        if (!rebuiltData[centerName][date]) rebuiltData[centerName][date] = {};
        // 从 weeklyData 里找到这个人的 employeeId
        let employeeId = '';
        for (const day of weeklyData) {
          const person = day.details.find(p => p.name === name);
          if (person) { employeeId = person.employeeId || ''; break; }
        }
        // 保存时始终更新 savedAt 为今天（确保下次能继承）
        const savedAt = new Date().toISOString().slice(0, 10);
        rebuiltData[centerName][date][name] = { employeeId, name, reason, date, savedAt };
      }

      // 第二步：清理当前7天窗口内不在异常列表里的人（不碰历史数据）
      const validNames = new Set(weeklyData.flatMap(d => d.details.map(p => p.name)));
      const currentDates = new Set(weeklyData.map(d => d.date));
      if (rebuiltData[centerName]) {
        const centerReasons = rebuiltData[centerName];
        for (const date of Object.keys(centerReasons)) {
          // 只清理当前窗口的日期，不碰历史数据
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

      console.log('[保存] 开始保存 absence_reasons.json, rebuiltData:', rebuiltData);
      const result = await saveCollaborationData(
        'absence_reasons.json',
        rebuiltData,
        `Update absence reasons for ${centerName}`
      );
      console.log('[保存] absence_reasons.json 保存结果:', result);
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
  }, [collaborationData, centerName, weeklyData, reasonMap]);

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);

  // 处理关闭弹窗（检查未保存修改）
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
      '工伤': 'bg-red-100 text-red-700 border-red-200',
      '事假': 'bg-amber-100 text-amber-700 border-amber-200',
      '病假': 'bg-purple-100 text-purple-700 border-purple-200',
      '纠纷': 'bg-orange-100 text-orange-700 border-orange-200',
      '挂编': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      '出差': 'bg-blue-100 text-blue-700 border-blue-200',
      '离职未清': 'bg-slate-100 text-slate-700 border-slate-300',
      '已返岗': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
    return colorMap[reason] || 'bg-slate-50 text-slate-600 border-slate-200';
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
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-black tracking-tight">
                  {provinceName} · {centerName}中心
                </h3>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                  <TrendingUp size={11} />
                  近7天连续未出勤趋势（T-2 = 今天 - 2天）
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
                        <span className={cn(
                          "text-[10px] font-black",
                          day.abnormalCount > 0 ? "text-red-500" : "text-slate-300"
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
                                : "bg-slate-200",
                              isLatest && day.abnormalCount > 0 && "ring-2 ring-red-300 ring-offset-1"
                            )}
                            style={{ alignSelf: 'flex-end' }}
                          />
                        </div>
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
                  每日连续未出勤明细（≥ 7 天）
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
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide text-right w-20">未出勤天数</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide text-center w-28">未出勤原因</span>
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
                                <span className="text-[11px] font-bold text-slate-700 truncate">{detail.name}</span>
                              </div>
                              {/* 岗位 */}
                              <span className="text-[11px] font-medium text-slate-500 truncate">{detail.jobName}</span>
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
                                      : "bg-slate-50 text-slate-400 border-dashed border-slate-300 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 min-w-[80px]"
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
                                      className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 z-50 w-28 overflow-hidden"
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
                                              : "hover:bg-slate-50 text-slate-600"
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
                      <p className="text-[10px] text-slate-300 font-bold pl-1">无连续未出勤 ≥ 7 天人员</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 底部 */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
              <p className="text-[9px] text-slate-400 font-bold text-center">
                仅展示连续未出勤 ≥ 7 天的人员明细
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
      title="保存未出勤原因"
      message="未出勤原因已修改，是否保存到远端？保存后其他用户刷新页面即可看到最新数据。"
      confirmText="保存并关闭"
      cancelText="不保存，直接关闭"
      destructive
      onConfirm={handleConfirmSave}
      onCancel={() => { setShowSaveConfirm(false); onClose(); }}
    />
    </>
  );
}
