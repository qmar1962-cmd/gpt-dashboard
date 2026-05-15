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
 * 内置文件列表（静态托管不支持目录列表，直接使用此清单）
 * 文件名全部为英文，避免 URL 编码问题
 */
const BUILTIN_FILE_LIST: string[] = [
  // 花名册
  'roster_0511.xlsx',

  // 岗位效能异常（最新优先，base 为基准）
  'job_performance_base.xlsx',
  'job_performance_0512.xlsx',
  'job_performance_0513.xlsx',
  'job_performance_0514.xlsx',
  'job_performance_0515.xlsx',

  // 薪资异常
  'salary_performance_base.xlsx',
  'salary_performance_0512.xlsx',
  'salary_performance_0513.xlsx',
  'salary_performance_0514.xlsx',
  'salary_performance_0515.xlsx',

  // 连续15日出勤
  'attendance15_base.xlsx',
  'attendance15_0512.xlsx',
  'attendance15_0513.xlsx',
  'attendance15_0514.xlsx',
  'attendance15_0515.xlsx',

  // 连续7日未出勤
  'attendance7_base.xlsx',
  'attendance7_0512.xlsx',
  'attendance7_0513.xlsx',
  'attendance7_0514.xlsx',
  'attendance7_0515.xlsx',

  // 中心考勤
  'center_attendance_base.xlsx',
  'center_attendance_0507.xlsx',
  'center_attendance_0508.xlsx',
  'center_attendance_0511.xlsx',
  'center_attendance_0512.xlsx',
  'center_attendance_0513.xlsx',
  'center_attendance_0514.xlsx',
  'center_attendance_0515.xlsx',
];

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
 * 主函数：从 public/database/ 加载默认数据
 * 在应用启动时调用
 * 智能缓存：已加载成功的文件不会重复加载
 */
export async function loadDefaultData(): Promise<boolean> {
  try {
    console.log('[默认数据] 开始加载默认数据...');

    // 确保数据库已初始化
    await initDatabase();

    // 读取已加载的文件清单（localStorage 持久化）
    const loadedFilesKey = 'gpt_loaded_files';
    const loadedFiles = new Set<string>(JSON.parse(localStorage.getItem(loadedFilesKey) || '[]'));

    const files = BUILTIN_FILE_LIST;
    if (files.length === 0) {
      console.log('[默认数据] 文件列表为空');
      return false;
    }

    let loadedAny = false;
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const file of files) {
      if (!file.match(/\.xlsx?$/i)) continue;

      // 已加载过的文件跳过（除非用户清除了缓存）
      if (loadedFiles.has(file)) {
        console.log(`[默认数据] 跳过已加载文件：${file}`);
        skipCount++;
        continue;
      }

      const result = await loadAndParseFile(file);
      if (!result) {
        failCount++;
        continue;
      }

      const { data, dataType } = result;

      // 保存原始数据到 IndexedDB
      await saveRawData(data, dataType);

      // 记录为已加载
      loadedFiles.add(file);

      console.log(`[默认数据] 已加载：${file} -> ${dataType}，共 ${data.length} 条`);
      loadedAny = true;
      successCount++;
    }

    // 持久化已加载文件清单
    localStorage.setItem(loadedFilesKey, JSON.stringify(Array.from(loadedFiles)));

    console.log(`[默认数据] 加载完成：成功 ${successCount} 个，跳过 ${skipCount} 个，失败 ${failCount} 个`);
    return loadedAny;
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
