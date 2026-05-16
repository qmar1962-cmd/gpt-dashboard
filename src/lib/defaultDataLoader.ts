/**
 * 默认数据加载器 - 从 public/database/ 读取 Excel 文件并解析
 * B2 方案：数据随部署打包，所有用户看到相同数据
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
} from './database';

/**
 * Excel 文件名前缀 -> 数据类型的映射
 * 文件名格式：{type}_{date}.xlsx，如 job_performance_0512.xlsx
 */
const FILE_TYPE_MAP: Record<string, DataType> = {
  'job_performance': 'job_performance',
  'salary_performance': 'salary_performance',
  'attendance15': 'attendance_15days',
  'attendance7': 'attendance_7days',
  'center_attendance': 'center_daily_attendance',
  'roster': 'employee_roster',
  'module_attendance': 'module_attendance',
  'center_headcount': 'center_headcount',
};

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
    const url = `/database/${filename}`;
    const response = await fetch(url);
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

/**
 * 自动扫描 public/database/ 目录获取文件列表
 * 构建时 Vite 插件会生成 filelist.json
 */
async function getDatabaseFileList(): Promise<string[]> {
  try {
    const res = await fetch('/database/filelist.json');
    if (res.ok) {
      const list = await res.json();
      if (Array.isArray(list)) {
        console.log(`[默认数据] 从 filelist.json 读取到 ${list.length} 个文件`);
        return list;
      }
    }
  } catch (e) {
    console.warn('[默认数据] 读取 filelist.json 失败，尝试手动列表', e);
  }

  // filelist.json 不可用时，返回内置列表（兜底）
  return [
    'roster_0511.xlsx',
    'job_performance_base.xlsx',
    'job_performance_0512.xlsx',
    'job_performance_0513.xlsx',
    'job_performance_0514.xlsx',
    'job_performance_0515.xlsx',
    'salary_performance_base.xlsx',
    'salary_performance_0512.xlsx',
    'salary_performance_0513.xlsx',
    'salary_performance_0514.xlsx',
    'salary_performance_0515.xlsx',
    'attendance15_base.xlsx',
    'attendance15_0512.xlsx',
    'attendance15_0513.xlsx',
    'attendance15_0514.xlsx',
    'attendance15_0515.xlsx',
    'attendance7_base.xlsx',
    'attendance7_0512.xlsx',
    'attendance7_0513.xlsx',
    'attendance7_0514.xlsx',
    'attendance7_0515.xlsx',
    'center_attendance_base.xlsx',
    'center_attendance_0507.xlsx',
    'center_attendance_0508.xlsx',
    'center_attendance_0511.xlsx',
    'center_attendance_0512.xlsx',
    'center_attendance_0513.xlsx',
    'center_attendance_0514.xlsx',
    'center_attendance_0515.xlsx',
  ];
}

/**
 * 主函数：从 public/database/ 加载默认数据
 * 智能缓存：已加载成功的文件不会重复加载
 * 支持进度回调（用于 UI 展示加载进度）
 */
export async function loadDefaultData(
  onProgress?: (loaded: number, total: number, currentFile: string) => void
): Promise<boolean> {
  try {
    console.log('[默认数据] 开始加载默认数据...');

    // 确保数据库已初始化
    await initDatabase();

    // 读取已加载的文件清单（localStorage 持久化）
    const loadedFilesKey = 'gpt_loaded_files';
    const loadedFiles = new Set<string>(JSON.parse(localStorage.getItem(loadedFilesKey) || '[]'));

    const files = await getDatabaseFileList();
    if (files.length === 0) {
      console.log('[默认数据] 文件列表为空');
      return false;
    }

    const xlsxFiles = files.filter(f => f.match(/\.xlsx?$/i));
    const toLoad = xlsxFiles.filter(f => !loadedFiles.has(f));
    const skipCount = xlsxFiles.length - toLoad.length;

    if (skipCount > 0) {
      console.log(`[默认数据] 跳过 ${skipCount} 个已加载文件`);
    }

    // ── 并行加载：所有待加载文件同时发起请求 ──
    let successCount = 0;
    let failCount = 0;

    const loadPromises = toLoad.map(async (file, idx) => {
      try {
        const result = await loadAndParseFile(file);
        if (!result) {
          failCount++;
          return;
        }

        const { data, dataType } = result;
        await saveRawData(data, dataType);

        loadedFiles.add(file);
        console.log(`[默认数据] 已加载：${file} -> ${dataType}，共 ${data.length} 条`);
        successCount++;

        // 进度回调
        if (onProgress) {
          onProgress(idx + 1, toLoad.length, file);
        }
      } catch (err) {
        console.error(`[默认数据] 加载文件失败 ${file}:`, err);
        failCount++;
      }
    });

    await Promise.all(loadPromises);

    // 持久化已加载文件清单
    localStorage.setItem(loadedFilesKey, JSON.stringify(Array.from(loadedFiles)));

    console.log(`[默认数据] 加载完成：成功 ${successCount} 个，跳过 ${skipCount} 个，失败 ${failCount} 个`);
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
