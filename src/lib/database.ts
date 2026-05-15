/**
 * 数据库存储服务
 * - 核心业务数据（每日汇总）: localStorage + Firebase Firestore 双写
 * - 原始大体积数据（薪资/出勤/效能）: IndexedDB（容量几百MB~数GB）
 */

import { DataType, CenterData, DailyData, TrendQuery } from '../types/data';
import {
  initFirebase,
  isFirebaseReady,
  saveToFirestore,
  readFromFirestore,
  getAllFromFirestore,
  cleanupFirestore,
  clearFirestore,
} from './firebase';
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

let firebaseInitialized = false;

/**
 * 初始化数据库（调用一次即可）
 * 自动尝试连接 Firebase，失败则使用 localStorage
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

  if (firebaseInitialized) return isFirebaseReady();
  
  firebaseInitialized = true;
  
  const success = await initFirebase();
  if (success) {
  } else {
  }
  
  return success;
}

// ====== 核心数据操作 ======

/**
 * 保存每日数据（双写：Firestore + localStorage）
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

  // ===== 2. Firestore 写入（异步，不阻塞） =====
  if (isFirebaseReady()) {
    // 写入日期文档
    const dateDocKey = `daily_${date}`;
    saveToFirestore(dateDocKey, {
      date,
      uploadTime: Date.now(),
      centers: centerDataList.reduce((acc, c) => ({ ...acc, [c.id]: c }), {}),
    });

    // 写入各中心数据
    centerDataList.forEach(centerData => {
      const key = `${centerData.id}_${dataType}_${date}`;
      saveToFirestore(key, centerData);
    });
  }
}

/**
 * 获取指定日期的数据
 * 优先从 Firestore 读，降级到 localStorage
 */
export async function getDataByDate(date: string): Promise<DailyData | null> {
  // 优先 Firestore
  if (isFirebaseReady()) {
    try {
      const key = `daily_${date}`;
      const data = await readFromFirestore(key);
      if (data) return data as DailyData;
    } catch (e) {
      console.warn('[DB] Firestore 读取失败，降级到 localStorage');
    }
  }

  // 降级 localStorage
  const dailyData = getFromStorage<Record<string, any>>(DAILY_DATA_KEY);
  return dailyData ? dailyData[date] || null : null;
}

/**
 * 获取所有日期列表
 */
export async function getAllDates(): Promise<string[]> {
  // 优先 Firestore
  if (isFirebaseReady()) {
    try {
      const allData = await getAllFromFirestore();
      const dates = new Set<string>();
      Object.values(allData).forEach((v: any) => {
        if (v.date) dates.add(v.date);
      });
      const sorted = Array.from(dates).sort((a, b) => b.localeCompare(a));
      if (sorted.length > 0) return sorted;
    } catch (e) {
      console.warn('[DB] Firestore 获取日期列表失败');
    }
  }

  // 降级 localStorage
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

    // 优先 Firestore
    if (isFirebaseReady()) {
      data = await readFromFirestore(key);
    }

    // 降级 localStorage
    if (!data) {
      const centerDataStorage = getFromStorage<Record<string, any>>(CENTER_DATA_KEY);
      data = centerDataStorage ? centerDataStorage[key] : null;
    }

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
  // 优先 Firestore
  if (isFirebaseReady()) {
    try {
      const allData = await getAllFromFirestore();
      const centerSet = new Set<string>();
      const centers: { id: string; province: string; center: string }[] = [];

      Object.values(allData).forEach((v: any) => {
        if (v.id && v.province && v.center && !centerSet.has(v.id)) {
          centerSet.add(v.id);
          centers.push({ id: v.id, province: v.province, center: v.center });
        }
      });

      if (centers.length > 0) return centers.sort((a, b) => a.province.localeCompare(b.province));
    } catch (e) {
      console.warn('[DB] Firestore 获取中心列表失败');
    }
  }

  // 降级 localStorage
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
 * 同时清理 Firestore 和 localStorage
 */
export async function cleanupExpiredData(daysToKeep: number = 30): Promise<number> {
  let totalDeleted = 0;

  // Firestore 清理
  if (isFirebaseReady()) {
    totalDeleted += await cleanupFirestore(daysToKeep);
  }

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
export async function saveRawData(rawData: any[], dataType: string): Promise<void> {
  try {
    await idbSaveRawData(rawData, dataType);
  } catch (e) {
    console.error('[DB] IndexedDB 保存失败，降级到 localStorage:', e);
    // 降级：只存轻量元数据到 localStorage
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
    storageMode: isFirebaseReady() ? 'Firebase Firestore + IndexedDB 缓存' : 'IndexedDB（本地）',
    totalDays: dates.length,
    totalDataPoints: centerKeys.length,
    storageSize: totalSize,
    storageSizeKB: (totalSize / 1024).toFixed(2),
    idbUsageMB: idbUsage,
    idbQuotaMB: idbQuota,
    oldestDate: dates.length > 0 ? [...dates].sort()[0] : '无数据',
    newestDate: dates.length > 0 ? [...dates].sort().reverse()[0] : '无数据',
    firebaseConnected: isFirebaseReady(),
  };
}

/**
 * 清空所有数据（Firestore + IndexedDB + localStorage）
 */
export async function clearAllData(): Promise<void> {
  // 清空 Firestore
  if (isFirebaseReady()) {
    await clearFirestore();
  }

  // 清空 IndexedDB
  try {
    await idbClearAllRawData();
  } catch (e) {
    console.error('[DB] IndexedDB 清空失败:', e);
  }

  // 清空 localStorage（轻量元数据）
  localStorage.removeItem(DAILY_DATA_KEY);
  localStorage.removeItem(CENTER_DATA_KEY);
  // 清理可能的旧 localStorage 原始数据（迁移后残留）
  localStorage.removeItem(`${STORAGE_PREFIX}raw_data`);
  localStorage.removeItem(`${STORAGE_PREFIX}salary_raw_data`);
}
