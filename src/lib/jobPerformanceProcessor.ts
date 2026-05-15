/**
 * 岗位效能异常数据处理服务
 * 聚合逻辑：按日期 + 省区 + 中心统计异常个数（目标偏离 >= 10）
 * 使用 COUNTIFS 逻辑：统计同时满足多个条件的行数
 * 得分计算：25 分满分，每个异常扣 5 分，最低 0 分
 */

import { JobPerformanceData, JobData } from '../types/data';

// 华中大区省区列表
const HUAZHONG_PROVINCES = ['湖北区', '湖南区', '河南区', '江西区'];

/**
 * 计算效能异常得分
 * 规则：25 分满分，每出现 1 个异常扣 5 分，最低 0 分
 */
export function calculateJobPerformanceScore(abnormalCount: number): number {
  const score = 25 - abnormalCount * 5;
  return Math.max(0, score);
}

/**
 * 将 Excel 日期序列号转换为 YYYY-MM-DD 格式
 */
function convertExcelDate(excelDate: any): string {
  if (typeof excelDate === 'string') {
    // 统一将斜杠替换为横线
    const normalized = excelDate.replace(/\//g, '-');
    // 处理 YYYY-M-D 或 YYYY-MM-D 或 YYYY-M-DD 格式，补零为 YYYY-MM-DD
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
 * 从原始数据中统计异常个数（COUNTIFS 逻辑）
 * 条件：
 *  1. 日期 = 指定日期
 *  2. 省区 = 指定省区
 *  3. 中心 = 指定中心
 *  4. 目标偏离 >= 10
 */
export function countAbnormalJobsByCountifs(
  rawData: any[], 
  targetDate: string,
  targetProvince: string,
  targetCenter: string
): number {
  let count = 0;
  
  rawData.forEach((row) => {
    const rawDate = row.数据日期 || row.date || row.日期;
    const date = convertExcelDate(rawDate);
    const province = row.省区 || row.province || row.省区名称 || '';
    const center = row.中心 || row.center || row.中心名称 || '';
    const targetDeviation = parseFloat(row['目标偏离（%）'] || row.targetDeviation || row['目标偏离'] || 0);
    
    // COUNTIFS 逻辑：同时满足所有条件
    // 中心匹配使用 includes（兼容 "武汉中心-收派" 等格式）
    if (
      date === targetDate &&
      province.includes(targetProvince) &&
      center.includes(targetCenter) &&
      targetDeviation >= 10
    ) {
      count++;
    }
  });
  
  return count;
}

/**
 * 按日期聚合数据（使用 COUNTIFS 逻辑）
 * 返回：{ 日期：{ 省区_中心：异常个数 } }
 */
export function groupByDateWithCountifs(rawData: any[]): Record<string, Record<string, number>> {
  const dateCenterCount: Record<string, Record<string, number>> = {};
  
  // 获取所有唯一日期
  const uniqueDates = [...new Set(rawData.map(row => {
    const rawDate = row.数据日期 || row.date || row.日期;
    return convertExcelDate(rawDate);
  }))];
  
  // 华中大区省区和中心列表（使用模糊匹配关键词）
  const huaZhongCenters = [
    { province: '湖北', centers: ['武汉', '武昌', '荆州', '襄阳'] },
    { province: '湖南', centers: ['长沙', '衡阳', '常德'] },
    { province: '河南', centers: ['郑州', '漯河', '新乡', '商丘'] },
    { province: '江西', centers: ['南昌', '赣州', '横峰'] }
  ];
  
  // 对每个日期、每个省区、每个中心使用 COUNTIFS 统计
  uniqueDates.forEach(date => {
    dateCenterCount[date] = {};
    
    huaZhongCenters.forEach(({ province, centers }) => {
      centers.forEach(center => {
        const count = countAbnormalJobsByCountifs(rawData, date, province, center);
        if (count > 0) {
          const centerKey = `${province}_${center}`;
          dateCenterCount[date][centerKey] = count;
        }
      });
    });
  });
  
  return dateCenterCount;
}

/**
 * 获取指定日期的前一天数据
 * @param dateCenterCount 按日期聚合的数据
 * @param currentDate 当前日期（格式：YYYY-MM-DD）
 * @param daysBack 往前推几天（默认 1，即 T-1）
 */
export function getPreviousDayData(
  dateCenterCount: Record<string, Record<string, number>>, 
  currentDate: string,
  daysBack: number = 1
): Record<string, number> {
  const date = new Date(currentDate);
  date.setDate(date.getDate() - daysBack);
  const previousDate = date.toISOString().split('T')[0];
  
  return dateCenterCount[previousDate] || {};
}

/**
 * 按省区汇总中心数据
 * @param centerCount 中心统计数据 {省区_中心：个数}
 * @returns {省区：个数}
 */
export function aggregateByProvince(centerCount: Record<string, number>): Record<string, number> {
  const provinceCount: Record<string, number> = {};
  
  Object.entries(centerCount).forEach(([key, count]) => {
    const [province] = key.split('_');
    
    if (!provinceCount[province]) {
      provinceCount[province] = 0;
    }
    
    provinceCount[province] += count;
  });
  
  return provinceCount;
}

/**
 * 生成岗位效能数据（包含聚合和得分计算）
 * 只统计华中大区数据
 */
export function generateJobPerformanceData(
  rawData: any[],
  date: string
): JobPerformanceData[] {
  // 使用 COUNTIFS 逻辑按日期聚合所有数据
  const dateCenterCount = groupByDateWithCountifs(rawData);
  
  // 获取当前日期的数据
  const currentCenterCount = dateCenterCount[date] || {};
  
  // 获取前一天（T-1）的数据
  const previousDayCount = getPreviousDayData(dateCenterCount, date, 1);
  
  // 按省区汇总
  const currentProvinceCount = aggregateByProvince(currentCenterCount);
  const previousDayProvinceCount = aggregateByProvince(previousDayCount);
  
  // 生成中心数据
  const centerDataMap = new Map<string, JobPerformanceData>();
  
  // 处理所有省区 - 中心
  Object.entries(currentCenterCount).forEach(([centerKey, count]) => {
    const [province, center] = centerKey.split('_');
    const centerId = `${province.toLowerCase()}-${center.toLowerCase()}`;
    
    // 计算得分
    const score = calculateJobPerformanceScore(count);
    
    // 获取前一天的数据
    const prevCount = previousDayCount[centerKey] || 0;
    
    centerDataMap.set(centerId, {
      id: centerId,
      province,
      center,
      date,
      dataType: 'job_performance',
      uploadTime: Date.now(),
      jobs: [], // 这里留空，因为我们是聚合数据，不是明细
      abnormalCount: count,
      previousDayCount: prevCount,
      score: score,
      maxScore: 25
    } as any);
  });
  
  return Array.from(centerDataMap.values());
}

/**
 * 计算省区级别的效能数据
 */
export function calculateProvinceJobPerformance(
  centerDataList: JobPerformanceData[]
): Record<string, { 
  province: string;
  abnormalCount: number;
  previousDayCount: number;
  score: number;
}> {
  const provinceData: Record<string, any> = {};
  
  centerDataList.forEach((centerData) => {
    const { province, abnormalCount, previousDayCount } = centerData as any;
    
    if (!provinceData[province]) {
      provinceData[province] = {
        province,
        abnormalCount: 0,
        previousDayCount: 0
      };
    }
    
    provinceData[province].abnormalCount += abnormalCount;
    provinceData[province].previousDayCount += previousDayCount;
  });
  
  // 计算省区得分
  Object.values(provinceData).forEach((data: any) => {
    data.score = calculateJobPerformanceScore(data.abnormalCount);
  });
  
  return provinceData;
}
