/**
 * 默认数据加载器 - 从 public/database/ 读取 Excel 文件并解析
 * B2 方案：数据随部署打包，所有用户看到相同数据
 */

import * as XLSX from 'xlsx';
import { DataType } from '../types/data';
import { parseDataByTemplate, extractDateFromData } from './dataParser';
import { saveRawData, initDatabase } from './database';

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
 * 内置文件列表（回退用）
 * 根据实际部署的文件名更新
 */
const BUILTIN_FILE_LIST = [
  '花名册-2026-05-11.xlsx',
  '岗位效能异常.xlsx',
  '效能异常5.12.xlsx',
  '绩效异常岗位5.13.xlsx',
  '绩效异常岗位5.14.xlsx',
  '绩效异常岗位5.15.xlsx',
  '工资偏高人员5.12.xlsx',
  '工资偏高人员5.13.xlsx',
  '工资偏高人员5.14.xlsx',
  '工资偏高人员5.15.xlsx',
  '薪资异常数据表.xlsx',
  '连续15天出勤人员明细5.12.xlsx',
  '连续15天出勤人员明细5.13.xlsx',
  '连续15天出勤人员明细5.14.xlsx',
  '连续15天出勤人员明细5.15.xlsx',
  '连续15日出勤.xlsx',
  '连续7天未出勤人员明细5.12.xlsx',
  '连续7天未出勤人员明细5.13.xlsx',
  '连续7天未出勤人员明细5.14.xlsx',
  '连续7天未出勤人员明细5.15.xlsx',
  '连续7日未出勤.xlsx',
  '中心考勤固定工-明细5.13.xlsx',
  '中心考勤固定工-明细5.14.xlsx',
  '中心考勤固定工-明细5.15.xlsx',
];

/**
 * 从 public/database/ 获取文件列表
 */
async function fetchFileList(): Promise<string[]> {
  try {
    const response = await fetch('/database/');
    if (!response.ok) {
      console.warn('[默认数据] 无法列出 database/ 目录，使用内置列表');
      return BUILTIN_FILE_LIST;
    }
    const text = await response.text();
    // 解析 HTML 目录列表（支持中文文件名）
    const matches = text.match(/href="([^"]+\.xlsx?)"/gi) || [];
    const files = matches.map(m => {
      const match = m.match(/href="([^"]+)"/);
      return match ? decodeURIComponent(match[1]) : '';
    }).filter(Boolean);
    
    if (files.length === 0) {
      console.warn('[默认数据] 目录列表为空，使用内置列表');
      return BUILTIN_FILE_LIST;
    }
    
    return files;
  } catch (e) {
    console.warn('[默认数据] 获取文件列表失败，使用内置列表', e);
    return BUILTIN_FILE_LIST;
  }
}

/**
 * 加载并解析单个 Excel 文件
 */
async function loadAndParseFile(filename: string): Promise<{ data: any[]; dataType: DataType; date: string } | null> {
  try {
    const response = await fetch(`/database/${filename}`);
    if (!response.ok) {
      console.warn(`[默认数据] 无法加载文件：${filename}`);
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

    const files = await fetchFileList();
    if (files.length === 0) {
      console.log('[默认数据] 未找到 Excel 文件');
      return false;
    }

    let loadedAny = false;

    for (const file of files) {
      if (!file.match(/\.xlsx?$/i)) continue;

      const result = await loadAndParseFile(file);
      if (!result) continue;

      const { data, dataType, date } = result;

      // 使用已有的解析器处理数据
      const { parseDataByTemplate } = require('./dataParser');
      const parsed = parseDataByTemplate(data, dataType, date);

      // 保存到 IndexedDB
      await saveRawData(data, dataType);

      console.log(`[默认数据] 已加载：${file} -> ${dataType}，共 ${data.length} 条`);
      loadedAny = true;
    }

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
    const { getLatestRawData, getSalaryRawData, getAttendance15RawData, getAttendance7RawData, getRosterRawData } = require('./database');
    
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
