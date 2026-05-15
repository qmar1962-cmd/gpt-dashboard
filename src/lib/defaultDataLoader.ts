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
} from './database';

/**
 * Excel 文件名 -> 数据类型的映射
 * 支持中英文关键词匹配
 */
const FILE_TYPE_MAP: Record<string, DataType> = {
  // 效能异常 / 岗位效能
  '效能': 'job_performance',
  '绩效': 'job_performance',
  '岗位': 'job_performance',
  'job': 'job_performance',

  // 薪资异常 / 工资偏高
  '薪资': 'salary_performance',
  '工资': 'salary_performance',
  'salary': 'salary_performance',

  // 连续15日出勤
  '连续15': 'attendance_15days',
  '15天': 'attendance_15days',
  'attendance15': 'attendance_15days',

  // 连续7日未出勤
  '连续7': 'attendance_7days',
  '7天': 'attendance_7days',
  '未出勤': 'attendance_7days',
  'attendance7': 'attendance_7days',

  // 花名册
  '花名册': 'employee_roster',
  'roster': 'employee_roster',

  // 中心考勤
  '中心考勤': 'center_daily_attendance',
  '考勤': 'center_daily_attendance',
  'daily': 'center_daily_attendance',
};

/**
 * 根据文件名推断数据类型
 */
function inferDataType(filename: string): DataType | null {
  const lowerName = filename.toLowerCase();
  for (const [key, type] of Object.entries(FILE_TYPE_MAP)) {
    if (lowerName.includes(key.toLowerCase())) {
      return type as DataType;
    }
  }
  return null;
}

/**
 * 内置文件列表（静态托管不支持目录列表，直接使用此清单）
 * 与实际 public/database/ 下的文件名严格对应
 */
const BUILTIN_FILE_LIST: string[] = [
  // 花名册
  '花名册-2026-05-11.xlsx',

  // 岗位效能异常
  '岗位效能异常.xlsx',
  '效能异常5.12.xlsx',
  '绩效异常岗位5.13.xlsx',
  '绩效异常岗位5.14.xlsx',
  '绩效异常岗位5.15.xlsx',

  // 薪资异常
  '工资偏高人员5.12.xlsx',
  '工资偏高人员5.13.xlsx',
  '工资偏高人员5.14.xlsx',
  '工资偏高人员5.15.xlsx',
  '薪资异常数据表.xlsx',

  // 连续15日出勤
  '出勤异常人员➣连续15天出勤人员明细5.12.xlsx',
  '连续15天出勤人员明细5.13.xlsx',
  '连续15天出勤人员明细5.14.xlsx',
  '连续15天出勤人员明细5.15.xlsx',
  '连续15日出勤.xlsx',

  // 连续7日未出勤
  '出勤异常人员➣连续7天未出勤人员明细5.12.xlsx',
  '连续7天未出勤人员明细5.13.xlsx',
  '连续7天未出勤人员明细5.14.xlsx',
  '连续7天未出勤人员明细5.15.xlsx',
  '连续7日未出勤.xlsx',

  // 中心考勤（含历史明细）
  '中心考勤➣固定工-明细.xlsx',
  '中心考勤➣固定工➣固定工-明细_20260507104738.xlsx',
  '中心考勤➣固定工➣固定工-明细_20260508093821.xlsx',
  '中心考勤➣固定工➣固定工-明细_20260511091032.xlsx',
  '中心考勤➣固定工➣固定工-明细_20260512103617.xlsx',
  '中心考勤固定工-明细5.13.xlsx',
  '中心考勤固定工-明细5.14.xlsx',
  '中心考勤固定工-明细5.15.xlsx',
];

/**
 * 加载并解析单个 Excel 文件
 */
async function loadAndParseFile(filename: string): Promise<{ data: any[]; dataType: DataType; date: string } | null> {
  try {
    // URL 编码中文文件名（保留斜杠等）
    const encodedName = encodeURIComponent(filename);
    const url = `/database/${encodedName}`;

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

    // 提取日期
    const date = extractDateFromData(rawData);

    return { data: rawData, dataType, date };
  } catch (error) {
    console.error(`[默认数据] 解析文件失败 ${filename}:`, error);
    return null;
  }
}

/**
 * 主函数：从 public/database/ 加载默认数据
 * 在应用启动时调用
 */
export async function loadDefaultData(): Promise<boolean> {
  try {
    console.log('[默认数据] 开始加载默认数据...');

    // 确保数据库已初始化
    await initDatabase();

    const files = BUILTIN_FILE_LIST;
    if (files.length === 0) {
      console.log('[默认数据] 文件列表为空');
      return false;
    }

    let loadedAny = false;
    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
      if (!file.match(/\.xlsx?$/i)) continue;

      const result = await loadAndParseFile(file);
      if (!result) {
        failCount++;
        continue;
      }

      const { data, dataType } = result;

      // 保存原始数据到 IndexedDB
      await saveRawData(data, dataType);

      console.log(`[默认数据] 已加载：${file} -> ${dataType}，共 ${data.length} 条`);
      loadedAny = true;
      successCount++;
    }

    console.log(`[默认数据] 加载完成：成功 ${successCount} 个，失败 ${failCount} 个`);
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

    return false;
  } catch (e) {
    return false;
  }
}
