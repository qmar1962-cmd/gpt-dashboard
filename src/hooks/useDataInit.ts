/**
 * 数据初始化 + 状态管理 Hook
 * - 页面打开时从 IndexedDB 加载所有数据
 * - 提供 handleDataLoaded 供数据上传组件调用
 */
import { useState, useEffect, useCallback } from 'react';
import { PERFORMANCE_DATA } from '../constants';
import { buildFixedHuazhongData } from '../lib/dataProcessor';
import { DataType } from '../lib/types.js';
import {
  initDatabase,
  saveRawData,
  getLatestRawData,
  getSalaryRawData,
  getAttendance15RawData,
  getAttendance7RawData,
  getRosterRawData,
  getWorkHoursHighRawData,
  getWorkHoursLowRawData,
  idbGetRawData,
} from '../lib/database';
import { loadDefaultData, hasExistingData } from '../lib/defaultDataLoader';
import { mergeAndDedupe } from '../lib/dataMerge';
import { filterRowsByDate } from '../lib/dateUtils';
import { ensureDataVersion } from '../lib/idb';

interface LoadingState {
  isLoading: boolean;
  message: string;
  progress: number | undefined;
}

export function useDataInit() {
  // ── 加载状态 ──
  const [loading, setLoading] = useState<LoadingState>({
    isLoading: true,
    message: '正在初始化...',
    progress: undefined,
  });
  const [initError, setInitError] = useState<string | null>(null);

  // ── 数据状态 ──
  const [customData, setCustomData] = useState<any[] | null>(null);
  const [rawDataState, setRawDataState] = useState<any[] | null>(null);
  const [salaryDataState, setSalaryDataState] = useState<any[] | null>(null);
  const [attendance15DataState, setAttendance15DataState] = useState<any[] | null>(null);
  const [attendance7DataState, setAttendance7DataState] = useState<any[] | null>(null);
  const [rosterDataState, setRosterDataState] = useState<any[] | null>(null);
  const [workHoursHighDataState, setWorkHoursHighDataState] = useState<any[] | null>(null);
  const [workHoursLowDataState, setWorkHoursLowDataState] = useState<any[] | null>(null);
  const [dataFileName, setDataFileName] = useState<string>('');
  const [dataDate, setDataDate] = useState<string>('');

  // ── 页面初始化加载 ──
  useEffect(() => {
    const loadStoredData = async () => {
      try {
        setLoading({ isLoading: true, message: '正在初始化数据库...', progress: 10 });
        const cleared = await ensureDataVersion();
        if (cleared) setLoading({ isLoading: true, message: '检测到数据结构更新，正在清除旧缓存...', progress: 5 });
        await initDatabase();

        // 检测 IndexedDB 是否为空，是则清缓存强制全量加载
        const hasData = await hasExistingData();
        if (!hasData) {
          console.log('[初始化] IndexedDB 为空，清除缓存强制全量加载');
          localStorage.removeItem('gpt_filelist_cache');
        }

        setLoading({ isLoading: true, message: '正在加载数据文件...', progress: 30 });
        const loaded = await loadDefaultData((loaded, total) => {
          setLoading({ isLoading: true, message: `正在加载 (${loaded}/${total})...`, progress: 30 + Math.round((loaded / total) * 30) });
        });
        if (loaded) console.log('[初始化] 已从 public/database/ 加载默认数据');

        setLoading({ isLoading: true, message: '正在读取存储...', progress: 65 });

        const salaryStored = await getSalaryRawData();
        if (salaryStored?.rawData?.length) setSalaryDataState(filterRowsByDate(salaryStored.rawData));

        const att15Stored = await getAttendance15RawData();
        if (att15Stored?.rawData?.length) setAttendance15DataState(filterRowsByDate(att15Stored.rawData));

        const att7Stored = await getAttendance7RawData();
        if (att7Stored?.rawData?.length) setAttendance7DataState(filterRowsByDate(att7Stored.rawData));

        const rosterStored = await getRosterRawData();
        if (rosterStored?.rawData?.length) setRosterDataState(rosterStored.rawData);

        const whHighStored = await getWorkHoursHighRawData();
        if (whHighStored?.rawData?.length) setWorkHoursHighDataState(filterRowsByDate(whHighStored.rawData));

        const whLowStored = await getWorkHoursLowRawData();
        if (whLowStored?.rawData?.length) setWorkHoursLowDataState(filterRowsByDate(whLowStored.rawData));

        const rawStored = await getLatestRawData();
        if (rawStored?.rawData?.length) {
          setRawDataState(filterRowsByDate(rawStored.rawData));
          const rebuilt = buildFixedHuazhongData(rawStored.rawData, rawStored.dataType, '');
          if (rebuilt?.length) {
            setCustomData(rebuilt);
            setDataFileName('从存储加载');
            setDataDate(new Date().toISOString().split('T')[0]);
          }
        }

        // IndexedDB 空数据检测 + 自动修复
        const allEmpty = !salaryStored?.rawData?.length
          && !att15Stored?.rawData?.length
          && !att7Stored?.rawData?.length
          && !rosterStored?.rawData?.length
          && !rawStored?.rawData?.length;

        if (allEmpty) {
          console.warn('[初始化] 检测到 IndexedDB 数据为空，清除所有缓存重新加载...');
          localStorage.removeItem('gpt_loaded_files');
          localStorage.removeItem('gpt_filelist_cache');

          await loadDefaultData((loaded, total) => {
            setLoading({ isLoading: true, message: `正在重新加载 (${loaded}/${total})...`, progress: 30 + Math.round((loaded / total) * 30) });
          });

          const [s2, a152, a72, r2, h2, l2, raw2] = await Promise.all([
            getSalaryRawData(), getAttendance15RawData(), getAttendance7RawData(),
            getRosterRawData(), getWorkHoursHighRawData(), getWorkHoursLowRawData(),
            getLatestRawData(),
          ]);

          if (s2?.rawData?.length) setSalaryDataState(filterRowsByDate(s2.rawData));
          if (a152?.rawData?.length) setAttendance15DataState(filterRowsByDate(a152.rawData));
          if (a72?.rawData?.length) setAttendance7DataState(filterRowsByDate(a72.rawData));
          if (r2?.rawData?.length) setRosterDataState(r2.rawData);
          if (h2?.rawData?.length) setWorkHoursHighDataState(filterRowsByDate(h2.rawData));
          if (l2?.rawData?.length) setWorkHoursLowDataState(filterRowsByDate(l2.rawData));
          if (raw2?.rawData?.length) {
            setRawDataState(filterRowsByDate(raw2.rawData));
            const rebuilt = buildFixedHuazhongData(raw2.rawData, raw2.dataType, '');
            if (rebuilt?.length) {
              setCustomData(rebuilt);
              setDataFileName('从存储加载');
              setDataDate(new Date().toISOString().split('T')[0]);
            }
          }
          console.log('[初始化] 数据修复完成');
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[初始化] 加载存储数据失败:', msg, error);
        setInitError(`数据加载失败(${msg.slice(0, 60)})，请Ctrl+F5刷新重试`);
      } finally {
        setLoading({ isLoading: true, message: '完成', progress: 100 });
        setTimeout(() => {
          setLoading(prev => ({ ...prev, isLoading: false }));
        }, 300);
      }
    };

    loadStoredData();
  }, []);

  // ── 数据上传处理 ──
  const handleDataLoaded = useCallback(async (data: any[], fileName: string, newDataType: DataType, date: string) => {
    if (newDataType === 'salary_performance') {
      const stored = await idbGetRawData('salary_performance');
      const merged = mergeAndDedupe(stored?.rawData || [], data, row => {
        const d = row['数据日期'] || row.日期 || row.date || '';
        return `${row.姓名}_${row.岗位}_${d}`;
      });
      setSalaryDataState(merged);
      await saveRawData(merged, newDataType);
    } else if (newDataType === 'attendance_15days') {
      const stored = await idbGetRawData('attendance_15days');
      const merged = mergeAndDedupe(stored?.rawData || [], data, row => {
        const d = row['数据日期'] || row.日期 || row.date || '';
        return `${row.工号}_${d}`;
      });
      setAttendance15DataState(merged);
      await saveRawData(merged, newDataType);
    } else if (newDataType === 'attendance_7days') {
      const stored = await idbGetRawData('attendance_7days');
      const merged = mergeAndDedupe(stored?.rawData || [], data, row => {
        const d = row['数据日期'] || row.日期 || row.date || '';
        return `${row.工号}_${d}`;
      });
      setAttendance7DataState(merged);
      await saveRawData(merged, newDataType);
    } else if (newDataType === 'employee_roster') {
      const stored = await idbGetRawData('employee_roster');
      const sampleKeys = data.length > 0 ? Object.keys(data[0]) : [];
      const idCol = sampleKeys.find(k => /工号|员工ID|员工\s*ID|编号|员工编号|id/i.test(k)) || '工号';
      const merged = mergeAndDedupe(stored?.rawData || [], data, row => String(row[idCol] || row.工号 || '').trim());
      setRosterDataState(merged);
      await saveRawData(merged, newDataType);
    } else if (newDataType === 'center_daily_attendance') {
      const stored = await idbGetRawData('center_daily_attendance');
      const sampleKeys = data.length > 0 ? Object.keys(data[0]) : [];
      const idCol = sampleKeys.find(k => /工号|员工ID|员工\s*ID|编号|员工编号|人员编号|代号|id|ID/i.test(k));
      const dateCol = sampleKeys.find(k => /日期|数据日期|出勤日期|打卡日期/i.test(k));
      if (!idCol || !dateCol) {
        console.error('[中心日出勤明细上传] 无法推断关键列名');
        return;
      }
      const merged = mergeAndDedupe(stored?.rawData || [], data, row => {
        const d = String(row[dateCol] || '').trim();
        const id = String(row[idCol] || '').trim();
        return `${id}_${d}`;
      });
      await saveRawData(merged, newDataType);
    } else if (newDataType === 'job_performance') {
      const stored = await idbGetRawData('job_performance');
      const existing = stored?.rawData || [];
      const existingKeys = new Set(existing.map((r: any) =>
        `${r['岗位名称'] || r.jobName || ''}|${r['数据日期'] || r.date || r.日期 || ''}|${r['中心'] || r.center || r['中心名称'] || ''}`
      ));
      const newRows = data.filter((r: any) => {
        const key = `${r['岗位名称'] || r.jobName || ''}|${r['数据日期'] || r.date || r.日期 || ''}|${r['中心'] || r.center || r['中心名称'] || ''}`;
        return !existingKeys.has(key);
      });
      const merged = [...existing, ...newRows];
      const transformed = buildFixedHuazhongData(merged, newDataType, date);
      setCustomData(transformed);
      setRawDataState(merged);
      await saveRawData(merged, newDataType);
    } else if (newDataType === 'work_hours_high') {
      const stored = await idbGetRawData('work_hours_high');
      const merged = mergeAndDedupe(stored?.rawData || [], data, row => {
        const d = row['数据日期'] || row.日期 || row.date || '';
        return `${row.工号}_${d}`;
      });
      setWorkHoursHighDataState(merged);
      await saveRawData(merged, newDataType);
    } else if (newDataType === 'work_hours_low') {
      const stored = await idbGetRawData('work_hours_low');
      const merged = mergeAndDedupe(stored?.rawData || [], data, row => {
        const d = row['数据日期'] || row.日期 || row.date || '';
        return `${row.工号}_${d}`;
      });
      setWorkHoursLowDataState(merged);
      await saveRawData(merged, newDataType);
    } else {
      const transformed = buildFixedHuazhongData(data, newDataType, date);
      setCustomData(transformed);
      setRawDataState(data);
      try {
        await saveRawData(data, newDataType);
      } catch (e) {
        console.error('[handleDataLoaded] saveRawData 失败:', e);
        alert('原始数据保存到 IndexedDB 失败，刷新后可能无法查看详情');
      }
    }
    setDataFileName(fileName);
    // 注意：不在此处切换 viewMode，由 App.tsx 的包装函数负责
  }, []);

  return {
    loading,
    customData,
    rawDataState,
    salaryDataState,
    attendance15DataState,
    attendance7DataState,
    rosterDataState,
    workHoursHighDataState,
    workHoursLowDataState,
    dataFileName,
    dataDate,
    handleDataLoaded,
    initError,
  };
}
