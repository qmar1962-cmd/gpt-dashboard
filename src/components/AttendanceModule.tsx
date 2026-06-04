import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Search, X, CalendarDays,
  BarChart2, ChevronDown, AlertTriangle, SlidersHorizontal,
  Check, Copy, CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import AttendanceSummaryDetailModal from './AttendanceSummaryDetailModal';
import { idbGetRawData } from '../lib/database';
import { LoadingSpinner } from './LoadingOverlay';
import { loadCollaborationData, saveCollaborationData } from '../lib/collaborationApi';

// ── 类型定义 ─────────────────────────────────────────────
interface AttendanceRow {
  seq: number | string;
  empId: string;
  name: string;
  dept2: string;
  group: string;
  role: string;
  days: string[];
  absenceDays: number | string;
  truantDeductDays: number | string;
  actualWorkDays: number | string;
  workDays: number | string;
  paidLeaveDays: number | string;
  shouldWorkDays: number | string;
  legalPayDays: number | string;
  personalLeave: number | string;
  sickLeave: number | string;
  truantDays: number | string;
  lateMinutes: number | string;
  earlyLeaveMinutes: number | string;
  reportActualDays: number | string;
  sysDiff: number | string;
  diffReason: string;
  remark: string;
}

interface AttendanceCenterData {
  title: string;
  month: string;
  center: string;
  dayNums: string[];
  weekNames: string[];
  rows: AttendanceRow[];
}

type AttendanceDataMap = { [key: string]: AttendanceCenterData };

// ── 常量 ─────────────────────────────────────────────────
const ATTENDANCE_PAGE_SIZE = 20;
const WARNING_PAGE_SIZE = 20;
const GROUP_LEADERS_STORAGE_KEY = 'gpt_dashboard_group_leaders';
const GROUP_LEADERS_FIRESTORE_DOC = 'shared_group_leaders';

// ── 筛选下拉组件 ─────────────────────────────────────────
interface FilterDropdownProps {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}
function FilterDropdown({ label, options, value, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = options.filter(o =>
    !search.trim() || o.toLowerCase().includes(search.toLowerCase())
  );

  const isActive = value !== '';

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={`ml-1 p-0.5 rounded transition-all ${
          isActive ? 'text-blue-600 bg-blue-50' : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
        }`}
        title={`筛选${label}`}
      >
        <SlidersHorizontal size={11} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#faf7f2] border border-[#e8e2d9] rounded-lg shadow-lg z-50 py-1">
          <div className="px-2 pb-1 border-b border-[#e8e2d9]">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索..."
              className="w-full px-2 py-1 text-[11px] border border-[#e8e2d9] rounded focus:outline-none focus:border-blue-400"
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-0.5" style={{ scrollbarWidth: 'thin' }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              className={`w-full px-3 py-1.5 text-left text-[11px] flex items-center gap-2 transition-colors ${
                value === '' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-[#f0ebe3]'
              }`}
            >
              {value === '' && <Check size={12} className="text-blue-600" />}
              <span className={value === '' ? '' : 'ml-4'}>（全部）</span>
            </button>
            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                className={`w-full px-3 py-1.5 text-left text-[11px] flex items-center gap-2 transition-colors ${
                  value === opt ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-[#f0ebe3]'
                }`}
              >
                {value === opt && <Check size={12} className="text-blue-600" />}
                <span className={value === opt ? '' : 'ml-4'}>{opt}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────
interface AttendanceModuleProps {
  embedded?: boolean;
  onAttendanceDetailOpen?: (data: {
    dept2: string;
    group: string;
    fullDate: string;
    rows: Array<{ empId: string; name: string; role: string; dept2: string; group: string }>;
  }) => void;
}

// ── 主组件 ────────────────────────────────────────────────
export default function AttendanceModule({ embedded = false, onAttendanceDetailOpen }: AttendanceModuleProps) {
  const [tab, setTab] = useState<'summary' | 'calendar'>('summary');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [center, setCenter] = useState<string>('');
  const [centersList, setCentersList] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<string>('');
  // 出勤预警筛选 - 连续出勤
  const [warningWorkDeptFilter, setWarningWorkDeptFilter] = useState<string>('');
  const [warningWorkGroupFilter, setWarningWorkGroupFilter] = useState<string>('');
  const [warningWorkLeaderFilter, setWarningWorkLeaderFilter] = useState<string>('');
  const [warningWorkDaysFilter, setWarningWorkDaysFilter] = useState<string>('');
  // 出勤预警筛选 - 连续未出勤
  const [warningAbsentDeptFilter, setWarningAbsentDeptFilter] = useState<string>('');
  const [warningAbsentGroupFilter, setWarningAbsentGroupFilter] = useState<string>('');
  const [warningAbsentLeaderFilter, setWarningAbsentLeaderFilter] = useState<string>('');
  const [warningAbsentDaysFilter, setWarningAbsentDaysFilter] = useState<string>('');
  const [detailModal, setDetailModal] = useState<{
    dept2: string;
    group: string;
    fullDate: string;
  } | null>(null);

  // 日出勤明细数据（从 IndexedDB 读取）
  const [dailyData, setDailyData] = useState<{ [key: string]: { [key: string]: boolean } }>({});
  const [dailyLoading, setDailyLoading] = useState(true);

  // 花名册数据（从 IndexedDB 读取）
  const [rosterData, setRosterData] = useState<AttendanceRow[]>([]);
  const [rosterLoading, setRosterLoading] = useState(true);

  // 考勤月份（默认当前月，有数据后自动切到数据最新月）
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const prevMonth = () => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() - 1); setCalendarMonth(d); };
  const nextMonth = () => { const d = new Date(calendarMonth); d.setMonth(d.getMonth() + 1); setCalendarMonth(d); };

  // 预警分页
  const [warningWorkPage, setWarningWorkPage] = useState(1);
  const [warningAbsentPage, setWarningAbsentPage] = useState(1);
  const [workCopyState, setWorkCopyState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [absentCopyState, setAbsentCopyState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [textCopyState, setTextCopyState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // 小组负责人手动编辑
  const [groupLeaderOverrides, setGroupLeaderOverrides] = useState<{ [key: string]: string }>({});
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [editingLeaderValue, setEditingLeaderValue] = useState('');
  // 未保存到远端的负责人修改（从 localStorage 恢复未保存的修改）
  const [pendingLeaderOverrides, setPendingLeaderOverrides] = useState<{ [key: string]: string } | null>(() => {
    try {
      const saved = localStorage.getItem('unsaved_group_leaders_data');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error('[考勤] localStorage 读取失败:', e); }
    return null;
  });

  // ════ 负责人相关逻辑（GitHub API 协作存储）════
  const loadLeaderOverrides = useCallback(async () => {
    // 1. 先加载本地缓存（快速显示）
    try {
      const raw = localStorage.getItem(GROUP_LEADERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
          setGroupLeaderOverrides(parsed);
        }
      }
    } catch { /* ignore */ }

    // 2. 从 GitHub API 加载远端协作数据
    try {
      const remote = await loadCollaborationData('group_leaders.json');
      if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
        // 合并：远端数据覆盖本地（远端是权威来源）
        const merged = { ...groupLeaderOverrides, ...remote };
        setGroupLeaderOverrides(merged);
        localStorage.setItem(GROUP_LEADERS_STORAGE_KEY, JSON.stringify(merged));
      }
    } catch (e) {
      console.error('[AttendanceModule] 加载远端负责人失败:', e);
    }
  }, []);

  const saveLeaderOverrides = useCallback(async (overrides: { [key: string]: string }) => {
    try {
      // 1. 本地缓存
      localStorage.setItem(GROUP_LEADERS_STORAGE_KEY, JSON.stringify(overrides));
      setGroupLeaderOverrides(overrides);
    } catch (e) {
      console.error('[AttendanceModule] 保存负责人到本地失败:', e);
    }
  }, []);

  // 保存负责人修改到云端（内部函数，不弹窗）
  const doSaveLeadersToCloud = useCallback(async () => {
    if (pendingLeaderOverrides === null) return false;
    try {
      const result = await saveCollaborationData('group_leaders.json', pendingLeaderOverrides, 'Update group leaders');
      if (result.success) {
        localStorage.setItem(GROUP_LEADERS_STORAGE_KEY, JSON.stringify(pendingLeaderOverrides));
        setGroupLeaderOverrides(pendingLeaderOverrides);
        setPendingLeaderOverrides(null);
        return true;
      } else {
        return false;
      }
    } catch (e) {
      return false;
    }
  }, [pendingLeaderOverrides]);

  // 点击"保存到云端"：直接保存
  const handleSaveClick = useCallback(async () => {
    await doSaveLeadersToCloud();
  }, [doSaveLeadersToCloud]);

  // 丢弃负责人修改（恢复为云端版本）
  const handleDiscardLeaderChanges = useCallback(() => {
    setPendingLeaderOverrides(null);
  }, []);

  // 同步未保存标记到 localStorage（供 App.tsx 切换 tab 时检查）
  useEffect(() => {
    if (pendingLeaderOverrides !== null) {
      localStorage.setItem('unsaved_group_leaders', 'true');
      localStorage.setItem('unsaved_group_leaders_data', JSON.stringify(pendingLeaderOverrides));
    } else {
      localStorage.removeItem('unsaved_group_leaders');
      localStorage.removeItem('unsaved_group_leaders_data');
    }
  }, [pendingLeaderOverrides]);

  useEffect(() => { loadLeaderOverrides(); }, [loadLeaderOverrides]);

  // 监听 beforeunload：刷新/关闭标签页时提示保存
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingLeaderOverrides !== null) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingLeaderOverrides]);

  // 暴露给父组件：检查是否有未保存修改（用于 tab 切换时拦截）
  const checkUnsavedLeaderChanges = useCallback((): 'unsaved' | 'none' => {
    return pendingLeaderOverrides !== null ? 'unsaved' : 'none';
  }, [pendingLeaderOverrides]);

  // 暴露给父组件：保存负责人到云端（用于 tab 切换时调用）
  const saveLeadersAndConfirm = useCallback(async (): Promise<boolean> => {
    if (pendingLeaderOverrides === null) return true;
    return await doSaveLeadersToCloud() || false;
  }, [pendingLeaderOverrides, doSaveLeadersToCloud]);

  const getGroupLeader = useCallback((centerName: string, groupName: string): string => {
    const key = `${centerName}|||${groupName}`;
    // 优先读未保存的修改，再读已保存的
    if (pendingLeaderOverrides && pendingLeaderOverrides[key] !== undefined) {
      return pendingLeaderOverrides[key];
    }
    return groupLeaderOverrides[key] || '';
  }, [pendingLeaderOverrides, groupLeaderOverrides]);

  const handleStartEdit = useCallback((centerName: string, groupName: string, currentVal: string) => {
    const key = `${centerName}|||${groupName}`;
    setEditingGroupKey(key);
    setEditingLeaderValue(currentVal);
  }, []);

  const handleConfirmEdit = useCallback((centerName: string, groupName: string) => {
    const key = `${centerName}|||${groupName}`;
    const newOverrides = { ...(pendingLeaderOverrides || groupLeaderOverrides), [key]: editingLeaderValue.trim() };
    setPendingLeaderOverrides(newOverrides);
    setEditingGroupKey(null);
    setEditingLeaderValue('');
  }, [pendingLeaderOverrides, groupLeaderOverrides, editingLeaderValue]);

  const handleCancelEdit = useCallback(() => {
    setEditingGroupKey(null);
    setEditingLeaderValue('');
  }, []);

  // ════ 加载花名册数据 ════
  const loadRosterData = useCallback(async () => {
    try {
      setRosterLoading(true);
      const stored = await idbGetRawData('employee_roster');
      if (stored?.rawData && Array.isArray(stored.rawData)) {
        const firstValidRow = stored.rawData.find(
          (r: any) => r && typeof r === 'object' && Object.keys(r).length > 0
        );
        if (!firstValidRow) {
          console.error('[花名册加载] 找不到有效数据行');
          setRosterData([]);
          return;
        }
        const sampleKeys = Object.keys(firstValidRow);
        const findKey = (keywords: string[]) => sampleKeys.find(k => keywords.some(kw => k.includes(kw)));
        const keyEmpId = findKey(['工号']);
        const keyName = findKey(['姓名']);
        const keyDept2 = findKey(['二级部门']);
        const keyGroup = findKey(['组别', '七级部门']);
        const keyRole = findKey(['岗位名称']);
        const keyCenter = findKey(['所在单位', '七级单位', '九级单位']);
        if (!keyEmpId || !keyName) {
          console.error('[花名册加载] 无法匹配工号/姓名字段');
          setRosterData([]);
          return;
        }
        // 去重：同一工号保留最后一条
        const rowMap = new Map<string, any>();
        for (const row of stored.rawData) {
          if (!row || typeof row !== 'object') continue;
          const empId = String(row[keyEmpId] || '').trim();
          if (empId) rowMap.set(empId, row);
        }
        const dedupedRows = Array.from(rowMap.values());
        const rows: (AttendanceRow & { rosterCenter?: string })[] = dedupedRows.map((row: any, index: number) => ({
          seq: index + 1,
          empId: String(row[keyEmpId] || '').trim(),
          name: String(row[keyName] || '').trim(),
          dept2: String(row[keyDept2] || '').trim(),
          group: String(row[keyGroup] || '').trim(),
          role: String(row[keyRole] || '').trim(),
          rosterCenter: String(row[keyCenter] || '').trim(),
          days: [],
          absenceDays: 0, truantDeductDays: 0, actualWorkDays: 0,
          workDays: 0, paidLeaveDays: 0, shouldWorkDays: 0,
          legalPayDays: 0, personalLeave: 0, sickLeave: 0,
          truantDays: 0, lateMinutes: 0, earlyLeaveMinutes: 0,
          reportActualDays: 0, sysDiff: 0, diffReason: '', remark: '',
        })).filter((r: any) => r.empId && r.name);
        setRosterData(rows as AttendanceRow[]);
      }
    } catch (error) {
      console.error('[AttendanceModule] 读取花名册失败:', error);
    } finally {
      setRosterLoading(false);
    }
  }, []);

  useEffect(() => { loadRosterData(); }, [loadRosterData]);

  // ════ 动态提取中心列表 ════
  useEffect(() => {
    if (rosterData.length > 0) {
      const raw = rosterData.map(r => ((r as any).rosterCenter || '').trim()).filter(Boolean);
      const centers = [...new Set(raw)].filter(c => c.endsWith('转运中心'));
      setCentersList(centers);
      setCenter(prev => prev || centers[0] || '');
    }
  }, [rosterData]);

  // ════ 加载日出勤明细 ════
  const loadDailyData = useCallback(async () => {
    try {
      setDailyLoading(true);
      const stored = await idbGetRawData('center_daily_attendance');
      if (stored?.rawData && Array.isArray(stored.rawData)) {
        const dailyMap: { [key: string]: { [key: string]: boolean } } = {};
        for (const row of stored.rawData) {
          const keys = Object.keys(row);
          const idKey = keys.find(k => /工号|员工ID|员工\s*ID|编号|员工编号|人员编号|代号|id|ID/i.test(k));
          const dateKey = keys.find(k => /日期|数据日期|出勤日期|打卡日期/i.test(k));
          if (!idKey || !dateKey) continue;
          const empId = String(row[idKey] || '').trim();
          const date = String(row[dateKey] || '').trim();
          if (!empId || !date) continue;
          if (!dailyMap[empId]) dailyMap[empId] = {};
          dailyMap[empId][date] = true;
        }
        setDailyData(dailyMap);
      }
    } catch (error) {
      console.error('[AttendanceModule] 读取日出勤明细失败:', error);
    } finally {
      setDailyLoading(false);
    }
  }, []);

  useEffect(() => { loadDailyData(); }, [loadDailyData]);

  // 数据加载后自动切到最近有数据的月份
  useEffect(() => {
    if (Object.keys(dailyData).length === 0) return;
    const allDates = new Set<string>();
    Object.values(dailyData).forEach(empDates => {
      if (empDates && typeof empDates === 'object') Object.keys(empDates).forEach(d => allDates.add(d));
    });
    if (allDates.size === 0) return;
    const latest = Array.from(allDates).sort().pop()!; // e.g. '2026-05-31'
    const [y, m] = latest.split('-').map(Number);
    setCalendarMonth(new Date(y, m - 1, 1));
  }, [dailyData]);

  // ════ 计算 rows（优先花名册） ════
  const rows: AttendanceRow[] = (() => {
    if (rosterLoading) return [];
    if (rosterData.length > 0) {
      const filtered = rosterData.filter(row => {
        const rc = (row as any).rosterCenter || '';
        if (!rc) return false;
        return rc === center || rc.includes(center) || center.includes(rc);
      });
      return filtered.map((r, i) => ({ ...r, seq: i + 1 }));
    }
    return [];
  })();

  // ════ 日历数据源 ════
  const calendarDataSource = dailyLoading
    ? {}
    : (Object.keys(dailyData).length > 0 ? dailyData : {});

  const calendarActiveDates = Object.values(calendarDataSource).reduce((dates: Set<string>, empDates) => {
    if (empDates && typeof empDates === 'object') {
      Object.keys(empDates).forEach(d => dates.add(d));
    }
    return dates;
  }, new Set<string>());

  // ════ 导出通报文本（支持单个中心或全部中心） ════
  const handleExportText = useCallback(async (targetCenters?: string[]): Promise<void> => {
    setTextCopyState('loading');
    try {
      const centersToExport = targetCenters || [center];
      const lines: string[] = [];
      const sortedDates = calendarActiveDates instanceof Set ? Array.from(calendarActiveDates).sort() : [];
      const latestDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
      const latestIndex = latestDate ? sortedDates.indexOf(latestDate) : -1;

      for (const c of centersToExport) {
        const centerRows = rosterData.filter(r => (r as any).rosterCenter === c);
        let workCount = 0;
        let absentCount = 0;
        if (latestIndex >= 0 && centerRows.length > 0) {
          centerRows.forEach(row => {
            const empAtt = calendarDataSource[row.empId] || {};
            let workStreak = 0;
            let absentStreak = 0;
            for (let i = latestIndex; i >= 0; i--) {
              if (empAtt[sortedDates[i]] === true) workStreak++;
              else break;
            }
            for (let i = latestIndex; i >= 0; i--) {
              if (empAtt[sortedDates[i]] !== true) absentStreak++;
              else break;
            }
            if (workStreak >= 10) workCount++;
            if (absentStreak >= 5) absentCount++;
          });
        }
        lines.push(`[${c}]长期出勤10日以上：${workCount}人`);
        lines.push(`[${c}]长期未出勤5日以上：${absentCount}人`);
      }
      await navigator.clipboard.writeText(lines.join('\n'));
      setTextCopyState('success');
      setTimeout(() => setTextCopyState('idle'), 2000);
    } catch (e) {
      console.error('[通报导出] 失败:', e);
      setTextCopyState('error');
      setTimeout(() => setTextCopyState('idle'), 2000);
    }
  }, [center, rosterData, calendarDataSource, calendarActiveDates]);

  // ════ 切换中心时重置 ════
  useEffect(() => {
    setPage(1);
    setSearch('');
    setDeptFilter('');
    setGroupFilter('');
    setWarningWorkDeptFilter('');
    setWarningWorkGroupFilter('');
    setWarningWorkLeaderFilter('');
    setWarningWorkDaysFilter('');
    setWarningAbsentDeptFilter('');
    setWarningAbsentGroupFilter('');
    setWarningAbsentLeaderFilter('');
    setWarningAbsentDaysFilter('');
    setWarningWorkPage(1);
    setWarningAbsentPage(1);
  }, [center]);

  // ════ 搜索过滤 ════
  const filtered = rows.filter(row => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      String(row.name || '').toLowerCase().includes(s) ||
      String(row.role || '').toLowerCase().includes(s) ||
      String(row.dept2 || '').toLowerCase().includes(s) ||
      String(row.group || '').toLowerCase().includes(s) ||
      String(row.empId || '').toLowerCase().includes(s)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ATTENDANCE_PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * ATTENDANCE_PAGE_SIZE, page * ATTENDANCE_PAGE_SIZE);

  // ════ 渲染 ════
  return (
    <div className="min-h-screen bg-[#f0ebe3] p-5">

      {/* 标题区 */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-0.5 flex-wrap">
          <CalendarDays size={18} className="text-slate-400" />
          <h2 className="text-xl font-black tracking-tight text-slate-900">中心考勤</h2>
          {dailyLoading && (
            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <LoadingSpinner size={11} />加载中
            </span>
          )}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#faf7f2] border border-[#e8e2d9] rounded-lg hover:border-slate-400 transition-colors text-sm font-medium text-slate-700"
            >
              <span>{center || '选择中心'}</span>
              <span className="text-xs text-slate-400 font-normal">
                ({rows.length > 0 ? rows.length + '人' : '—'})
              </span>
              <ChevronDown size={13} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-52 bg-[#faf7f2] border border-[#e8e2d9] rounded-xl shadow-lg z-50 py-1 max-h-64 overflow-y-auto">
                {centersList.length === 0 ? (
                  <div className="px-4 py-2 text-xs text-slate-400">加载中...</div>
                ) : (
                  centersList.map(c => (
                    <button
                      key={c}
                      onClick={() => { setCenter(c); setDropdownOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-[#f0ebe3] transition-colors flex justify-between items-center ${
                        c === center ? 'text-red-600 bg-red-50 font-semibold' : 'text-slate-700'
                      }`}
                    >
                      <span>{c}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 无数据提示 */}
      {rosterLoading ? (
        <div className="bg-[#faf7f2] rounded-xl border border-[#e8e2d9] py-24 text-center">
          <LoadingSpinner size={28} />
          <p className="text-slate-400 text-xs mt-4">正在加载考勤数据…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-[#faf7f2] rounded-xl border border-[#e8e2d9] py-20 text-center">
          <CalendarDays size={48} className="mx-auto mb-4 text-slate-200" />
          <p className="text-slate-500 font-bold">未找到该中心人员数据</p>
          <p className="text-slate-400 text-xs mt-1">请确认花名册中包含「{center}」人员</p>
        </div>
      ) : (
        <>
          {/* ── 摘要卡片 ── */}
          {(() => {
            const today = new Date();
            const t2 = new Date(today);
            t2.setDate(t2.getDate() - 2);
            const t2Str = `${t2.getFullYear()}-${String(t2.getMonth() + 1).padStart(2, '0')}-${String(t2.getDate()).padStart(2, '0')}`;

            const isT2InRange = calendarActiveDates.has(t2Str);
            let presentCount = 0;
            let absentCount = 0;
            if (isT2InRange) {
              rows.forEach(row => {
                const empAtt = calendarDataSource[row.empId] || {};
                if (empAtt[t2Str] === true) presentCount++;
                else absentCount++;
              });
            } else if (Object.keys(dailyData).length > 0) {
              absentCount = rows.length;
            }

            return (
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-[#faf7f2] rounded-xl border border-[#e8e2d9] px-4 py-3.5 flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">在职人数</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-800">{rows.length}</span>
                    <span className="text-[10px] text-slate-400">人</span>
                  </div>
                </div>
                <div className="bg-[#faf7f2] rounded-xl border border-[#e8e2d9] px-4 py-3.5 flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">出勤人数</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-800">{presentCount}</span>
                    <span className="text-[10px] text-slate-400">人</span>
                  </div>
                  <span className="text-[9px] text-slate-300">T-2 · {t2Str}</span>
                </div>
                <div className="bg-[#faf7f2] rounded-xl border border-[#e8e2d9] px-4 py-3.5 flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">缺勤人数</span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-black ${absentCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>{absentCount}</span>
                    <span className="text-[10px] text-slate-400">人</span>
                  </div>
                  <span className="text-[9px] text-slate-300">T-2 · {t2Str}</span>
                </div>
              </div>
            );
          })()}

          {/* ── 出勤预警板块（左右两栏）── */}
          {(() => {
            const longWorkList: Array<{ empId: string; name: string; group: string; dept2: string; days: number; leader: string; attendanceRate: string }> = [];
            const longAbsentList: Array<{ empId: string; name: string; group: string; dept2: string; days: number; leader: string; attendanceRate: string }> = [];

            const sortedDates = calendarActiveDates instanceof Set ? Array.from(calendarActiveDates).sort() : [];
            if (sortedDates.length > 0 && rows.length > 0) {
              const latestDate = sortedDates[sortedDates.length - 1];
              const latestIndex = sortedDates.indexOf(latestDate);

              // 按 group 统计最新日期的出勤率
              const groupAttendanceMap = new Map<string, { present: number; total: number }>();
              rows.forEach(row => {
                const gk = `${row.dept2}|||${row.group}`;
                if (!groupAttendanceMap.has(gk)) groupAttendanceMap.set(gk, { present: 0, total: 0 });
                const ga = groupAttendanceMap.get(gk)!;
                ga.total++;
                const empAtt = calendarDataSource[row.empId] || {};
                if (empAtt[latestDate] === true) ga.present++;
              });

              rows.forEach(row => {
                const empAtt = calendarDataSource[row.empId] || {};
                let workStreak = 0;
                for (let i = latestIndex; i >= 0; i--) {
                  if (empAtt[sortedDates[i]] === true) workStreak++;
                  else break;
                }
                let absentStreak = 0;
                for (let i = latestIndex; i >= 0; i--) {
                  if (empAtt[sortedDates[i]] !== true) absentStreak++;
                  else break;
                }
                const gk = `${row.dept2}|||${row.group}`;
                const ga = groupAttendanceMap.get(gk) || { present: 0, total: 0 };
                const p = Number(ga.present) || 0;
                const t = Number(ga.total) || 0;
                const rateVal = t > 0 ? ((p / t) * 100).toFixed(1) + '%' : '-';
                if (workStreak >= 10) longWorkList.push({ empId: row.empId, name: row.name, group: row.group, dept2: row.dept2, days: workStreak, leader: getGroupLeader(center, row.group), attendanceRate: rateVal });
                if (absentStreak >= 5) longAbsentList.push({ empId: row.empId, name: row.name, group: row.group, dept2: row.dept2, days: absentStreak, leader: getGroupLeader(center, row.group), attendanceRate: rateVal });
              });
            }

            // 出勤预警筛选 - 连续出勤
            const filteredLongWorkList = longWorkList.filter(item =>
              (!warningWorkDeptFilter || item.dept2 === warningWorkDeptFilter) &&
              (!warningWorkGroupFilter || item.group === warningWorkGroupFilter) &&
              (!warningWorkLeaderFilter || item.leader === warningWorkLeaderFilter) &&
              (!warningWorkDaysFilter || String(item.days) === warningWorkDaysFilter)
            );
            // 出勤预警筛选 - 连续未出勤
            const filteredLongAbsentList = longAbsentList.filter(item =>
              (!warningAbsentDeptFilter || item.dept2 === warningAbsentDeptFilter) &&
              (!warningAbsentGroupFilter || item.group === warningAbsentGroupFilter) &&
              (!warningAbsentLeaderFilter || item.leader === warningAbsentLeaderFilter) &&
              (!warningAbsentDaysFilter || String(item.days) === warningAbsentDaysFilter)
            );

            const warningWorkTotalPages = Math.max(1, Math.ceil(filteredLongWorkList.length / WARNING_PAGE_SIZE));
            const warningWorkPageData = filteredLongWorkList.slice((warningWorkPage - 1) * WARNING_PAGE_SIZE, warningWorkPage * WARNING_PAGE_SIZE);
            const warningAbsentTotalPages = Math.max(1, Math.ceil(filteredLongAbsentList.length / WARNING_PAGE_SIZE));
            const warningAbsentPageData = filteredLongAbsentList.slice((warningAbsentPage - 1) * WARNING_PAGE_SIZE, warningAbsentPage * WARNING_PAGE_SIZE);

            // Canvas 截图导出
            const handleExportWarningImage = async (
              type: 'work' | 'absent' = 'work',
              setState: (s: 'idle' | 'loading' | 'success' | 'error') => void
            ): Promise<void> => {
              setState('loading');
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('无法创建 Canvas');
                const dpr = window.devicePixelRatio || 1;
                const width = 900;
                const rowHeight = 36;
                const headerHeight = 40;
                const titleHeight = 60;
                const colWidth = width - 32;
                const col1X = 16;
                const col2X = 16;
                const contentHeight = headerHeight + rowHeight * (type === 'work' ? filteredLongWorkList.length : filteredLongAbsentList.length);
                const height = titleHeight + contentHeight + 40;
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                ctx.scale(dpr, dpr);
                ctx.fillStyle = '#f9fafb';
                ctx.fillRect(0, 0, width, height);
                ctx.fillStyle = '#18181b';
                ctx.font = 'bold 18px sans-serif';
                ctx.fillText(`${center} · ${type === 'work' ? '连续出勤预警' : '连续缺勤预警'}`, 24, 36);
                ctx.fillStyle = '#a1a1aa';
                ctx.font = '11px sans-serif';
                ctx.fillText(`导出时间：${new Date().toLocaleString('zh-CN')}`, 24, 52);
                let currentY = titleHeight;

                if (type === 'work') {
                  // Column 1: 连续出勤
                  ctx.fillStyle = '#18181b';
                  ctx.font = 'bold 13px sans-serif';
                  ctx.fillText(`连续出勤 ≥10 天（${filteredLongWorkList.length} 人）`, col1X + 8, currentY + 20);
                  let col1Y = currentY + headerHeight;
                  ctx.fillStyle = '#f4f4f5';
                  ctx.fillRect(col1X, col1Y, colWidth, rowHeight);
                  ctx.fillStyle = '#71717a';
                  ctx.font = '11px sans-serif';
                  ctx.fillText('工号', col1X + 20, col1Y + 22);
                  ctx.fillText('姓名', col1X + 100, col1Y + 22);
                  ctx.fillText('部门', col1X + 180, col1Y + 22);
                  ctx.fillText('组别', col1X + 280, col1Y + 22);
                  ctx.fillText('出勤率', col1X + 540, col1Y + 22);
                  ctx.fillText('负责人', col1X + 640, col1Y + 22);
                  ctx.fillText('连续天数', col1X + 760, col1Y + 22);
                  col1Y += rowHeight;
                  filteredLongWorkList.forEach((item, i) => {
                    const y = col1Y + i * rowHeight;
                    if (i % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(col1X, y, colWidth, rowHeight); }
                    ctx.fillStyle = '#3f3f46';
                    ctx.font = '12px sans-serif';
                    ctx.fillText(item.empId, col1X + 20, y + 22);
                    ctx.fillText(item.name, col1X + 100, y + 22);
                    ctx.fillText(item.dept2, col1X + 180, y + 22);
                    ctx.fillText(item.group, col1X + 280, y + 22);
                    const rate1 = parseFloat(item.attendanceRate);
                    ctx.fillStyle = rate1 >= 85 ? '#dc2626' : '#16a34a';
                    ctx.font = rate1 >= 85 ? 'bold 12px sans-serif' : '12px sans-serif';
                    ctx.fillText(item.attendanceRate, col1X + 540, y + 22);
                    ctx.fillStyle = '#3f3f46';
                    ctx.fillText(item.leader || '-', col1X + 640, y + 22);
                    ctx.fillStyle = '#dc2626';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillText(`${item.days} 天`, col1X + 760, y + 22);
                  });
                }

                if (type === 'absent') {
                  // Column 2: 连续缺勤
                  ctx.fillStyle = '#18181b';
                  ctx.font = 'bold 13px sans-serif';
                  ctx.fillText(`连续缺勤 ≥5 天（${filteredLongAbsentList.length} 人）`, col2X + 8, currentY + 20);
                  let col2Y = currentY + headerHeight;
                  ctx.fillStyle = '#f4f4f5';
                  ctx.fillRect(col2X, col2Y, colWidth, rowHeight);
                  ctx.fillStyle = '#71717a';
                  ctx.font = '11px sans-serif';
                  ctx.fillText('工号', col2X + 20, col2Y + 22);
                  ctx.fillText('姓名', col2X + 100, col2Y + 22);
                  ctx.fillText('部门', col2X + 180, col2Y + 22);
                  ctx.fillText('组别', col2X + 280, col2Y + 22);
                  ctx.fillText('出勤率', col2X + 540, col2Y + 22);
                  ctx.fillText('负责人', col2X + 640, col2Y + 22);
                  ctx.fillText('连续天数', col2X + 760, col2Y + 22);
                  col2Y += rowHeight;
                  filteredLongAbsentList.forEach((item, i) => {
                    const y = col2Y + i * rowHeight;
                    if (i % 2 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(col2X, y, colWidth, rowHeight); }
                    ctx.fillStyle = '#3f3f46';
                    ctx.font = '12px sans-serif';
                    ctx.fillText(item.empId, col2X + 20, y + 22);
                    ctx.fillText(item.name, col2X + 100, y + 22);
                    ctx.fillText(item.dept2, col2X + 180, y + 22);
                    ctx.fillText(item.group, col2X + 280, y + 22);
                    const rate2 = parseFloat(item.attendanceRate);
                    ctx.fillStyle = rate2 >= 85 ? '#dc2626' : '#16a34a';
                    ctx.font = rate2 >= 85 ? 'bold 12px sans-serif' : '12px sans-serif';
                    ctx.fillText(item.attendanceRate, col2X + 540, y + 22);
                    ctx.fillStyle = '#3f3f46';
                    ctx.fillText(item.leader || '-', col2X + 640, y + 22);
                    ctx.fillStyle = '#dc2626';
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillText(`${item.days} 天`, col2X + 760, y + 22);
                  });
                }
                canvas.toBlob(async (blob) => {
                  if (!blob) { setState('error'); return; }
                  try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    setState('success');
                    setTimeout(() => setState('idle'), 2000);
                  } catch {
                    const url = canvas.toDataURL('image/png');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${type === 'work' ? '连续出勤' : '连续缺勤'}_${center}_${new Date().toISOString().slice(0, 10)}.png`;
                    a.click();
                    setState('success');
                    setTimeout(() => setState('idle'), 2000);
                  }
                }, 'image/png');
              } catch (e) {
                console.error(`[${type === 'work' ? '连续出勤导出' : '连续缺勤导出'}] 失败:`, e);
                setState('error');
                setTimeout(() => setState('idle'), 2000);
              }
            };

            return (
              <div className="mb-5 bg-[#faf7f2] rounded-xl border border-[#e8e2d9] overflow-hidden">
                <div className="px-4 py-3 border-b border-[#e8e2d9] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <span className="text-[11px] font-bold text-slate-700">出勤预警</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleExportText(centersList)}
                        disabled={textCopyState === 'loading'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-lg transition-all border border-[#e8e2d9] hover:scale-[1.02] active:scale-[0.98] ${
                          textCopyState === 'loading' ? 'text-slate-400 cursor-wait'
                          : textCopyState === 'success' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {textCopyState === 'loading' ? '复制中...' : textCopyState === 'success' ? <><CheckCircle2 size={11} className="mr-0.5"/>已复制</> : <><Copy size={11} className="mr-0.5"/>导出通报</>}
                      </button>
                  </div>
                </div>
                <div className="flex gap-0">
                  {/* 左：长出勤 */}
                  <div className="flex-1 px-4 py-3 border-r border-[#e8e2d9] min-w-0 min-h-[400px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-500">
                        连续出勤 ≥10 天
                        <span className="ml-1.5 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-semibold">
                          {filteredLongWorkList.length} 人
                        </span>
                      </span>
                      <button
                        onClick={() => handleExportWarningImage('work', setWorkCopyState)}
                        disabled={workCopyState === 'loading'}
                        className={`flex items-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md transition-all border border-[#e8e2d9] hover:scale-[1.02] active:scale-[0.98] ${
                          workCopyState === 'loading' ? 'text-slate-400 cursor-wait'
                          : workCopyState === 'success' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {workCopyState === 'loading' ? '生成中...' : workCopyState === 'success' ? <><CheckCircle2 size={10} />已复制</> : <><Copy size={10} />导出图片</>}
                      </button>
                    </div>
                    {filteredLongWorkList.length === 0 ? (
                      <div className="text-[10px] text-slate-400 py-4 text-center">暂无数据</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="text-slate-400 border-b border-[#e8e2d9]">
                                <th className="px-2 py-1.5 text-left font-medium w-24">工号</th>
                                <th className="px-2 py-1.5 text-left font-medium w-20">姓名</th>
                                <th className="px-2 py-1.5 text-left font-medium w-24">
                                  <div className="flex items-center gap-0.5">部门
                                    <FilterDropdown label="部门" options={Array.from(new Set(longWorkList.map(r => r.dept2))).sort()} value={warningWorkDeptFilter} onChange={v => { setWarningWorkDeptFilter(v); setWarningWorkGroupFilter(''); setWarningWorkPage(1); }} />
                                  </div>
                                </th>
                                <th className="px-2 py-1.5 text-left font-medium w-28">
                                  <div className="flex items-center gap-0.5">组别
                                    <FilterDropdown label="组别" options={Array.from(new Set(longWorkList.filter(r => !warningWorkDeptFilter || r.dept2 === warningWorkDeptFilter).map(r => r.group))).sort()} value={warningWorkGroupFilter} onChange={v => { setWarningWorkGroupFilter(v); setWarningWorkPage(1); }} />
                                  </div>
                                </th>
                                <th className="px-2 py-1.5 text-right font-medium w-16">出勤率</th>
                                <th className="px-2 py-1.5 text-left font-medium w-24">
                                  <div className="flex items-center gap-0.5">负责人
                                    <FilterDropdown label="负责人" options={Array.from(new Set(longWorkList.map(r => r.leader).filter(Boolean))).sort()} value={warningWorkLeaderFilter} onChange={v => { setWarningWorkLeaderFilter(v); setWarningWorkPage(1); }} />
                                  </div>
                                </th>
                                <th className="px-2 py-1.5 text-right font-medium w-20">
                                  <div className="flex items-center justify-end gap-0.5">
                                    连续天数
                                    <FilterDropdown label="连续天数" options={Array.from(new Set(longWorkList.map(r => String(r.days)))).sort((a, b) => Number(a) - Number(b))} value={warningWorkDaysFilter} onChange={v => { setWarningWorkDaysFilter(v); setWarningWorkPage(1); }} />
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {warningWorkPageData.map((item, i) => (
                                <tr key={item.empId} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-[#f0ebe3]/50' : ''}`}>
                                  <td className="px-2 py-1.5 text-slate-500 font-mono w-24 truncate">{item.empId}</td>
                                  <td className="px-2 py-1.5 text-slate-700 font-medium w-20 truncate">{item.name}</td>
                                  <td className="px-2 py-1.5 text-slate-400 w-24 truncate">{item.dept2}</td>
                                  <td className="px-2 py-1.5 text-slate-500 w-28 truncate">{item.group}</td>
                                  <td className={`px-2 py-1.5 text-right w-16 ${Number(item.attendanceRate) >= 85 ? 'text-red-600 font-bold' : 'text-emerald-600 font-medium'}`}>{item.attendanceRate}</td>
                                  <td className="px-2 py-1.5 text-slate-600 w-24 truncate">{item.leader || '-'}</td>
                                  <td className="px-2 py-1.5 text-right text-red-600 font-bold w-20">{item.days} 天</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {warningWorkTotalPages > 1 && (
                          <div className="flex items-center justify-end gap-1 mt-2">
                            <button onClick={() => setWarningWorkPage(p => Math.max(1, p - 1))} disabled={warningWorkPage === 1} className="p-1 rounded border border-[#e8e2d9] text-slate-400 hover:bg-[#f0ebe3] disabled:opacity-30"><ChevronLeft size={11} /></button>
                            <span className="text-[9px] text-slate-400 px-1">{warningWorkPage}/{warningWorkTotalPages}</span>
                            <button onClick={() => setWarningWorkPage(p => Math.min(warningWorkTotalPages, p + 1))} disabled={warningWorkPage === warningWorkTotalPages} className="p-1 rounded border border-[#e8e2d9] text-slate-400 hover:bg-[#f0ebe3] disabled:opacity-30"><ChevronRight size={11} /></button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {/* 右：长缺勤 */}
                  <div className="flex-1 px-4 py-3 min-w-0 min-h-[400px]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-500">
                        连续缺勤 ≥5 天
                        <span className="ml-1.5 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-semibold">
                          {filteredLongAbsentList.length} 人
                        </span>
                      </span>
                      <button
                        onClick={() => handleExportWarningImage('absent', setAbsentCopyState)}
                        disabled={absentCopyState === 'loading'}
                        className={`flex items-center gap-1 px-2 py-1 text-[9px] font-medium rounded-md transition-all border border-[#e8e2d9] hover:scale-[1.02] active:scale-[0.98] ${
                          absentCopyState === 'loading' ? 'text-slate-400 cursor-wait'
                          : absentCopyState === 'success' ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {absentCopyState === 'loading' ? '生成中...' : absentCopyState === 'success' ? <><CheckCircle2 size={10} />已复制</> : <><Copy size={10} />导出图片</>}
                      </button>
                    </div>
                    {filteredLongAbsentList.length === 0 ? (
                      <div className="text-[10px] text-slate-400 py-4 text-center">暂无数据</div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px]">
                            <thead>
                              <tr className="text-slate-400 border-b border-[#e8e2d9]">
                                <th className="px-2 py-1.5 text-left font-medium w-24">工号</th>
                                <th className="px-2 py-1.5 text-left font-medium w-20">姓名</th>
                                <th className="px-2 py-1.5 text-left font-medium w-24">
                                  <div className="flex items-center gap-0.5">部门
                                    <FilterDropdown label="部门" options={Array.from(new Set(longAbsentList.map(r => r.dept2))).sort()} value={warningAbsentDeptFilter} onChange={v => { setWarningAbsentDeptFilter(v); setWarningAbsentGroupFilter(''); setWarningAbsentPage(1); }} />
                                  </div>
                                </th>
                                <th className="px-2 py-1.5 text-left font-medium w-28">
                                  <div className="flex items-center gap-0.5">组别
                                    <FilterDropdown label="组别" options={Array.from(new Set(longAbsentList.filter(r => !warningAbsentDeptFilter || r.dept2 === warningAbsentDeptFilter).map(r => r.group))).sort()} value={warningAbsentGroupFilter} onChange={v => { setWarningAbsentGroupFilter(v); setWarningAbsentPage(1); }} />
                                  </div>
                                </th>
                                <th className="px-2 py-1.5 text-right font-medium w-16">出勤率</th>
                                <th className="px-2 py-1.5 text-left font-medium w-24">
                                  <div className="flex items-center gap-0.5">负责人
                                    <FilterDropdown label="负责人" options={Array.from(new Set(longAbsentList.map(r => r.leader).filter(Boolean))).sort()} value={warningAbsentLeaderFilter} onChange={v => { setWarningAbsentLeaderFilter(v); setWarningAbsentPage(1); }} />
                                  </div>
                                </th>
                                <th className="px-2 py-1.5 text-right font-medium w-20">
                                  <div className="flex items-center justify-end gap-0.5">
                                    连续天数
                                    <FilterDropdown label="连续天数" options={Array.from(new Set(longAbsentList.map(r => String(r.days)))).sort((a, b) => Number(a) - Number(b))} value={warningAbsentDaysFilter} onChange={v => { setWarningAbsentDaysFilter(v); setWarningAbsentPage(1); }} />
                                  </div>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {warningAbsentPageData.map((item, i) => (
                                <tr key={item.empId} className={`border-b border-slate-50 ${i % 2 === 0 ? 'bg-[#f0ebe3]/50' : ''}`}>
                                  <td className="px-2 py-1.5 text-slate-500 font-mono w-24 truncate">{item.empId}</td>
                                  <td className="px-2 py-1.5 text-slate-700 font-medium w-20 truncate">{item.name}</td>
                                  <td className="px-2 py-1.5 text-slate-400 w-24 truncate">{item.dept2}</td>
                                  <td className="px-2 py-1.5 text-slate-500 w-28 truncate">{item.group}</td>
                                  <td className={`px-2 py-1.5 text-right w-16 ${Number(item.attendanceRate) >= 85 ? 'text-red-600 font-bold' : 'text-emerald-600 font-medium'}`}>{item.attendanceRate}</td>
                                  <td className="px-2 py-1.5 text-slate-600 w-24 truncate">{item.leader || '-'}</td>
                                  <td className="px-2 py-1.5 text-right text-red-600 font-bold w-20">{item.days} 天</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {warningAbsentTotalPages > 1 && (
                          <div className="flex items-center justify-end gap-1 mt-2">
                            <button onClick={() => setWarningAbsentPage(p => Math.max(1, p - 1))} disabled={warningAbsentPage === 1} className="p-1 rounded border border-[#e8e2d9] text-slate-400 hover:bg-[#f0ebe3] disabled:opacity-30"><ChevronLeft size={11} /></button>
                            <span className="text-[9px] text-slate-400 px-1">{warningAbsentPage}/{warningAbsentTotalPages}</span>
                            <button onClick={() => setWarningAbsentPage(p => Math.min(warningAbsentTotalPages, p + 1))} disabled={warningAbsentPage === warningAbsentTotalPages} className="p-1 rounded border border-[#e8e2d9] text-slate-400 hover:bg-[#f0ebe3] disabled:opacity-30"><ChevronRight size={11} /></button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── 主表格区 ── */}
          <div className="bg-[#faf7f2] rounded-xl border border-[#e8e2d9] overflow-hidden">
            {/* 工具栏 */}
            <div className="px-4 py-2.5 border-b border-[#e8e2d9] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="flex border border-[#e8e2d9] rounded-lg overflow-hidden text-[11px] font-medium">
                  <button onClick={() => { setTab('summary'); setPage(1); }} className={`flex items-center gap-1.5 px-3.5 py-1.5 transition-all ${tab === 'summary' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-[#f0ebe3]'}`}><BarChart2 size={11} />汇总统计</button>
                  <button onClick={() => { setTab('calendar'); setPage(1); }} className={`flex items-center gap-1.5 px-3.5 py-1.5 transition-all ${tab === 'calendar' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-[#f0ebe3]'}`}><CalendarDays size={11} />出勤日历</button>
                </div>
                <span className="text-[10px] text-slate-400">共 {rows.length} 人{search && ` · 筛选 ${filtered.length} 人`}</span>
                {/* 月份切换 */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <button onClick={prevMonth} className="p-0.5 hover:bg-slate-100 rounded transition-colors" title="上个月"><ChevronLeft size={14} className="text-slate-400" /></button>
                  <span className="text-xs font-medium text-slate-600 min-w-[72px] text-center">{calendarMonth.getFullYear()}年{calendarMonth.getMonth() + 1}月</span>
                  <button onClick={nextMonth} className="p-0.5 hover:bg-slate-100 rounded transition-colors" title="下个月"><ChevronRight size={14} className="text-slate-400" /></button>
                </div>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text" value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="搜索..."
                  className="pl-8 pr-7 py-1.5 text-[11px] border border-[#e8e2d9] rounded-lg w-44 focus:outline-none focus:border-slate-400 transition-colors bg-[#f0ebe3]/50"
                />
                {search && (
                  <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>
                )}
              </div>
              {(deptFilter || groupFilter) && (
                <span className="text-[10px] text-blue-500 flex items-center gap-1 whitespace-nowrap">
                  <SlidersHorizontal size={10} />
                  {deptFilter && `${deptFilter}`}
                  {deptFilter && groupFilter && ' / '}
                  {groupFilter && `${groupFilter}`}
                  <button onClick={() => { setDeptFilter(''); setGroupFilter(''); setPage(1); }} className="ml-0.5 text-slate-400 hover:text-slate-600"><X size={10} /></button>
                </span>
              )}
            </div>

            {/* 未保存提示条 */}
            {pendingLeaderOverrides !== null && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <span className="text-[11px] text-amber-700 font-medium">有未保存的负责人修改</span>
                <div className="flex gap-2">
                  <button onClick={handleDiscardLeaderChanges} className="text-[11px] text-amber-600 hover:text-amber-800 underline underline-offset-2">丢弃</button>
                  <button onClick={handleSaveClick} className="text-[11px] bg-amber-500 text-white px-3 py-1 rounded hover:bg-amber-600 transition-colors">保存到云端</button>
                </div>
              </div>
            )}

            {/* 汇总统计视图 */}
            {tab === 'summary' && (() => {
              // 按二级部门+组别聚合
              const groupMap = new Map<string, { dept2: string; group: string; total: number; dailyPresent: Map<string, number> }>();
              const allDates = (() => {
                try {
                  return Object.values(calendarDataSource).reduce((dates: Set<string>, empDates) => {
                    if (empDates && typeof empDates === 'object') {
                      Object.keys(empDates).forEach(d => dates.add(d));
                    }
                    return dates;
                  }, new Set<string>());
                } catch { return new Set<string>(); }
              })();
              rows.forEach(row => {
                const key = `${row.dept2}|||${row.group}`;
                if (!groupMap.has(key)) groupMap.set(key, { dept2: row.dept2, group: row.group, total: 0, dailyPresent: new Map() });
                const g = groupMap.get(key)!;
                g.total++;
                allDates.forEach(fullDate => {
                  const empAtt = calendarDataSource[row.empId] || {};
                  if (empAtt[fullDate] === true) {
                    g.dailyPresent.set(fullDate, (g.dailyPresent.get(fullDate) || 0) + 1);
                  }
                });
              });
              const groupRows = Array.from(groupMap.values());
              const filteredGroupRows = groupRows.filter(g =>
                (!deptFilter || g.dept2 === deptFilter) && (!groupFilter || g.group === groupFilter)
              );
              const pTotalPages = Math.max(1, Math.ceil(filteredGroupRows.length / ATTENDANCE_PAGE_SIZE));
              const pPageRows = filteredGroupRows.slice((page - 1) * ATTENDANCE_PAGE_SIZE, page * ATTENDANCE_PAGE_SIZE);

              return (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f0ebe3] border-b border-[#e8e2d9]">
                      <th className="px-2.5 py-2.5 text-left font-bold text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] w-8 text-[9px]">序</th>
                      <th className="px-2.5 py-2.5 text-left font-bold text-slate-500 whitespace-nowrap border-r border-[#e8e2d9] text-[9px]">中心</th>
                      <th className="px-2.5 py-2.5 text-left font-bold text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[9px]">
                        <div className="flex items-center gap-0.5">部门
                          <FilterDropdown label="部门" options={Array.from(new Set(rows.map(r => r.dept2))).sort()} value={deptFilter} onChange={v => { setDeptFilter(v); setGroupFilter(''); setPage(1); }} />
                        </div>
                      </th>
                      <th className="px-2.5 py-2.5 text-left font-bold text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[9px]">
                        <div className="flex items-center gap-0.5">组别
                          <FilterDropdown label="组别" options={Array.from(new Set(rows.filter(r => !deptFilter || r.dept2 === deptFilter).map(r => r.group))).sort()} value={groupFilter} onChange={v => { setGroupFilter(v); setPage(1); }} />
                        </div>
                      </th>
                      <th className="px-2.5 py-2.5 text-left font-bold text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[9px] min-w-[72px]">负责人</th>
                      {Array.from({ length: 31 }, (_, i) => {
                        const d = i + 1;
                        const weekDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d).getDay();
                        const isWeekend = weekDay === 0 || weekDay === 6;
                        return (
                          <th key={d} className={`px-0.5 py-2.5 text-center font-bold whitespace-nowrap border-r border-slate-50 w-11 text-[9px] ${isWeekend ? 'text-blue-400' : 'text-slate-400'}`}>
                            {d}<span className={`block text-[8px] font-normal ${isWeekend ? 'text-blue-300' : 'text-slate-300'}`}>{['日','一','二','三','四','五','六'][weekDay]}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pPageRows.map((g, ri) => (
                      <tr key={ri} className={`border-b border-[#e8e2d9]/60 table-row-hover ${ri % 2 === 1 ? 'bg-[#f0ebe3]/20' : ''}`}>
                        <td className="px-2.5 py-2 text-slate-300 border-r border-[#e8e2d9] text-center text-[9px]">{((page - 1) * ATTENDANCE_PAGE_SIZE) + ri + 1}</td>
                        <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap border-r border-[#e8e2d9] text-[10px]">{center}</td>
                        <td className="px-2.5 py-2 text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[10px]">{g.dept2}</td>
                        <td className="px-2.5 py-2 text-slate-500 whitespace-nowrap border-r border-[#e8e2d9] text-[10px]">{g.group}</td>
                        {/* 负责人 */}
                        <td className="px-2.5 py-2 border-r border-[#e8e2d9] text-[10px] min-w-[72px]"
                          onClick={e => {
                            const gKey = `${center}|||${g.group}`;
                            if (editingGroupKey !== gKey) { e.stopPropagation(); handleStartEdit(center, g.group, getGroupLeader(center, g.group)); }
                          }}
                        >
                          {editingGroupKey === `${center}|||${g.group}` ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus type="text" value={editingLeaderValue}
                                onChange={e => setEditingLeaderValue(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleConfirmEdit(center, g.group); if (e.key === 'Escape') handleCancelEdit(); }}
                                onBlur={() => handleConfirmEdit(center, g.group)}
                                className="w-full px-1 py-0.5 text-[10px] border border-blue-300 rounded focus:outline-none focus:border-blue-500 bg-[#faf7f2]"
                                placeholder="输入姓名"
                              />
                            </div>
                          ) : getGroupLeader(center, g.group) ? (
                            <span className="flex items-center gap-1"><span className="text-slate-700 font-medium truncate max-w-[60px]" title={getGroupLeader(center, g.group)}>{getGroupLeader(center, g.group)}</span>{((pendingLeaderOverrides && pendingLeaderOverrides[`${center}|||${g.group}`]) || groupLeaderOverrides[`${center}|||${g.group}`]) && <span className="text-[8px] text-blue-400 font-normal shrink-0" title="手动编辑">✎</span>}</span>
                          ) : (
                            <span className="text-slate-300 text-[9px] italic cursor-pointer hover:text-slate-400 transition-colors" title="点击设置负责人">— 点击填写 —</span>
                          )}
                        </td>
                        {Array.from({ length: 31 }, (_, i) => {
                          const d = i + 1;
                          const fullDate = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const hasData = allDates.has(fullDate);
                          const present = g.dailyPresent.get(fullDate) || 0;
                          const rateNum = g.total > 0 ? (present / g.total) * 100 : 0;
                          return (
                            <td key={d} className="px-0.5 py-2 text-center border-r border-slate-50 w-11">
                              {hasData ? (
                                <button
                                  onClick={() => {
                                    if (embedded && onAttendanceDetailOpen) {
                                      onAttendanceDetailOpen({ dept2: g.dept2, group: g.group, fullDate, rows: rows.map(r => ({ empId: r.empId, name: r.name, role: r.role, dept2: r.dept2, group: r.group })) });
                                    } else {
                                      setDetailModal({ dept2: g.dept2, group: g.group, fullDate });
                                    }
                                  }}
                                  className={`text-[9px] font-bold cursor-pointer bg-transparent border-none p-0 inline-block transition-transform hover:scale-110 ${rateNum >= 85 ? 'text-red-500' : 'text-slate-600'}`}
                                  title="点击查看人员明细"
                                >
                                  {rateNum.toFixed(0)}%
                                </button>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {pPageRows.length === 0 && (
                      <tr><td colSpan={5 + 31} className="px-6 py-12 text-center text-slate-400 text-sm">暂无数据</td></tr>
                    )}
                  </tbody>
                </table>
              );
            })()}

            {/* 出勤日历视图 */}
            {tab === 'calendar' && (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f0ebe3] border-b border-[#e8e2d9]">
                    <th className="px-2.5 py-2.5 text-left font-bold text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] w-8 text-[9px]">序</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[9px]">组别</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[9px]">工号</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-slate-700 whitespace-nowrap border-r border-[#e8e2d9] text-[9px]">姓名</th>
                    <th className="px-2.5 py-2.5 text-left font-bold text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[9px]">岗位</th>
                    {Array.from({ length: 31 }, (_, i) => {
                      const d = i + 1;
                      const weekDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d).getDay();
                      const isWeekend = weekDay === 0 || weekDay === 6;
                      return (
                        <th key={d} className={`px-0.5 py-2.5 text-center font-bold whitespace-nowrap border-r border-slate-50 w-11 text-[9px] ${isWeekend ? 'text-blue-400' : 'text-slate-400'}`}>
                          {d}<span className={`block text-[8px] font-normal ${isWeekend ? 'text-blue-300' : 'text-slate-300'}`}>{['日','一','二','三','四','五','六'][weekDay]}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, ri) => {
                    const empAtt = calendarDataSource[row.empId] || {};
                    return (
                      <tr key={ri} className={`border-b border-[#e8e2d9]/60 table-row-hover ${ri % 2 === 1 ? 'bg-[#f0ebe3]/20' : ''}`}>
                        <td className="px-2.5 py-1.5 text-slate-300 border-r border-[#e8e2d9] text-center text-[9px]">{row.seq}</td>
                        <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[10px]">{row.group}</td>
                        <td className="px-2.5 py-1.5 text-slate-400 font-mono whitespace-nowrap border-r border-[#e8e2d9] text-[9px]">{row.empId}</td>
                        <td className="px-2.5 py-1.5 font-semibold text-slate-700 whitespace-nowrap border-r border-[#e8e2d9] text-[10px]">{row.name}</td>
                        <td className="px-2.5 py-1.5 text-slate-400 whitespace-nowrap border-r border-[#e8e2d9] text-[10px]">{row.role}</td>
                        {Array.from({ length: 31 }, (_, i) => {
                          const d = i + 1;
                          const fullDate = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const isInRange = calendarActiveDates.has(fullDate);
                          const isPresent = empAtt[fullDate] === true;
                          const displayVal = isInRange ? (isPresent ? '✓' : '休') : '';
                          return (
                            <td key={d} className={`w-11 px-0.5 py-1.5 text-center border-r border-slate-50 ${isInRange ? (isPresent ? 'text-emerald-600 font-semibold text-[10px]' : 'text-blue-400 font-semibold text-[10px]') : ''}`} title={isInRange ? `${row.name} · ${d}日: ${displayVal}` : ''}>{displayVal}</td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {pageRows.length === 0 && (
                    <tr><td colSpan={5 + 31} className="px-6 py-12 text-center text-slate-400 text-sm">{search ? '未找到匹配记录' : '暂无数据'}</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="px-4 py-2.5 border-t border-[#e8e2d9] flex items-center justify-between">
                <span className="text-[10px] text-slate-400">第 {page} / {totalPages} 页 · 每页 {ATTENDANCE_PAGE_SIZE} 条</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded border border-[#e8e2d9] text-slate-400 hover:bg-[#f0ebe3] hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronLeft size={13} /></button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let p = i + 1;
                    if (totalPages > 5) {
                      const half = 2;
                      let start = Math.max(1, page - half);
                      const end = Math.min(totalPages, start + 4);
                      start = Math.max(1, end - 4);
                      p = start + i;
                    }
                    return (
                      <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 text-[10px] font-medium rounded transition-all ${p === page ? 'bg-slate-900 text-white' : 'border border-[#e8e2d9] text-slate-400 hover:bg-[#f0ebe3] hover:text-slate-600'}`}>{p}</button>
                    );
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded border border-[#e8e2d9] text-slate-400 hover:bg-[#f0ebe3] hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"><ChevronRight size={13} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 明细弹窗 */}
      {!embedded && detailModal && (
        <AttendanceSummaryDetailModal
          open={true}
          onClose={() => setDetailModal(null)}
          centerName={center}
          dept2={detailModal.dept2}
          group={detailModal.group}
          fullDate={detailModal.fullDate}
          rows={rows}
          attendanceData={Object.keys(dailyData).length > 0 ? dailyData : undefined}
        />
      )}

    </div>
  );
}
