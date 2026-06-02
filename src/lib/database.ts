/**
 * 数据库存储服务
 * - 核心业务数据（每日汇总）: localStorage
 * - 原始大体积数据（薪资/出勤/效能）: IndexedDB（容量几百MB~数GB）
 */

import { DataType, CenterData, DailyData, TrendQuery } from '../types/data';
import {
  idbSaveRawData,
  idbGetRawData,
  idbGetRawDataStats,
  idbClearRawDataByType,
  idbClearAllRawData,
  idbGetStorageEstimate,
  migrateFromLocalStorage as idbMigrate,
  idbGetRawData,
} from './idb';

// 存储键名前缀（仅用于轻量元数据）
const STORAGE_PREFIX = 'gpt_dashboard_';
const DAILY_DATA_KEY = `${STORAGE_PREFIX}daily_data`;
const CENTER_DATA_KEY = `${STORAGE_PREFIX}center_data`;

// ====== localStorage 工具函数（仅用于轻量数据）======

function getFromStorage<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error('[DB] 读取存储失败:', error);
    return null;
  }
}

function setToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('[DB] 写入存储失败:', error);
  }
}

// ====== 初始化 ======

/**
 * 初始化数据库（调用一次即可）
 */
export async function initDatabase(): Promise<boolean> {
  // 启动时修复 localStorage 中的脏数据（centers 为 undefined 的情况）
  try {
    const raw = localStorage.getItem(DAILY_DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let repaired = false;
      Object.keys(parsed).forEach(dateKey => {
        if (parsed[dateKey] && parsed[dateKey].centers === undefined) {
          parsed[dateKey].centers = {};
          repaired = true;
          console.warn(`[DB] 修复脏数据: ${dateKey}.centers 已重置`);
        }
      });
      if (repaired) {
        localStorage.setItem(DAILY_DATA_KEY, JSON.stringify(parsed));
        console.log('[DB] localStorage 脏数据修复完成');
      }
    }
  } catch (e) {
    console.warn('[DB] 启动时数据修复失败', e);
  }

  return true;
}

// ====== 核心数据操作 ======

/**
 * 保存每日数据（localStorage）
 * 大数据量时跳过 localStorage，避免 QuotaExceededError
 */
export async function saveDailyData(
  date: string,
  dataType: DataType,
  centerDataList: CenterData[]
): Promise<void> {
  // 估算数据大小（粗略：每行约 500 字符）
  const estimatedSize = centerDataList.length * 500;
  const isLargeData = estimatedSize > 100000; // > 100KB 视为大数据

  // ===== 1. localStorage 写入（仅轻量数据） =====
  if (!isLargeData) {
    const dailyData = getFromStorage<Record<string, any>>(DAILY_DATA_KEY) || {};

    if (!dailyData[date]) {
      dailyData[date] = {
        date,
        uploadTime: Date.now(),
        centers: {}
      };
    }
    // 防御性检查：确保 centers 属性存在（防止 localStorage 脏数据）
    if (!dailyData[date].centers) {
      dailyData[date].centers = {};
    }

    centerDataList.forEach(centerData => {
      const centerId = centerData.id;
      if (!dailyData[date].centers[centerId]) {
        dailyData[date].centers[centerId] = {};
      }
      const typeKey = dataType as string;
      dailyData[date].centers[centerId][typeKey] = centerData;
    });

    setToStorage(DAILY_DATA_KEY, dailyData);

    // 中心维度索引
    const centerDataStorage = getFromStorage<Record<string, any>>(CENTER_DATA_KEY) || {};
    centerDataList.forEach(centerData => {
      const key = `${centerData.id}_${dataType}_${date}`;
      centerDataStorage[key] = centerData;
    });
    setToStorage(CENTER_DATA_KEY, centerDataStorage);
  } else {
    // 数据量过大，只存轻量元数据
    const metaData = getFromStorage<Record<string, any>>(DAILY_DATA_KEY) || {};
    metaData[date] = {
      date,
      uploadTime: Date.now(),
      dataType,
      rowCount: centerDataList.length,
      source: 'indexeddb'
    };
    setToStorage(DAILY_DATA_KEY, metaData);
  }
}

/**
 * 获取指定日期的数据
 */
export async function getDataByDate(date: string): Promise<DailyData | null> {
  const dailyData = getFromStorage<Record<string, any>>(DAILY_DATA_KEY);
  return dailyData ? dailyData[date] || null : null;
}

/**
 * 获取所有日期列表
 */
export async function getAllDates(): Promise<string[]> {
  const dailyData = getFromStorage<Record<string, any>>(DAILY_DATA_KEY);
  if (!dailyData) return [];
  return Object.keys(dailyData).sort((a, b) => b.localeCompare(a));
}

/**
 * 获取趋势数据（近 N 天）
 */
export async function getTrendData(query: TrendQuery): Promise<CenterData[]> {
  const { centerId, dataType, jobName, days } = query;
  const trends: CenterData[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const key = `${centerId}_${dataType}_${dateStr}`;

    let data: any = null;

    // 从 localStorage 读取
    const centerDataStorage = getFromStorage<Record<string, any>>(CENTER_DATA_KEY);
    data = centerDataStorage ? centerDataStorage[key] : null;

    if (data) {
      if (dataType === 'job_performance' && jobName) {
        const filteredData = {
          ...data,
          jobs: data.jobs.filter((j: any) => j.jobName === jobName)
        };
        if (filteredData.jobs.length > 0) {
          trends.push(filteredData);
        }
      } else {
        trends.push(data);
      }
    }
  }

  return trends.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 获取所有中心列表
 */
export async function getAllCenters(): Promise<{ id: string; province: string; center: string }[]> {
  const dailyData = getFromStorage<Record<string, any>>(DAILY_DATA_KEY);
  if (!dailyData) return [];


  const centerSet = new Set<string>();
  const centers: { id: string; province: string; center: string }[] = [];

  Object.values(dailyData).forEach((dayData: any) => {
    if (dayData.centers) {
      Object.values(dayData.centers).forEach((centerData: any) => {
        if (!centerSet.has(centerData.id)) {
          centerSet.add(centerData.id);
          const typeData = Object.values(centerData).find(v => v.province && v.center) as any;
          if (typeData) {
            centers.push({
              id: centerData.id,
              province: typeData.province,
              center: typeData.center
            });
          }
        }
      });
    }
  });

  return centers.sort((a, b) => a.province.localeCompare(b.province));
}

/**
 * 清理过期数据（超过 N 天）
 * 清理 localStorage 和 IndexedDB
 */
export async function cleanupExpiredData(daysToKeep: number = 30): Promise<number> {
  let totalDeleted = 0;

  // localStorage 清理
  const dailyData = getFromStorage<Record<string, any>>(DAILY_DATA_KEY);
  if (dailyData) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    Object.keys(dailyData).forEach(date => {
      if (date < cutoffStr) {
        delete dailyData[date];
        totalDeleted++;
      }
    });

    setToStorage(DAILY_DATA_KEY, dailyData);

    const centerDataStorage = getFromStorage<Record<string, any>>(CENTER_DATA_KEY) || {};
    const oldKeys = Object.keys(centerDataStorage).filter(key => {
      const date = key.split('_').pop();
      return date && date < cutoffStr;
    });
    oldKeys.forEach(key => delete centerDataStorage[key]);
    setToStorage(CENTER_DATA_KEY, centerDataStorage);
  }

  return totalDeleted;
}

/**
 * 获取统计数据
 */


// ====== 原始数据存取（用于每次加载时重新计算 T-2/T-3）======
// 使用 IndexedDB 存储，突破 localStorage 5MB 限制

/**
 * 保存原始上传数据到 IndexedDB（异步）
 * 调用方已负责合并去重
 */
export async function saveRawData(rawData: any[], dataType: string, getKey?: (row: any) => string): Promise<void> {
  try {
    await idbSaveRawData(rawData, dataType, getKey);
  } catch (e) {
    console.error('[DB] IndexedDB 保存失败，降级到 localStorage:', e);
    const meta = { dataType, rowCount: rawData.length, savedAt: Date.now() };
    localStorage.setItem(`${STORAGE_PREFIX}${dataType}_meta`, JSON.stringify(meta));
  }
}

/**
 * 读取最近一次保存的原始 CSV 数据（效能数据）
 */
export async function getLatestRawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('job_performance');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（job_performance）:', e);
    return null;
  }
}

/**
 * 读取薪资原始数据（工资偏高明细）
 */
export async function getSalaryRawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('salary_performance');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（salary_performance）:', e);
    return null;
  }
}

/**
 * 读取连续15日出勤原始数据
 */
export async function getAttendance15RawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('attendance_15days');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（attendance_15days）:', e);
    return null;
  }
}

/**
 * 读取连续7日未出勤原始数据
 */
export async function getAttendance7RawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('attendance_7days');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（attendance_7days）:', e);
    return null;
  }
}

/**
 * 读取花名册原始数据
 */
export async function getRosterRawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('employee_roster');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（employee_roster）:', e);
    return null;
  }
}

/**
 * 读取模块出勤明细原始数据
 */
export async function getModuleAttendanceRawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('module_attendance');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（module_attendance）:', e);
    return null;
  }
}

/**
 * 读取中心在职人数原始数据
 */
export async function getCenterHeadcountRawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('center_headcount');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（center_headcount）:', e);
    return null;
  }
}

/**
 * 读取日出勤明细原始数据（中心考勤）
 */
export async function getCenterAttendanceRawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('center_daily_attendance');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（center_daily_attendance）:', e);
    return null;
  }
}

/**
 * 读取日工时高原始数据（出勤工时>12.5h）
 */
export async function getWorkHoursHighRawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('work_hours_high');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（work_hours_high）:', e);
    return null;
  }
}

/**
 * 读取日工时低原始数据（出勤工时≤8h）
 */
export async function getWorkHoursLowRawData(): Promise<{ rawData: any[]; dataType: string; savedAt: number } | null> {
  try {
    return await idbGetRawData('work_hours_low');
  } catch (e) {
    console.warn('[DB] IndexedDB 读取失败（work_hours_low）:', e);
    return null;
  }
}

/**
 * 通用读取原始数据（按类型）
 */
export { idbGetRawData };

/**
 * 按数据类型清理原始数据（异步）
 * @returns 被清理的数据行数
 */
export async function clearRawDataByType(dataType: string): Promise<number> {
  try {
    return await idbClearRawDataByType(dataType);
  } catch (e) {
    console.error('[DB] IndexedDB 清理失败:', e);
    return 0;
  }
}

/**
 * 获取各数据类型的存储行数（异步）
 */
export async function getRawDataStats(): Promise<Record<string, number>> {
  try {
    return await idbGetRawDataStats();
  } catch (e) {
    console.warn('[DB] IndexedDB 统计失败:', e);
    return {};
  }
}

/**
 * 获取存储估算（IndexedDB + localStorage）
 */
export async function getStorageStats() {
  // 原有 localStorage 统计
  const dailyData = getFromStorage<Record<string, any>>(DAILY_DATA_KEY);
  const centerData = getFromStorage<Record<string, any>>(CENTER_DATA_KEY);

  const dates = dailyData ? Object.keys(dailyData) : [];
  const centerKeys = centerData ? Object.keys(centerData) : [];

  let totalSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      totalSize += (localStorage.getItem(key)?.length || 0) * 2;
    }
  }

  // IndexedDB 存储估算
  let idbUsage = '未知';
  let idbQuota = '未知';
  try {
    const estimate = await idbGetStorageEstimate();
    idbUsage = estimate.usageMB;
    idbQuota = estimate.quotaMB;
  } catch (e) { /* ignore */ }

  return {
    storageMode: 'IndexedDB（本地）',
    totalDays: dates.length,
    totalDataPoints: centerKeys.length,
    storageSize: totalSize,
    storageSizeKB: (totalSize / 1024).toFixed(2),
    idbUsageMB: idbUsage,
    idbQuotaMB: idbQuota,
    oldestDate: dates.length > 0 ? [...dates].sort()[0] : '无数据',
    newestDate: dates.length > 0 ? [...dates].sort().reverse()[0] : '无数据',
    cloudbaseConnected: false,
  };
}

/**
 * 清空所有数据（IndexedDB + localStorage）
 * 注意：不清理登录态（gpt_loggedin/gpt_user/gpt_admin/gpt_dashboard_auth）
 */
export async function clearAllData(): Promise<void> {
  // 清空 IndexedDB
  try {
    await idbClearAllRawData();
  } catch (e) {
    console.error('[DB] IndexedDB 清空失败:', e);
  }

  // 清空 localStorage 数据/配置/缓存（保留登录态）
  localStorage.removeItem(DAILY_DATA_KEY);
  localStorage.removeItem(CENTER_DATA_KEY);
  localStorage.removeItem(`${STORAGE_PREFIX}raw_data`);
  localStorage.removeItem(`${STORAGE_PREFIX}salary_raw_data`);
  localStorage.removeItem(`${STORAGE_PREFIX}admin_mode`);
  localStorage.removeItem(`${STORAGE_PREFIX}exempt_centers`);
  localStorage.removeItem(`${STORAGE_PREFIX}group_leaders`);
  localStorage.removeItem('gpt_loaded_files');
  localStorage.removeItem('gpt_filelist_cache');
}
