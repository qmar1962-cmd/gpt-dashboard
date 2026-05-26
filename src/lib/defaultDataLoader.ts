/**
 * 默认数据加载器 - 从 public/database/ 读取 Excel 文件并解析
 * B2 方案：数据随部署打包，所有用户看到相同数据
 * 
 * 增量更新：只重新加载修改时间变化的文件，其他使用缓存
 */

import * as XLSX from 'xlsx';
import { DataType } from '../types/data';
import { extractDateFromData } from './dataParser';
import {
  saveRawData,
  initDatabase,
  getLatestRawData,
  getSalaryRawData,
  getAttendance15RawData,
  getAttendance7RawData,
  getRosterRawData,
  getModuleAttendanceRawData,
  getCenterHeadcountRawData,
  clearRawDataByType,
} from './database';

// ── 类型定义 ─────────────────────────────────────────────────

interface FileInfo {
  mtime: string;  // 文件修改时间（ISO string）
  size: number;   // 文件大小（bytes）
}

interface FileListData {
  generated_at: string;
  files: { [filename: string]: FileInfo };
}

// ── 常量 ─────────────────────────────────────────────────────

const FILE_LIST_URL = './database/filelist.json';
const FILE_LIST_CACHE_KEY = 'gpt_filelist_cache';  // 本地缓存的文件列表

// ── Excel 文件名前缀 -> 数据类型的映射 ──────────────────

const FILE_TYPE_MAP: Record<string, DataType> = {
  'job_performance': 'job_performance',
  'salary_performance': 'salary_performance',
  'attendance15': 'attendance_15days',
  'attendance7': 'attendance_7days',
  'center_attendance': 'center_daily_attendance',
  'roster': 'employee_roster',
  'module_attendance': 'module_attendance',
  'center_headcount': 'center_headcount',
  'work_hours_high': 'work_hours_high',
  'work_hours_low': 'work_hours_low',
};

// ── 工具函数 ───────────────────────────────────────────────

/**
 * 根据文件名推断数据类型
 */
function inferDataType(filename: string): DataType | null {
  const lowerName = filename.toLowerCase();
  for (const [key, type] of Object.entries(FILE_TYPE_MAP)) {
    if (lowerName.startsWith(key)) {
      return type as DataType;
    }
  }
  return null;
}

/**
 * 加载并解析单个 Excel 文件
 */
async function loadAndParseFile(filename: string): Promise<{ data: any[]; dataType: DataType } | null> {
  try {
    const url = `./database/${filename}`;
    const response = await fetch(url, { cache: 'no-cache' });  // 强制获取最新版本
    if (!response.ok) {
      console.warn(`[默认数据] 无法加载文件(${response.status})：${filename}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return null;

    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (rawData.length === 0) return null;

    // 推断数据类型
    const dataType = inferDataType(filename);
    if (!dataType) {
      console.warn(`[默认数据] 无法推断文件类型：${filename}`);
      return null;
    }

    return { data: rawData, dataType };
  } catch (error) {
    console.error(`[默认数据] 解析文件失败 ${filename}:`, error);
    return null;
  }
}

// ── 核心函数：获取文件列表（增量更新用）─────────────

/**
 * 获取远程 filelist.json（强制不缓存）
 * 返回：{ filename: { mtime, size } }
 */
async function fetchRemoteFileList(): Promise<FileListData | null> {
  try {
    const url = `${FILE_LIST_URL}?t=${Date.now()}`;  // 防止缓存
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      console.warn('[默认数据] 获取 filelist.json 失败:', res.status);
      return null;
    }
    const data: FileListData = await res.json();
    return data;
  } catch (err) {
    console.warn('[默认数据] 获取远程 filelist.json 失败:', err);
    return null;
  }
}

/**
 * 获取本地缓存的文件列表
 */
function getLocalFileListCache(): FileListData | null {
  try {
    const cached = localStorage.getItem(FILE_LIST_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

/**
 * 保存文件列表到本地缓存
 */
function saveLocalFileListCache(data: FileListData): void {
  try {
    localStorage.setItem(FILE_LIST_CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('[默认数据] 保存 filelist 缓存失败:', err);
  }
}

/**
 * 对比远程和本地文件列表，找出需要重新加载的文件
 * @returns 需要加载的文件名列表
 */
function getFilesToReload(
  remote: FileListData,
  local: FileListData | null
): string[] {
  const toReload: string[] = [];

  for (const [filename, remoteInfo] of Object.entries(remote.files)) {
    if (!local) {
      // 本地没有缓存，需要加载
      toReload.push(filename);
      continue;
    }

    const localInfo = local.files[filename];
    if (!localInfo) {
      // 本地没有这个文件，需要加载
      toReload.push(filename);
      continue;
    }

    // 对比 mtime（只比较到秒，忽略毫秒和时区差异）和 size
    const remoteMtimeSec = remoteInfo.mtime.split('.')[0]; // 去掉毫秒部分
    const localMtimeSec = localInfo.mtime.split('.')[0];
    if (remoteMtimeSec !== localMtimeSec || remoteInfo.size !== localInfo.size) {
      // 文件已变化，需要重新加载
      toReload.push(filename);
    }
    // 否则跳过（使用缓存）
  }

  return toReload;
}

/**
 * 检测哪些文件被删除了（本地有但远程没有），并清除对应类型的 IndexedDB 数据
 * 防止删除旧文件后，IndexedDB 中仍然保留旧数据导致数据重复
 */
async function clearDeletedFileData(
  remote: FileListData,
  local: FileListData | null
): Promise<void> {
  if (!local) return;

  const deletedTypes = new Set<string>();

  for (const localFile of Object.keys(local.files)) {
    // 如果远程没有这个文件，说明被删除了
    if (!remote.files[localFile]) {
      const dataType = inferDataType(localFile);
      if (dataType) {
        deletedTypes.add(dataType);
      }
    }
  }

  for (const dataType of deletedTypes) {
    console.log(`[默认数据] 检测到文件删除，清除 ${dataType} 的 IndexedDB 缓存`);
    await clearRawDataByType(dataType);
  }
}

// ── 主函数 ─────────────────────────────────────────────────

/**
 * 主函数：从 public/database/ 加载默认数据
 * 增量更新：只重新加载修改过的文件，其他使用缓存
 * 支持进度回调（用于 UI 展示加载进度）
 */
export async function loadDefaultData(
  onProgress?: (loaded: number, total: number, currentFile: string) => void
): Promise<boolean> {
  try {
    console.log('[默认数据] 开始加载默认数据（增量更新模式）...');

    // 确保数据库已初始化
    await initDatabase();

    // 1. 获取远程文件列表
    const remoteFileList = await fetchRemoteFileList();
    if (!remoteFileList) {
      console.warn('[默认数据] 无法获取远程文件列表，使用本地缓存');
      // 如果无法获取远程列表，返回 false（让调用方决定是否使用缓存数据）
      return false;
    }

    const remoteFiles = Object.keys(remoteFileList.files);
    console.log(`[默认数据] 远程文件列表：${remoteFiles.length} 个文件`);

    // 2. 获取本地缓存的文件列表
    const localFileList = getLocalFileListCache();

    // 2.5 检测被删除的文件并清除对应类型的 IndexedDB 数据
    // 防止删除旧文件后，IndexedDB 中仍然保留旧数据导致数据重复
    await clearDeletedFileData(remoteFileList, localFileList);

    // 3. 对比，找出需要重新加载的文件
    const filesToReload = getFilesToReload(remoteFileList, localFileList);
    const skipCount = remoteFiles.length - filesToReload.length;

    if (skipCount > 0) {
      console.log(`[默认数据] 跳过 ${skipCount} 个未变化文件（使用缓存）`);
    }
    if (filesToReload.length > 0) {
      console.log(`[默认数据] 需要重新加载 ${filesToReload.length} 个文件：`, filesToReload);
    } else {
      console.log('[默认数据] 所有文件未变化，无需重新加载');
      return false;  // 没有重新加载任何文件
    }

    // 4. 并行加载需要重新加载的文件
    let successCount = 0;
    let failCount = 0;

    const loadPromises = filesToReload.map(async (file, idx) => {
      try {
        const result = await loadAndParseFile(file);
        if (!result) {
          failCount++;
          return;
        }

        const { data, dataType } = result;
        await saveRawData(data, dataType);

        console.log(`[默认数据] 已加载：${file} -> ${dataType}，共 ${data.length} 条`);
        successCount++;

        // 进度回调
        if (onProgress) {
          onProgress(idx + 1, filesToReload.length, file);
        }
      } catch (err) {
        console.error(`[默认数据] 加载文件失败 ${file}:`, err);
        failCount++;
      }
    });

    await Promise.all(loadPromises);

    // 5. 更新本地文件列表缓存
    saveLocalFileListCache(remoteFileList);

    console.log(`[默认数据] 加载完成：成功 ${successCount} 个，失败 ${failCount} 个，跳过 ${skipCount} 个`);
    return successCount > 0;
  } catch (error) {
    console.error('[默认数据] 加载失败：', error);
    return false;
  }
}

/**
 * 检查是否已有数据（避免重复加载）
 */
export async function hasExistingData(): Promise<boolean> {
  try {
    const jobData = await getLatestRawData();
    if (jobData?.rawData?.length > 0) return true;

    const salaryData = await getSalaryRawData();
    if (salaryData?.rawData?.length > 0) return true;

    const att15Data = await getAttendance15RawData();
    if (att15Data?.rawData?.length > 0) return true;

    const att7Data = await getAttendance7RawData();
    if (att7Data?.rawData?.length > 0) return true;

    const rosterData = await getRosterRawData();
    if (rosterData?.rawData?.length > 0) return true;

    const moduleAttData = await getModuleAttendanceRawData();
    if (moduleAttData?.rawData?.length > 0) return true;

    const headcountData = await getCenterHeadcountRawData();
    if (headcountData?.rawData?.length > 0) return true;

    return false;
  } catch (e) {
    return false;
  }
}
