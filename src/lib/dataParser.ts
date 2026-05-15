/**
 * 数据解析器 - 解析 6 种不同的数据模板
 */

import { 
  DataType, 
  CenterData,
  JobPerformanceData,
  SalaryPerformanceData,
  Attendance15DaysData,
  Attendance7DaysData,
  EmployeeRosterData
} from '../types/data';
import { 
  countAbnormalJobsByCountifs,
  groupByDateWithCountifs, 
  getPreviousDayData,
  calculateJobPerformanceScore 
} from './jobPerformanceProcessor.js';

/**
 * 生成中心 ID
 */
function generateCenterId(province: string, center: string): string {
  const pinyinMap: Record<string, string> = {
    '湖北省区': 'hubei',
    '湖南省区': 'hunan',
    '河南省区': 'henan',
    '江西省区': 'jiangxi',
    '浙江省区': 'zhejiang',
    '江苏省区': 'jiangsu',
    '安徽省区': 'anhui',
    '山东省区': 'shandong',
    '广东省区': 'guangdong',
    '广西省区': 'guangxi',
    '福建省区': 'fujian',
    '四川省区': 'sichuan',
    '河北省区': 'hebei',
    '山西省区': 'shanxi',
    '陕西省区': 'shaanxi',
    '辽宁省区': 'liaoning',
    '吉林省区': 'jilin',
    '黑龙江省区': 'heilongjiang',
    '上海省区': 'shanghai',
    '北京省区': 'beijing',
    '天津省区': 'tianjin',
    '重庆省区': 'chongqing'
  };

  const safeProvince = (province || '').trim();
  const safeCenter = (center || '').trim();
  const provincePrefix = pinyinMap[safeProvince] || safeProvince.substring(0, 2).toLowerCase() || 'unknown';
  const centerName = safeCenter.substring(0, 2).toLowerCase() || 'unknown';

  return `${provincePrefix}-${centerName}`;
}

/**
 * 解析岗位效能异常数据 - 使用 COUNTIFS 逻辑
 * 规则：只统计华中大区数据，目标偏离 >= 10 的个数，按日期 + 中心聚合
 */
function parseJobPerformance(rawData: any[], date: string): JobPerformanceData[] {
  // 使用 COUNTIFS 逻辑按日期聚合所有数据（只统计华中大区）
  const dateCenterCount = groupByDateWithCountifs(rawData);
  
  // 获取当前日期的数据
  const currentCenterCount = dateCenterCount[date] || {};
  
  // 获取前一天（T-1）的数据
  const previousDayCount = getPreviousDayData(dateCenterCount, date, 1);
  
  // 生成中心数据
  const centerDataList: JobPerformanceData[] = [];
  
  Object.entries(currentCenterCount).forEach(([centerKey, count]) => {
    const [province, center] = centerKey.split('_');
    const centerId = generateCenterId(province, center);
    
    // 获取前一天的数据
    const prevCount = previousDayCount[centerKey] || 0;
    
    // 计算得分：25 分满分，每个异常扣 5 分，最低 0 分
    const score = calculateJobPerformanceScore(count);
    
    centerDataList.push({
      id: centerId,
      province,
      center,
      date,
      dataType: 'job_performance',
      uploadTime: Date.now(),
      jobs: [], // 聚合数据，不需要明细
      abnormalCount: count,
      previousDayCount: prevCount,
      score: score,
      maxScore: 25
    });
  });
  
  return centerDataList;
}

/**
 * 解析薪资绩效异常数据
 */
function parseSalaryPerformance(rawData: any[], date: string): SalaryPerformanceData[] {
  return rawData.map((row) => {
    const province = row.省区 || row.province;
    const center = row.中心 || row.center;
    
    return {
      id: generateCenterId(province, center),
      province,
      center,
      date,
      dataType: 'salary_performance',
      uploadTime: Date.now(),
      coverage: parseFloat(row.覆盖率 || row.coverage) || 0,
      affectedCount: parseInt(row.影响人数 || row.affectedCount) || 0,
      salaryAmount: parseFloat(row.算薪金额 || row.salaryAmount),
      abnormalRate: parseFloat(row.异常率 || row.abnormalRate)
    } as SalaryPerformanceData;
  });
}

/**
 * 解析连续 15 日出勤数据
 */
function parseAttendance15Days(rawData: any[], date: string): Attendance15DaysData[] {
  return rawData.map((row) => {
    const province = row.省区 || row.province;
    const center = row.中心 || row.center;
    
    return {
      id: generateCenterId(province, center),
      province,
      center,
      date,
      dataType: 'attendance_15days',
      uploadTime: Date.now(),
      coverage: parseFloat(row.覆盖率 || row.coverage) || 0,
      triggerRate: parseFloat(row.触发率 || row.triggerRate) || 0,
      newCount: parseInt(row.新增人数 || row.newCount) || 0,
      totalCount: parseInt(row.总人数 || row.totalCount) || 0
    } as Attendance15DaysData;
  });
}

/**
 * 解析七日未出勤数据
 */
function parseAttendance7Days(rawData: any[], date: string): Attendance7DaysData[] {
  return rawData.map((row) => {
    const province = row.省区 || row.province;
    const center = row.中心 || row.center;
    
    return {
      id: generateCenterId(province, center),
      province,
      center,
      date,
      dataType: 'attendance_7days',
      uploadTime: Date.now(),
      abnormalCount: parseInt(row.异常人数 || row.abnormalCount) || 0,
      cumulativeScore: parseFloat(row.累计计分 || row.cumulativeScore) || 0,
      excludedCount: parseInt(row.排除人数 || row.excludedCount)
    } as Attendance7DaysData;
  });
}

/**
 * 【已删除】中心考勤出勤人数解析
 * 分母已改为花名册中心操作人数，此函数不再使用
 */

/**
 * 解析中心在职花名册数据
 * 实际列名：五级单位(省区)、六级单位(中心)、工号、姓名、岗位名称、二级部门、入职日期、状态等
 */
function parseEmployeeRoster(rawData: any[], date: string): EmployeeRosterData[] {
  return rawData.map((row, index) => {
    // 兼容花名册实际列名
    const province = row['五级单位'] || row.省区 || row.province || '';
    const center = row['六级单位'] || row.中心 || row.center || '';
    const employeeId = row.工号 || row['员工 ID'] || row.employeeId || `row_${index}`;

    return {
      id: `${generateCenterId(province, center)}_${employeeId}`,
      province,
      center,
      date,
      dataType: 'employee_roster',
      uploadTime: Date.now(),
      employeeId: employeeId,
      employeeName: row.姓名 || row.员工姓名 || row.employeeName || '',
      position: row.岗位名称 || row.岗位 || row.position || '',
      entryDate: row.入职日期 || row.entryDate || '',
      status: row.状态 || row.status || '在职',
      department: row['二级部门'] || row.部门 || row.department || ''
    } as EmployeeRosterData;
  });
}

/**
 * 主解析函数 - 根据数据类型调用对应的解析器
 */
export function parseDataByTemplate(
  rawData: any[], 
  dataType: DataType,
  date: string
): CenterData[] {
  switch (dataType) {
    case 'job_performance':
      return parseJobPerformance(rawData, date);
    case 'salary_performance':
      return parseSalaryPerformance(rawData, date);
    case 'attendance_15days':
      return parseAttendance15Days(rawData, date);
    case 'attendance_7days':
      return parseAttendance7Days(rawData, date);
    // center_attendance 已废弃，分母改用花名册中心操作人数
    // case 'center_attendance':
    //   return parseCenterAttendance(rawData, date);
    case 'employee_roster':
      return parseEmployeeRoster(rawData, date);
    case 'center_daily_attendance':
      // 中心日出勤明细：直接返回原始数据，由 App.tsx 处理去重逻辑
      return rawData;
    default:
      throw new Error(`未知数据类型：${dataType}`);
  }
}

/**
 * 将 Excel 日期序列号转换为 YYYY-MM-DD 格式
 */
function convertExcelDate(excelDate: any): string {
  if (typeof excelDate === 'string') {
    // 统一将斜杠替换为横线，再补零
    const normalized = excelDate.replace(/\//g, '-');
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return normalized;
  }
  
  if (typeof excelDate === 'number') {
    // 使用 UTC 时间避免时区问题
    const excelStartDate = Date.UTC(1899, 11, 30);
    const date = new Date(excelStartDate + excelDate * 24 * 60 * 60 * 1000);
    
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  return '';
}

/**
 * 从原始数据中提取日期
 */
export function extractDateFromData(rawData: any[]): string {
  if (!rawData || rawData.length === 0) {
    console.warn('数据为空，使用今天作为日期');
    return new Date().toISOString().split('T')[0];
  }
  
  // 从所有行中提取日期，取最新（最大）的日期
  const allDates: string[] = [];
  
  rawData.forEach(row => {
    let dateStr = row.数据日期 || row.date || row.日期;
    
    if (!dateStr) {
      const keys = Object.keys(row);
      const dateKey = keys.find(key => 
        key.includes('数据日期') || 
        key.includes('日期') || 
        key.toLowerCase().includes('date')
      );
      if (dateKey) {
        dateStr = row[dateKey];
      }
    }
    
    if (dateStr) {
      const converted = convertExcelDate(dateStr);
      if (converted) {
        allDates.push(converted);
      }
    }
  });
  
  if (allDates.length > 0) {
    // 取最新的日期（字符串排序即可，YYYY-MM-DD 格式天然有序）
    allDates.sort((a, b) => b.localeCompare(a));
    const latestDate = allDates[0];
    return latestDate;
  }
  
  console.warn('未找到有效日期字段，使用今天');
  return new Date().toISOString().split('T')[0];
}
