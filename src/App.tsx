/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, Zap, ArrowRight, BarChart3, Upload, Settings, CalendarDays } from 'lucide-react';
// ── 【新增】中心考勤模块（独立组件，与原有代码解耦）──────────
import AttendanceModule from './components/AttendanceModule';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingOverlay from './components/LoadingOverlay';
import KPICard from './components/KPICard';
import DataTable from './components/DataTable';
import SummaryChart from './components/SummaryChart';
import DataManagerEnhanced from './components/DataManagerEnhanced';
import ReportModal from './components/ReportModal';
import MetricHelpPanel from './components/MetricHelpPanel';
import { PERFORMANCE_DATA } from './constants';
import { cn } from './lib/utils';
import { buildFixedHuazhongData } from './lib/dataProcessor';
import { DataType } from './lib/types.js';
import { initDatabase, saveRawData, getLatestRawData, getSalaryRawData, getAttendance15RawData, getAttendance7RawData, getRosterRawData, idbGetRawData } from './lib/database.js';
import { loadDefaultData } from './lib/defaultDataLoader';
import { useAdminMode } from './hooks/useAdminMode';

export type Selection = {
  type: 'all' | 'region' | 'center';
  id: string | null;
  label?: string;
};

export default function App() {
  // ── 全局加载状态 ──
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('正在初始化...');
  const [loadingProgress, setLoadingProgress] = useState<number | undefined>(undefined);

  const [viewMode, setViewMode] = useState<'dashboard' | 'data' | 'attendance'>('dashboard');
  const [selection, setSelection] = useState<Selection>({ type: 'all', id: null });
  const [customData, setCustomData] = useState<any[] | null>(null);
  const [rawDataState, setRawDataState] = useState<any[] | null>(null);
  const [salaryDataState, setSalaryDataState] = useState<any[] | null>(null);
  // attendance15DataState：连续15日出勤数据（按 工号+数据日期 去重）
  const [attendance15DataState, setAttendance15DataState] = useState<any[] | null>(null);
  const [attendance7DataState, setAttendance7DataState] = useState<any[] | null>(null);
  const [rosterDataState, setRosterDataState] = useState<any[] | null>(null);
  const [dataFileName, setDataFileName] = useState<string>('');
  
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('gpt_loggedin') === '1');
  const [loggedInUser, setLoggedInUser] = useState<{ name: string; empId: string } | null>(() => {
    const raw = localStorage.getItem('gpt_user');
    if (raw) try { return JSON.parse(raw); } catch (e) { /* ignore */ }
    return null;
  });
  const [isAdminLogin, setIsAdminLogin] = useState(() => localStorage.getItem('gpt_admin') === '1');
  const handleLoginSuccess = (name: string, empId: string, isAdmin: boolean) => {
    localStorage.setItem('gpt_loggedin', '1');
    localStorage.setItem('gpt_user', JSON.stringify({ name, empId }));
    if (isAdmin) {
      localStorage.setItem('gpt_admin', '1');
      setIsAdminLogin(true);
    }
    setLoggedInUser({ name, empId });
    setIsLoggedIn(true);
  };
  const handleLogout = () => {
    localStorage.removeItem('gpt_loggedin');
    localStorage.removeItem('gpt_user');
    localStorage.removeItem('gpt_admin');
    setLoggedInUser(null);
    setIsLoggedIn(false);
    setIsAdminLogin(false);
  };
  const [reportOpen, setReportOpen] = useState(false);
  
  // 管理员模式
  const { adminMode, toggleAdmin, exemptCenters, toggleExempt, isExempt } = useAdminMode();
  
  // 获取北京时间（不受浏览器时区影响）
  const now = new Date();
  const beijingTimestamp = now.getTime() + 8 * 60 * 60 * 1000;
  const beijingDate = new Date(beijingTimestamp);
  const year = beijingDate.getUTCFullYear();
  const month = String(beijingDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(beijingDate.getUTCDate()).padStart(2, '0');
  const formattedDate = `${year}-${month}-${day}`;

  // 获取 T-2 日期（前天，北京时间）—— 可靠算法
  const t2Ms = beijingTimestamp - 2 * 24 * 60 * 60 * 1000;
  const t2Date = new Date(t2Ms);
  const t2Year = t2Date.getUTCFullYear();
  const t2Month = String(t2Date.getUTCMonth() + 1).padStart(2, '0');
  const t2Day = String(t2Date.getUTCDate()).padStart(2, '0');
  const formattedT2Date = `${t2Year}年${t2Month}月${t2Day}日`;

  // 页面初始化时从数据库加载最新数据
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        setLoadingMessage('正在初始化数据库...');
        setLoadingProgress(10);
        await initDatabase();
        setLoadingProgress(20);
        
        // ── 首次加载默认数据 ──
        setLoadingMessage('正在加载数据文件...');
        setLoadingProgress(30);
        const loaded = await loadDefaultData((loaded, total, file) => {
          setLoadingMessage(`正在加载 (${loaded}/${total})...`);
          setLoadingProgress(30 + Math.round((loaded / total) * 30)); // 30→60
        });
        if (loaded) {
          console.log('[初始化] 已从 public/database/ 加载默认数据');
        }
        
        setLoadingProgress(65);
        
        // 加载薪资异常数据
        const salaryStored = await getSalaryRawData();
        if (salaryStored && salaryStored.rawData && salaryStored.rawData.length > 0) {
          setSalaryDataState(salaryStored.rawData);
        }
        
        // 加载连续15日出勤数据
        const att15Stored = await getAttendance15RawData();
        if (att15Stored && att15Stored.rawData && att15Stored.rawData.length > 0) {
          setAttendance15DataState(att15Stored.rawData);
        }
        
        // 加载连续7日未出勤数据
        const att7Stored = await getAttendance7RawData();
        if (att7Stored && att7Stored.rawData && att7Stored.rawData.length > 0) {
          setAttendance7DataState(att7Stored.rawData);
        }
        
        // 加载花名册数据
        const rosterStored = await getRosterRawData();
        if (rosterStored && rosterStored.rawData && rosterStored.rawData.length > 0) {
          setRosterDataState(rosterStored.rawData);
        }
        
        // 优先：用原始数据重新计算（确保 T-2/T-3 基于今天日期）
        const rawStored = await getLatestRawData();
        if (rawStored && rawStored.rawData && rawStored.rawData.length > 0) {
          setRawDataState(rawStored.rawData);
          const rebuilt = buildFixedHuazhongData(rawStored.rawData, rawStored.dataType, '');
          if (rebuilt && rebuilt.length > 0) {
            setCustomData(rebuilt);
            setDataFileName('从存储加载');
            setDataDate(new Date().toISOString().split('T')[0]);
            setLoadingProgress(90);
            return;
          }
        }
        
        // ── IndexedDB 空数据检测 + 自动修复 ──
        // 如果所有数据读取都为空，说明 IndexedDB 被清空但 localStorage 缓存还在
        // 清除缓存标记，强制重新加载所有文件
        const allEmpty = !salaryStored?.rawData?.length
          && !att15Stored?.rawData?.length
          && !att7Stored?.rawData?.length
          && !rosterStored?.rawData?.length
          && !rawStored?.rawData?.length;
        
        if (allEmpty) {
          console.warn('[初始化] 检测到 IndexedDB 数据为空，清除缓存标记并重新加载...');
          setLoadingMessage('正在修复数据缓存...');
          localStorage.removeItem('gpt_loaded_files');
          
          // 重新加载所有数据文件
          const reloaded = await loadDefaultData((loaded, total, file) => {
            setLoadingMessage(`正在重新加载 (${loaded}/${total})...`);
            setLoadingProgress(30 + Math.round((loaded / total) * 30));
          });
          
          if (reloaded) {
            // 重新读取数据
            const salaryStored2 = await getSalaryRawData();
            if (salaryStored2?.rawData?.length) setSalaryDataState(salaryStored2.rawData);
            
            const att15Stored2 = await getAttendance15RawData();
            if (att15Stored2?.rawData?.length) setAttendance15DataState(att15Stored2.rawData);
            
            const att7Stored2 = await getAttendance7RawData();
            if (att7Stored2?.rawData?.length) setAttendance7DataState(att7Stored2.rawData);
            
            const rosterStored2 = await getRosterRawData();
            if (rosterStored2?.rawData?.length) setRosterDataState(rosterStored2.rawData);
            
            const rawStored2 = await getLatestRawData();
            if (rawStored2?.rawData?.length) {
              setRawDataState(rawStored2.rawData);
              const rebuilt = buildFixedHuazhongData(rawStored2.rawData, rawStored2.dataType, '');
              if (rebuilt?.length) {
                setCustomData(rebuilt);
                setDataFileName('从存储加载');
                setDataDate(new Date().toISOString().split('T')[0]);
              }
            }
            
            console.log('[初始化] 数据修复完成');
          }
        }
      } catch (error) {
        console.error('❌ 加载存储数据失败:', error);
      } finally {
        // 加载完成，隐藏加载动画
        setLoadingProgress(100);
        setTimeout(() => {
          setIsLoading(false);
        }, 300); // 短暂延迟让进度条显示100%后再消失
      }
    };
    
    loadStoredData();
  }, []);

  const handleSelect = (newSelection: Selection) => {
    if (selection.id === newSelection.id && selection.type === newSelection.type) {
      setSelection({ type: 'all', id: null });
    } else {
      setSelection(newSelection);
    }
  };

  const handleDataLoaded = async (data: any[], fileName: string, newDataType: DataType, date: string) => {
    // 薪资数据和出勤数据不需要经过 buildFixedHuazhongData 处理
    // 它们有自己的独立存储和展示逻辑
    if (newDataType === 'salary_performance') {
      // 合并 + 去重：按 姓名+岗位+数据日期 去重
      // 【修复】从 IndexedDB 重新读取，而非从内存 salaryDataState 读取
      // 避免：删除 IndexedDB 后内存未清空，导致上传时旧数据被重新写回
      const storedSalary = await idbGetRawData('salary_performance');
      const existing = storedSalary?.rawData || [];
      const seen = new Set(
        existing.map(row => {
          const d = row['数据日期'] || row.日期 || row.date || '';
          return `${row.姓名}_${row.岗位}_${d}`;
        })
      );
      const newRows = data.filter(row => {
        const d = row['数据日期'] || row.日期 || row.date || '';
        const key = `${row.姓名}_${row.岗位}_${d}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const merged = [...existing, ...newRows];
      setSalaryDataState(merged);
      await saveRawData(merged, newDataType as string);
    } else if (newDataType === 'attendance_15days') {
      // 合并 + 去重：按 工号+数据日期 去重
      // 【修复】从 IndexedDB 重新读取，避免内存旧数据污染
      const storedAtt15 = await idbGetRawData('attendance_15days');
      const existing = storedAtt15?.rawData || [];
      const seen = new Set(
        existing.map(row => {
          const d = row['数据日期'] || row.日期 || row.date || '';
          return `${row.工号}_${d}`;
        })
      );
      const newRows = data.filter(row => {
        const d = row['数据日期'] || row.日期 || row.date || '';
        const key = `${row.工号}_${d}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const merged = [...existing, ...newRows];
      setAttendance15DataState(merged);
      await saveRawData(merged, newDataType as string);
    } else if (newDataType === 'attendance_7days') {
      // 合并 + 去重：按 工号+数据日期 去重
      // 【修复】从 IndexedDB 重新读取，避免内存旧数据污染
      const storedAtt7 = await idbGetRawData('attendance_7days');
      const existing = storedAtt7?.rawData || [];
      const seen = new Set(
        existing.map(row => {
          const d = row['数据日期'] || row.日期 || row.date || '';
          return `${row.工号}_${d}`;
        })
      );
      const newRows = data.filter(row => {
        const d = row['数据日期'] || row.日期 || row.date || '';
        const key = `${row.工号}_${d}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const merged = [...existing, ...newRows];
      setAttendance7DataState(merged);
      await saveRawData(merged, newDataType as string);
    } else if (newDataType === 'employee_roster') {
      // 花名册数据：动态获取工号列名，然后按工号去重
      // 【修复】从 IndexedDB 重新读取，避免内存旧数据污染
      const storedRoster = await idbGetRawData('employee_roster');
      const existing = storedRoster?.rawData || [];
      // 动态推断工号列名
      const sampleKeys = data.length > 0 ? Object.keys(data[0]) : [];
      const idCol = sampleKeys.find(k => /工号|员工ID|员工\s*ID|编号|员工编号|id/i.test(k)) || '工号';
      const seen = new Set(existing.map(row => String(row[idCol] || row.工号 || '').trim()).filter(Boolean));
      const newRows = data.filter(row => {
        const key = String(row[idCol] || row.工号 || '').trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const merged = [...existing, ...newRows];
      setRosterDataState(merged);
      await saveRawData(merged, newDataType as string);
    } else if (newDataType === 'center_daily_attendance') {
      // 中心日出勤明细：有记录 = 出勤，没记录 = 缺勤
      // 合并去重（按 工号+数据日期 去重），支持多天累积
      const storedDaily = await idbGetRawData('center_daily_attendance');
      const existing = storedDaily?.rawData || [];
      
      // 动态推断列名（宽松匹配）
      const sampleKeys = data.length > 0 ? Object.keys(data[0]) : [];
      const idCol = sampleKeys.find(k => /工号|员工ID|员工\s*ID|编号|员工编号|人员编号|代号|id|ID/i.test(k));
      const dateCol = sampleKeys.find(k => /日期|数据日期|出勤日期|打卡日期/i.test(k));
      
      if (!idCol || !dateCol) {
        console.error('[中心日出勤明细上传] 无法推断关键列名，请检查文件格式');
        return;
      }
      
      const seen = new Set(existing.map(row => {
        const d = String(row[dateCol] || '').trim();
        const id = String(row[idCol] || '').trim();
        return `${id}_${d}`;
      }).filter(Boolean));
      const newRows = data.filter(row => {
        const d = String(row[dateCol] || '').trim();
        const id = String(row[idCol] || '').trim();
        const key = `${id}_${d}`;
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const merged = [...existing, ...newRows];
      await saveRawData(merged, newDataType as string);
      
      // 中心日出勤明细数据已保存到 IndexedDB，无需额外处理
    } else if (newDataType === 'job_performance') {
      // 岗位效能异常：合并去重（按 岗位名称+数据日期+中心 去重），支持多天累积
      const existingStored = await idbGetRawData('job_performance');
      const existing = existingStored?.rawData || [];
      
      // 去重 key：岗位名称 + 数据日期 + 中心（同一岗位同一天同一中心不重复）
      const existingKeys = new Set(existing.map((r: any) => 
        `${r['岗位名称'] || r.jobName || ''}|${r['数据日期'] || r.date || r.日期 || ''}|${r['中心'] || r.center || r['中心名称'] || ''}`
      ));
      const newRows = data.filter((r: any) => {
        const key = `${r['岗位名称'] || r.jobName || ''}|${r['数据日期'] || r.date || r.日期 || ''}|${r['中心'] || r.center || r['中心名称'] || ''}`;
        return !existingKeys.has(key);
      });

      const merged = [...existing, ...newRows];

      const transformedData = buildFixedHuazhongData(merged, newDataType, date);
      setCustomData(transformedData);
      setRawDataState(merged);
      await saveRawData(merged, newDataType as string);
    } else {
      const transformedData = buildFixedHuazhongData(data, newDataType, date);
      setCustomData(transformedData);
      setRawDataState(data);  // ← 设置 rawDataState，让 DataTable 可以点开详情
      
      try {
        await saveRawData(data, newDataType as string);
      } catch (e) {
        console.error('[handleDataLoaded] saveRawData 失败:', e);
        alert('原始数据保存到 IndexedDB 失败，刷新后可能无法查看详情');
      }
    }
    setDataFileName(fileName);
    setViewMode('dashboard');
  };

  // 使用自定义数据或默认数据
  const displayData = customData && customData.length > 0 ? customData : PERFORMANCE_DATA;
  
  // 将薪资异常数据（salaryDataState）和连续出勤数据关联到 displayData 的 subCenters 上
  // 同时计算出勤人数和覆盖率
  const enrichedData = useMemo(() => {
    const hasJob = rawDataState && rawDataState.length > 0;
    const hasSalary = salaryDataState && salaryDataState.length > 0;
    const hasAtt15 = attendance15DataState && attendance15DataState.length > 0;
    const hasAtt7 = attendance7DataState && attendance7DataState.length > 0;
    const hasRoster = rosterDataState && rosterDataState.length > 0;
    if (!hasJob && !hasSalary && !hasAtt15 && !hasAtt7 && !hasRoster) {
      return displayData;
    }

    // T-2 日期（前天）
    const t2Date = new Date();
    t2Date.setDate(t2Date.getDate() - 2);
    const t2DateStr = `${t2Date.getFullYear()}-${String(t2Date.getMonth() + 1).padStart(2, '0')}-${String(t2Date.getDate()).padStart(2, '0')}`;

    // T-3 日期
    const t3Date = new Date();
    t3Date.setDate(t3Date.getDate() - 3);
    const t3DateStr = `${t3Date.getFullYear()}-${String(t3Date.getMonth() + 1).padStart(2, '0')}-${String(t3Date.getDate()).padStart(2, '0')}`;

    // 统一日期格式归一化：处理 Excel 序列号、YYYY-M-D、YYYY/MM/DD 等各种格式 → YYYY-MM-DD
    function normalizeDate(rawDate: any): string {
      if (!rawDate) return '';
      if (typeof rawDate === 'number') {
        const utcMs = (rawDate - 25569) * 86400000;
        const d = new Date(utcMs);
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      }
      if (typeof rawDate === 'string') {
        // 先统一分隔符为 -
        let s = rawDate.replace(/\//g, '-').trim();
        // 匹配 YYYY-M-D 或 YYYY-MM-DD
        const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (m) {
          return `${m[1]}-${String(parseInt(m[2])).padStart(2, '0')}-${String(parseInt(m[3])).padStart(2, '0')}`;
        }
        return s;
      }
      return '';
    }

    // 建立 中心名 -> 省区名 映射（基于固定数据结构，用于反查无省区列的数据）
    const centerToProvince = new Map<string, string>();
    displayData.forEach(province => {
      province.subCenters.forEach(center => {
        if (center.name) centerToProvince.set(center.name, province.province);
      });
    });

    // 预处理岗位效能异常数据：按 中心+省区+日期 聚合异常岗位数
    const jobByCenterDate = new Map<string, number>();
    if (rawDataState && rawDataState.length > 0) {
      rawDataState.forEach(row => {
        const province = row.省区 || row.省区名称 || '';
        const center = row.中心 || row.中心名称 || '';
        const dateStr = normalizeDate(row['数据日期'] || row.date || row.日期);
        if (!dateStr) return;
        const key = `${center}_${province}_${dateStr}`;
        jobByCenterDate.set(key, (jobByCenterDate.get(key) || 0) + 1);
      });
    }

    // 预处理薪资数据：按 中心+省区+日期 聚合异常人数
    const salaryByCenterDate = new Map<string, number>();
    if (salaryDataState && salaryDataState.length > 0) {
      salaryDataState.forEach(row => {
        const center = row.中心 || row.中心名称 || '';
        const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
        const dateStr = normalizeDate(row['数据日期'] || row.date || row.日期);
        const key = `${center}_${province}_${dateStr}`;
        salaryByCenterDate.set(key, (salaryByCenterDate.get(key) || 0) + 1);
      });
    }

    // 预处理出勤数据：已废弃，分母改用花名册中心操作人数
    const attendanceByCenterDate = new Map<string, number>();

    // 预处理连续15日出勤数据：按 中心+省区+日期 聚合连续出勤 ≥ 15 天的人数 及 >30 天的人数
    const attendance15ByCenterDate = new Map<string, number>();
    const att15Over30ByCenterDate = new Map<string, number>();
    if (attendance15DataState && attendance15DataState.length > 0) {
      attendance15DataState.forEach(row => {
        const days = parseInt(row.连续出勤天数 || 0) || 0;
        if (days < 15) return; // 只统计 ≥ 15 天的
        const center = row.中心 || row.中心名称 || '';
        const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
        const dateStr = normalizeDate(row['数据日期'] || row.date || row.日期);
        const key = `${center}_${province}_${dateStr}`;
        attendance15ByCenterDate.set(key, (attendance15ByCenterDate.get(key) || 0) + 1);
        if (days > 30) {
          att15Over30ByCenterDate.set(key, (att15Over30ByCenterDate.get(key) || 0) + 1);
        }
      });
    }

    // 预处理连续7日未出勤数据：按 中心+省区+日期 聚合人数
    const attendance7ByCenterDate = new Map<string, number>();
    if (attendance7DataState && attendance7DataState.length > 0) {
      attendance7DataState.forEach(row => {
        const days = parseInt(row.连续未出勤天数 || 0) || 0;
        if (days < 7) return; // 只统计 ≥ 7 天的
        const center = row.中心 || row.中心名称 || '';
        const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
        const dateStr = normalizeDate(row['数据日期'] || row.date || row.日期);
        const key = `${center}_${province}_${dateStr}`;
        attendance7ByCenterDate.set(key, (attendance7ByCenterDate.get(key) || 0) + 1);
      });
    }

    // 模糊查找：中心名/省区名可能带额外后缀（如"区"、"中心"），用互相包含匹配
    function findCount(map: Map<string, number>, centerName: string, provinceName: string, dateStr: string): number {
      const directKey = `${centerName}_${provinceName}_${dateStr}`;
      if (map.has(directKey)) return map.get(directKey) || 0;
      for (const [key, count] of map.entries()) {
        const parts = key.split('_');
        if (parts.length < 3) continue;
        const kCenter = parts[0];
        const kProvince = parts[1];
        const kDate = parts[2];
        if (kDate !== dateStr) continue;
        const centerMatch = kCenter.includes(centerName) || centerName.includes(kCenter);
        const normKProv = kProvince.replace(/区$/, '');
        const normProv = provinceName.replace(/区$/, '');
        const provinceMatch = kProvince.includes(provinceName) || provinceName.includes(kProvince) || normKProv === normProv;
        if (centerMatch && provinceMatch) return count;
      }
      return 0;
    }
    // 预处理花名册数据：按 中心+省区 聚合中心操作部门的人员统计
    interface RosterStats {
      total: number;
      leaders: number;   // 操作组长
      managers: number;  // 操作主管
    }
    const rosterByCenter = new Map<string, RosterStats>();
    if (rosterDataState && rosterDataState.length > 0) {
      // 动态获取列名（处理隐藏字符）
      const firstRow = rosterDataState.find((r: any) => r && typeof r === 'object' && Object.keys(r).length > 0);
      if (!firstRow) {
        console.warn('[花名册加载] 找不到有效数据行');
      } else {
        const cols = Object.keys(firstRow as any);
        const deptCol = cols.find(c => c.includes('二级部门')) || '二级部门';
        const centerCol = cols.find(c => c.includes('七级单位')) || cols.find(c => c.includes('六级单位')) || '六级单位';
        const provinceCol = cols.find(c => c.includes('五级单位')) || '五级单位';
        const jobCol = cols.find(c => c.includes('岗位名称')) || '岗位名称';

        let matchedCount = 0;
        let skippedCount = 0;
        let wuchangSkipped: string[] = [];
        rosterDataState.forEach((row: any, idx: number) => {
          if (!row || typeof row !== 'object') return;
          const dept = row[deptCol] || '';
          const deptStr = String(dept).trim();
          const center = String(row[centerCol] || '').trim();
          if (!deptStr.includes('中心操作')) {
            skippedCount++;
            if (center.includes('武')) {
              wuchangSkipped.push(`[${idx}] center="${center}", dept="${deptStr}"`);
            }
            return;
          }
          const province = row[provinceCol] || '';
          const job = row[jobCol] || '';
          const key = `${center}_${province}`;
          const stats = rosterByCenter.get(key) || { total: 0, leaders: 0, managers: 0 };
          stats.total++;
          if (job === '操作组长') stats.leaders++;
          if (job === '操作主管') stats.managers++;
          rosterByCenter.set(key, stats);
          matchedCount++;
        });
      }
    }

    // 中心名称别名映射（不同数据源对同一中心的叫法不一致时在此补充）
    const CENTER_ALIASES: Record<string, string[]> = {
      '武昌': ['武吕'],
      '武吕': ['武昌'],
    };

    // 将名称展开为 [原名, ...别名] 用于匹配
    function expandName(name: string): string[] {
      return [name, ...(CENTER_ALIASES[name] || [])];
    }

    // 模糊查找花名册数据
    function normalizeCenter(name: string) {
      return (name || '').replace(/中心$/, '').replace(/省区$/, '').replace(/区$/, '').trim();
    }
    function findRosterStats(centerName: string, provinceName: string): RosterStats | null {
      const directKey = `${centerName}_${provinceName}`;
      
      if (rosterByCenter.has(directKey)) {
        return rosterByCenter.get(directKey) || null;
      }

      // 尝试模糊匹配（含别名）
      const normCenterName = normalizeCenter(centerName);
      const normProvinceName = normalizeCenter(provinceName);
      
      // 展开查询名的别名
      const centerVariants = expandName(centerName);
      
      for (const [key, stats] of rosterByCenter.entries()) {
        const parts = key.split('_');
        if (parts.length < 2) continue;
        const kCenter = parts[0];
        const kProvince = parts[1];
        const normKCenter = normalizeCenter(kCenter);
        const normKProvince = normalizeCenter(kProvince);
        
        // 展开花名册 key 的别名
        const kCenterVariants = expandName(kCenter);

        // 中心匹配：原名/别名互相包含 或 normalize后相等
        // 优先级1：子串包含（如 "武汉区域" 包含 "武汉"）
        const includeMatch =
          kCenterVariants.some(v => centerName.includes(v) || v.includes(centerName)) ||
          centerVariants.some(v => kCenter.includes(v) || v.includes(kCenter));
        // 优先级2：normalize后相等（去掉后缀再比）
        const normMatch = normKCenter === normCenterName;
        const centerMatch = includeMatch || normMatch;
        const provinceMatch = kProvince.includes(provinceName) || provinceName.includes(kProvince) || normKProvince === normProvinceName;
        if (centerMatch && provinceMatch) {
          return stats;
        }
      }
      
      return null;
    }

    return displayData.map(province => {
      const enrichedProvince = { ...province };
      enrichedProvince.dimensions = { ...province.dimensions };
      
      enrichedProvince.subCenters = (province.subCenters || []).map((center: any) => {
        const enrichedCenter = { ...center };
        // 清空默认 metrics，避免旧演示数据残留；有真实数据时会重新设置
        enrichedCenter.metrics = {};

        // === 岗位效能异常计算 ===
        const t2JobCount = findCount(jobByCenterDate, center.name, province.province, t2DateStr);
        const t3JobCount = findCount(jobByCenterDate, center.name, province.province, t3DateStr);
        // 得分：每触发 1 个岗位扣 5 分，最低 0 分
        const jobScore = Math.max(0, 25 - t2JobCount * 5);
        if (t2JobCount > 0 || t3JobCount > 0) {
          enrichedCenter.metrics.job = jobScore;
          enrichedCenter.abnormalCount = t2JobCount;
          enrichedCenter.prevAbnormalCount = t3JobCount;
          enrichedCenter.t2JobCount = t2JobCount;
        }

        // T-2 / T-3 薪资异常人数（模糊匹配）
        const t2SalaryCount = findCount(salaryByCenterDate, center.name, province.province, t2DateStr);
        const t3SalaryCount = findCount(salaryByCenterDate, center.name, province.province, t3DateStr);

        // T-2 算薪人数：改用花名册中心操作人数（使用 findRosterStats 模糊匹配）
        const salaryRosterStats = findRosterStats(center.name, province.province);
        const t2SalaryBase = salaryRosterStats ? salaryRosterStats.total : 0;

        // 覆盖率 & 得分
        const coverageRate = t2SalaryBase > 0 
          ? ((t2SalaryCount / t2SalaryBase) * 100).toFixed(1) + '%'
          : '0%';
        const rateNum = t2SalaryBase > 0 ? (t2SalaryCount / t2SalaryBase) * 100 : 0;
        const salaryScore = rateNum <= 3 ? 25 : Math.max(0, 25 - Math.round((rateNum - 3) * 5));

        if (t2SalaryCount > 0 || t3SalaryCount > 0) {
          enrichedCenter.metrics.salary = salaryScore;
          enrichedCenter.prevSalaryCount = t3SalaryCount;
          enrichedCenter.salaryCount = t2SalaryBase;
          enrichedCenter.salaryCoverage = coverageRate;
          enrichedCenter.t2SalaryCount = t2SalaryCount; // 用于省区聚合判断
        }

        // === 连续15日出勤计算 ===
        const t2Att15Count = findCount(attendance15ByCenterDate, center.name, province.province, t2DateStr);
        const t3Att15Count = findCount(attendance15ByCenterDate, center.name, province.province, t3DateStr);
        // 触发率 = 长期出勤人数 / 花名册中心操作人数
        const att15Rate = t2SalaryBase > 0
          ? ((t2Att15Count / t2SalaryBase) * 100).toFixed(1) + '%'
          : '0%';
        const att15RateNum = t2SalaryBase > 0 ? (t2Att15Count / t2SalaryBase) * 100 : 0;
        // 新增 = 环比昨天（T-2  vs T-3）
        const att15New = t2Att15Count - t3Att15Count;
        // 超长人数（连续出勤 > 30 天）
        const t2Over30 = findCount(att15Over30ByCenterDate, center.name, province.province, t2DateStr);
        // 得分：触发率 ≤ 3% 不扣分；> 3% 每多 1% 扣 5 分；当月 >30 天每 1 人扣 2 分
        const coverageDeduction = att15RateNum <= 3 ? 0 : Math.round((att15RateNum - 3) * 5);
        const over30Deduction = t2Over30 * 2;
        const att15Score = Math.max(0, 25 - coverageDeduction - over30Deduction);

        if (t2Att15Count > 0 || t3Att15Count > 0) {
          enrichedCenter.metrics.att15 = att15Score;
          enrichedCenter.att15Count = t2Att15Count;
          enrichedCenter.att15Rate = att15Rate;
          enrichedCenter.att15New = att15New;
          enrichedCenter.t2Att15Count = t2Att15Count;
          enrichedCenter.att15Over30 = t2Over30;
        }

        // === 连续7日未出勤计算 ===
        const t2Att7Count = findCount(attendance7ByCenterDate, center.name, province.province, t2DateStr);
        const t3Att7Count = findCount(attendance7ByCenterDate, center.name, province.province, t3DateStr);
        // 新增 = 环比昨天（T-2 vs T-3）
        const att7New = t2Att7Count - t3Att7Count;
        // 得分：每出现 1 人扣 2 分，累计计分，最低 0 分
        const att7Score = Math.max(0, 25 - t2Att7Count * 2);

        if (t2Att7Count > 0 || t3Att7Count > 0) {
          enrichedCenter.metrics.att7 = att7Score;
          enrichedCenter.att7Count = t2Att7Count;
          enrichedCenter.att7New = att7New;
          enrichedCenter.t2Att7Count = t2Att7Count;
        }

        // === 管幅计算（基于花名册）===
        const rosterStats = findRosterStats(center.name, province.province);
        if (rosterStats) {
          const mgrTotal = rosterStats.leaders + rosterStats.managers;
          const workers = rosterStats.total - mgrTotal;
          enrichedCenter.rosterTotal = rosterStats.total;
          enrichedCenter.rosterLeaders = rosterStats.leaders;
          enrichedCenter.rosterManagers = rosterStats.managers;
          enrichedCenter.compositeScope = mgrTotal > 0 ? parseFloat((workers / mgrTotal).toFixed(1)) : 0;
          enrichedCenter.leaderScope = rosterStats.leaders > 0 ? parseFloat((workers / rosterStats.leaders).toFixed(1)) : 0;
          // 超目标人数：综合 = 操作人数/25 - (组长+主管)；组长 = 操作人数/35 - 组长
          enrichedCenter.compOverTarget = parseFloat((workers / 25 - mgrTotal).toFixed(1));
          enrichedCenter.leadOverTarget = parseFloat((workers / 35 - rosterStats.leaders).toFixed(1));
        }

        // === 重新计算中心绩效得分 = 四项之和 ===
        const jobScoreFinal = enrichedCenter.metrics?.job ?? center.metrics?.job ?? 0;
        const salaryScoreFinal = enrichedCenter.metrics?.salary ?? center.metrics?.salary ?? 0;
        const att15ScoreFinal = enrichedCenter.metrics?.att15 ?? center.metrics?.att15 ?? 0;
        const att7ScoreFinal = enrichedCenter.metrics?.att7 ?? center.metrics?.att7 ?? 0;
        enrichedCenter.score = jobScoreFinal + salaryScoreFinal + att15ScoreFinal + att7ScoreFinal;

        return enrichedCenter;
      });

      // 省区维度：薪资
      const hasRealSalaryData = enrichedProvince.subCenters.some((c: any) => (c.t2SalaryCount || 0) > 0 || (c.prevSalaryCount || 0) > 0);
      if (enrichedProvince.subCenters.length > 0 && hasRealSalaryData) {
        const totalSalaryScore = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.salary || 0), 0);
        const avgSalaryScore = Math.round(totalSalaryScore / enrichedProvince.subCenters.length);
        const totalSalaryBase = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.salaryCount || 0), 0);
        const totalT2Count = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.t2SalaryCount || 0), 0);
        const provinceCoverage = totalSalaryBase > 0 ? ((totalT2Count / totalSalaryBase) * 100).toFixed(1) + '%' : '0%';
        
        enrichedProvince.dimensions.salary = {
          name: '绩效异常',
          score: avgSalaryScore,
          weight: 25,
          metrics: [
            { label: '覆盖率', value: provinceCoverage },
            { label: '算薪', value: totalSalaryBase },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.salary;
      }

      // 省区维度：连续出勤
      const hasRealAtt15Data = enrichedProvince.subCenters.some((c: any) => (c.t2Att15Count || 0) > 0);
      if (enrichedProvince.subCenters.length > 0 && hasRealAtt15Data) {
        const totalAtt15Score = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.att15 || 0), 0);
        const avgAtt15Score = Math.round(totalAtt15Score / enrichedProvince.subCenters.length);
        const totalAtt15Count = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.att15Count || 0), 0);
        // 省区触发率分母 = 各中心花名册中心操作人数之和（使用模糊匹配）
        const totalRosterOps = enrichedProvince.subCenters.reduce((s: number, c: any) => {
          const rStats = findRosterStats(c.name, province.province);
          return s + (rStats ? rStats.total : 0);
        }, 0);
        const provinceAtt15Rate = totalRosterOps > 0 ? ((totalAtt15Count / totalRosterOps) * 100).toFixed(1) + '%' : '0%';
        const totalAtt15New = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.att15New || 0), 0);

        enrichedProvince.dimensions.attendance15 = {
          name: '连续出勤',
          score: avgAtt15Score,
          weight: 25,
          metrics: [
            { label: '触发率', value: provinceAtt15Rate },
            { label: '新增', value: totalAtt15New },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.attendance15;
      }

      // 省区维度：连续7日未出勤
      const hasRealAtt7Data = enrichedProvince.subCenters.some((c: any) => (c.t2Att7Count || 0) > 0);
      if (enrichedProvince.subCenters.length > 0 && hasRealAtt7Data) {
        const totalAtt7Score = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.att7 || 0), 0);
        const avgAtt7Score = Math.round(totalAtt7Score / enrichedProvince.subCenters.length);
        const totalAtt7Count = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.att7Count || 0), 0);
        const totalAtt7New = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.att7New || 0), 0);

        enrichedProvince.dimensions.attendance7 = {
          name: '长期未出勤',
          score: avgAtt7Score,
          weight: 25,
          metrics: [
            { label: '异常', value: totalAtt7Count },
            { label: '新增', value: totalAtt7New },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.attendance7;
      }

      // 省区维度：效能异常
      const hasRealJobData = enrichedProvince.subCenters.some((c: any) => (c.t2JobCount || 0) > 0);
      if (enrichedProvince.subCenters.length > 0 && hasRealJobData) {
        const totalJobScore = enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.metrics?.job || 0), 0);
        const avgJobScore = Math.round(totalJobScore / enrichedProvince.subCenters.length);
        const totalAbnormalCount = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.abnormalCount || 0), 0);
        const totalPrevAbnormalCount = enrichedProvince.subCenters.reduce((s: number, c: any) => s + (c.prevAbnormalCount || 0), 0);

        enrichedProvince.dimensions.job = {
          name: '效能异常',
          score: avgJobScore,
          weight: 25,
          metrics: [
            { label: '异常岗位', value: totalAbnormalCount },
            { label: '新增', value: totalAbnormalCount - totalPrevAbnormalCount },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.job;
      }

      // 省区维度：管幅（基于花名册）
      const hasRosterData = enrichedProvince.subCenters.some((c: any) => c.rosterTotal !== undefined);
      if (enrichedProvince.subCenters.length > 0 && hasRosterData) {
        const centersWithRoster = enrichedProvince.subCenters.filter((c: any) => c.rosterTotal !== undefined);
        const avgComposite = centersWithRoster.length > 0
          ? (centersWithRoster.reduce((s: number, c: any) => s + (c.compositeScope || 0), 0) / centersWithRoster.length).toFixed(2)
          : '0';
        const avgLeader = centersWithRoster.length > 0
          ? (centersWithRoster.reduce((s: number, c: any) => s + (c.leaderScope || 0), 0) / centersWithRoster.length).toFixed(2)
          : '0';
        const totalWorkers = centersWithRoster.reduce((s: number, c: any) => s + ((c.rosterTotal || 0) - (c.rosterLeaders || 0) - (c.rosterManagers || 0)), 0);
        const totalLeaders = centersWithRoster.reduce((s: number, c: any) => s + (c.rosterLeaders || 0), 0);
        const totalManagers = centersWithRoster.reduce((s: number, c: any) => s + (c.rosterManagers || 0), 0);

        enrichedProvince.dimensions.scope = {
          name: '中心管幅',
          score: 0,
          weight: 0,
          metrics: [
            { label: '综合管幅', value: avgComposite },
            { label: '组长管幅', value: avgLeader },
            { label: '操作人数', value: totalWorkers },
            { label: '组长', value: totalLeaders },
            { label: '主管', value: totalManagers },
          ]
        };
      } else {
        delete enrichedProvince.dimensions.scope;
      }

      // 重新计算省区总分（只基于各中心当前实际存在的维度得分）
      const newTotalScore = enrichedProvince.subCenters.length > 0
        ? Math.round(enrichedProvince.subCenters.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / enrichedProvince.subCenters.length)
        : 0;
      enrichedProvince.totalScore = newTotalScore;
      enrichedProvince.performanceScore = newTotalScore;

      return enrichedProvince;
    });
  }, [displayData, rawDataState, salaryDataState, attendance15DataState, attendance7DataState, rosterDataState]);
  
  // 应用豁免过滤：豁免中心不计入省区和大区得分
  const filteredData = useMemo(() => {
    if (exemptCenters.size === 0) return enrichedData;
    return enrichedData.map(province => {
      // 找出参与考核的子中心
      const activeCenters = (province.subCenters || []).filter(
        (c: any) => !exemptCenters.has(c.id)
      );
      // 重新计算省区总分（仅参与考核的中心平均数，取整数）
      const newTotal = activeCenters.length > 0
        ? Math.round(activeCenters.reduce((sum: number, c: any) => sum + (c.score || 0), 0) / activeCenters.length)
        : 0;
      return {
        ...province,
        totalScore: newTotal,
        performanceScore: newTotal,
      };
    });
  }, [enrichedData, exemptCenters]);

  const avgTotalScore = Math.round(filteredData.reduce((acc, curr) => acc + curr.totalScore, 0) / filteredData.length);
  const totalUnits = filteredData.length;

  return (
    <>
      {/* 全局加载动画 */}
      <LoadingOverlay
        isLoading={isLoading}
        message={loadingMessage}
        progress={loadingProgress}
      />
      
      {!isLoggedIn ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex relative border-8 border-white overflow-hidden" id="bold-dashboard">
      {/* Vertical Intelligence Sidebar */}
      <nav className="w-16 h-full border-r border-zinc-200 flex flex-col items-center justify-center bg-white">
        <div className="flex items-center gap-4 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold">报告：刘洋 {formattedDate}</span>
        </div>
        
        {/* 数据管理切换按钮 */}
        <div className="mt-auto mb-8 flex flex-col gap-4">
          {/* 管理员模式按钮 */}
          <button
            onClick={toggleAdmin}
            className={cn(
              "p-3 rounded-lg transition-all flex items-center justify-center",
              adminMode
                ? "bg-amber-500 text-white shadow-lg scale-110 ring-2 ring-amber-300"
                : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
            )}
            title={adminMode ? "退出管理员模式" : "管理员模式（设置考核豁免）"}
          >
            <Settings size={18} />
          </button>
          <button
            onClick={() => setViewMode('dashboard')}
            className={`p-3 rounded-lg transition-all flex items-center justify-center ${
              viewMode === 'dashboard' 
                ? 'bg-red-600 text-white shadow-lg scale-110' 
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
            title="数据看板"
          >
            <BarChart3 size={18} />
          </button>
          {/* 【新增】中心考勤导航按钮 */}
          <button
            onClick={() => setViewMode('attendance')}
            className={`p-3 rounded-lg transition-all flex items-center justify-center ${
              viewMode === 'attendance'
                ? 'bg-red-600 text-white shadow-lg scale-110'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
            title="中心考勤"
          >
            <CalendarDays size={18} />
          </button>
          {isAdminLogin && (
            <button
              onClick={() => setViewMode('data')}
              className={`relative p-3 rounded-lg transition-all flex items-center justify-center ${
                viewMode === 'data'
                  ? 'bg-red-600 text-white shadow-lg scale-110'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
              title="数据上传与管理"
            >
              <Upload size={20} strokeWidth={2.5} />
              {/* 提示红点 */}
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            </button>
          )}
        </div>
      </nav>

      {/* Main Stream Area */}
      <div className="flex-1 flex flex-col overflow-auto h-screen">
        
        {/* Radical Header */}
        <header className="h-24 min-h-[96px] border-b border-zinc-200 flex items-center justify-between px-12 bg-white sticky top-0 z-50">
          <div className="flex flex-col">
            <h1 className="text-5xl font-black tracking-tighter leading-none">GPT 数据通报</h1>
            <p className="text-[10px] uppercase tracking-[0.4em] font-semibold text-zinc-400 mt-1">中区绩效指标与数据复盘</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs font-mono bg-black text-white px-3 py-1">数据日期：{formattedT2Date}</span>
            <div className="flex items-center gap-2 mt-2 text-red-500">
              <ShieldAlert size={14} className="animate-pulse" />
              <span className="text-[10px] font-black border-b-2 border-red-500 uppercase">高风险动态反馈</span>
            </div>
            {/* 登录用户信息 + 退出 */}
            {loggedInUser && (
              <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                <span className="font-bold text-zinc-700">
                  {loggedInUser.name}
                  {isAdminLogin && <span className="ml-1 text-amber-600">（管理员）</span>}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-zinc-400 hover:text-red-500 transition-colors underline underline-offset-2"
                  title="退出登录"
                >
                  退出
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 grid grid-cols-12 auto-rows-min overflow-visible">
          {/* 主内容区：根据 viewMode 显示不同视图 */}
      {viewMode === 'data' ? (
        <div className="col-span-12">
          <DataManagerEnhanced onDataLoaded={handleDataLoaded} />
        </div>
      ) : viewMode === 'attendance' ? (
        /* 中心考勤视图（独立渲染，无明细弹窗） */
        <div className="col-span-12">
          <ErrorBoundary label="中心考勤模块">
            <AttendanceModule />
          </ErrorBoundary>
        </div>
      ) : (
        /* 数据看板视图 */
        <>
          {/* Main Visual & Registry */}
          <div className="col-span-12 xl:col-span-9 border-r border-zinc-200 bg-white">
            <div className="p-12 border-b border-zinc-200 bg-zinc-50/50">
              <div className="flex justify-between items-end mb-8">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-400 block">加权平均得分统计</label>
                  <span className="text-6xl font-black leading-none tracking-tighter">{avgTotalScore} 分</span>
                </div>
                <div className="max-w-2xl text-right">
                  <p className="text-lg font-bold leading-tight">
                    {(() => {
                      // 分析表现差的省区和维度
                      const sortedByScore = [...filteredData].sort((a, b) => a.totalScore - b.totalScore);
                      const worstProv = sortedByScore.slice(0, 2);
                      
                      if (customData && customData.length > 0) {
                        const worst = worstProv[0];
                        const second = worstProv[1];
                        if (!worst) return `已加载自定义数据：${dataFileName}，共 ${displayData.length} 个区域`;
                        
                        // 找出最差的维度
                        const dims = worst.dimensions || {};
                        const dimScores = Object.entries(dims)
                          .filter(([key, d]: [string, any]) => d && typeof d.score === 'number' && d.weight > 0)
                          .sort((a, b) => a[1].score - b[1].score);
                        const worstDim = dimScores[0];
                        
                        let summary = '';
                        if (second && second.totalScore < 60) {
                          summary += `${second.province}（${second.totalScore}分）、`;
                        }
                        summary += `${worst.province}（${worst.totalScore}分）`;
                        if (worstDim) {
                          summary += `，需重点关注${worstDim[1].name}指标`;
                        }
                        summary += '。';
                        return summary;
                      }
                      
                      return `东区各维度得分已进入核心监控期。${displayData[0]?.province} 和 ${displayData[3]?.province} 的出勤指标触发系统预警。`;
                    })()}
                  </p>
                </div>
              </div>
            </div>

            {/* Registry Monitor Table */}
            <div className="p-0">
              <div className="p-8 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-black uppercase tracking-tighter italic border-b-4 border-black inline-block leading-none">区域注册监控器</h2>
                  <MetricHelpPanel />
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                  <span>过滤器：{selection.type === 'all' ? '所有节点' : selection.label}</span>
                  {customData && customData.length > 0 && (
                    <span className="text-red-500 font-bold">• 自定义数据</span>
                  )}
                </div>
              </div>
              {/* 管理员模式提示横幅 */}
              {adminMode && (
                <div className="mx-8 mb-4 px-4 py-2 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-3">
                  <Settings size={14} className="text-amber-600 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                  <span className="text-[11px] font-black text-amber-700 uppercase tracking-wide">
                    管理员模式已激活 — 点击中心旁的按钮切换考核状态。
                    {exemptCenters.size > 0 && ` 当前豁免 ${exemptCenters.size} 个中心。`}
                  </span>
                  <button
                    onClick={toggleAdmin}
                    className="ml-auto text-[10px] font-black text-amber-600 hover:text-amber-800 underline whitespace-nowrap"
                  >
                    退出
                  </button>
                </div>
              )}
              <DataTable 
                data={filteredData} 
                onSelect={handleSelect} 
                currentSelection={selection}
                adminMode={adminMode}
                exemptCenters={exemptCenters}
                onToggleExempt={toggleExempt}
                rawData={rawDataState || undefined}
                salaryData={salaryDataState || undefined}
                attendance15Data={attendance15DataState || undefined}
                attendance7Data={attendance7DataState || undefined}
                rosterData={rosterDataState || undefined}
              />
            </div>
          </div>

          {/* Tactical Sidebar */}
          <div className="col-span-12 xl:col-span-3 flex flex-col bg-white border-l border-zinc-200">
            <div className="p-8 border-b border-zinc-200">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-400 block mb-6 text-center">多维核心指标分析</span>
              <div className="w-full aspect-square">
                <SummaryChart selection={selection} data={filteredData} />
              </div>
              {selection.type !== 'all' && (
                <div className="mt-4 flex justify-center">
                  <button 
                    onClick={() => setSelection({ type: 'all', id: null })}
                    className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-black transition-colors flex items-center gap-1"
                  >
                    重置为全局概览 [CLEAR]
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2">
              <KPICard 
                label="活跃节点" 
                value={totalUnits} 
                description={customData && customData.length > 0 ? "自定义数据" : "总上报点位"} 
                className="border-b border-r"
              />
              <KPICard 
                label="数据源" 
                value={customData && customData.length > 0 ? "上传" : "默认"} 
                trend={customData && customData.length > 0 ? 100 : 0}
                description={customData && customData.length > 0 ? dataFileName : "系统预设"} 
                className="border-b"
              />
            </div>

            <div className="p-8 flex-1 flex flex-col gap-6">
              <div className="mt-auto">
                <div className="bg-black text-white p-6 shadow-[6px_6px_0px_0px_rgba(239,68,68,0.3)]">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={14} className="text-red-500 fill-red-500" />
                    <h5 className="text-[10px] font-bold uppercase tracking-[0.2em]">关键行动指令</h5>
                  </div>
                  <p className="text-[11px] font-bold leading-relaxed mb-4 opacity-80">
                    {(() => {
                      // 分析表现差的中心
                      const allCenters: any[] = [];
                      filteredData.forEach(prov => {
                        (prov.subCenters || []).forEach((c: any) => {
                          if (!exemptCenters.has(c.id)) {
                            allCenters.push({ 
                              province: prov.province, 
                              center: c.name, 
                              score: c.score || 0,
                              jobCount: c.abnormalCount || 0,
                              salaryCount: c.t2SalaryCount || 0,
                              att7Count: c.t2Att7Count || 0,
                            });
                          }
                        });
                      });
                      
                      if (customData && customData.length > 0 && allCenters.length > 0) {
                        const worstCenters = allCenters.sort((a, b) => a.score - b.score).slice(0, 2);
                        let actions: string[] = [];
                        
                        worstCenters.forEach(c => {
                          if (c.jobCount > 0) actions.push(`提升${c.center}效能`);
                          if (c.salaryCount > 0) actions.push(`改善${c.center}薪资异常`);
                          if (c.att7Count > 0) actions.push(`解决${c.center}长期未出勤`);
                        });
                        
                        if (actions.length > 0) {
                          return `优先处理：${actions.slice(0, 3).join('、')}。`;
                        }
                        return `${worstCenters[0].province}·${worstCenters[0].center}（${worstCenters[0].score}分）排名末尾，建议查看详情报告。`;
                      }
                      
                      return '监测到上海及安徽省区出勤指标持续偏低，已触发人力资源风险预警。';
                    })()}
                  </p>
                  <button 
                    onClick={() => setReportOpen(true)}
                    className="w-full py-2.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                  >
                    生成详情报告 <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>

        <footer className="h-20 min-h-[80px] border-t border-zinc-200 bg-zinc-100 flex items-center px-12 justify-between z-10">
          <div className="flex gap-8 items-center text-[10px] font-bold uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span>实时流：活跃</span>
            </div>
            <div className="h-4 w-px bg-zinc-300"></div>
            <span className="opacity-40">内部机密：4级加密</span>
          </div>
          <div className="flex gap-2">
            <div className="w-1 h-1 bg-zinc-900"></div>
            <div className="w-1 h-1 bg-zinc-900"></div>
            <div className="w-1 h-1 bg-zinc-900"></div>
            <div className="w-8 h-1 bg-zinc-900 ml-4"></div>
          </div>
        </footer>
      </div>
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        params={{
          filteredData,
          rawData: rawDataState || undefined,
          salaryData: salaryDataState || undefined,
          attendance15Data: attendance15DataState || undefined,
          attendance7Data: attendance7DataState || undefined,
        }}
      />
    </div>
  )}
  </>
);
}
