/**
 * 月度计分 Hook — 独立从 IndexedDB 读取全量数据，逐日计算每月所有中心的六维度得分
 */
import { useState, useEffect } from 'react';
import { parseDate, getMonthDateRange, formatMonth, getDatesInRange } from '../lib/dateUtils';
import { getScoringConfig } from '../lib/dashboardConfig';
import {
  computeDailyScore,
  buildRosterMap,
  matchRosterStats,
  aggregateByCenterDate,
  findCount,
  DailyCounts,
  DimensionScores,
} from '../lib/scoringEngine';
import { idbGetRawData } from '../lib/database';

export interface DailyDetail {
  date: string;
  counts: DailyCounts;
  scores: DimensionScores;
}

export interface CenterMonthlyScore {
  centerName: string;
  province: string;
  monthlyAvg: number;
  dimensionAvgs: { job: number; salary: number; att15: number; att7: number; whHigh: number; whLow: number };
  dataDays: number;
  dailyDetails: DailyDetail[];
  rosterTotal: number;
}

export function useMonthlyScore(monthOffset: number, displayData: any[]) {
  const [data, setData] = useState<CenterMonthlyScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthLabel, setMonthLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        // 1. 并发读取全部 6 种数据类型的全量数据（不受 7 天过滤影响）
        const [jobResult, salaryResult, att15Result, att7Result, rosterResult, whHighResult, whLowResult] =
          await Promise.all([
            idbGetRawData('job_performance'),
            idbGetRawData('salary_performance'),
            idbGetRawData('attendance_15days'),
            idbGetRawData('attendance_7days'),
            idbGetRawData('employee_roster'),
            idbGetRawData('work_hours_high'),
            idbGetRawData('work_hours_low'),
          ]);

        const jobData    = jobResult?.rawData    || [];
        const salaryData = salaryResult?.rawData || [];
        const att15Data  = att15Result?.rawData  || [];
        const att7Data   = att7Result?.rawData   || [];
        const rosterData = rosterResult?.rawData || [];
        const whHighData = whHighResult?.rawData || [];
        const whLowData  = whLowResult?.rawData  || [];

        // 2. 构建 中心→省区 映射（用于反查无省区列的数据）
        const centerToProvince = new Map<string, string>();
        displayData.forEach((province: any) => {
          (province.subCenters || []).forEach((center: any) => {
            if (center.name) centerToProvince.set(center.name, province.province);
          });
        });

        // 3. 构建花名册映射
        const rosterByCenter = buildRosterMap(rosterData);

        // 4. 构建各维度聚合映射（与 useEnrichedData 完全一致）
        const cfg = getScoringConfig();

        // 效能：仅统计偏离 >= 阈值的行
        const jobByCenterDate = aggregateByCenterDate(jobData, row => {
          const deviation = parseFloat(row['目标偏离（%）'] || row.targetDeviation || 0);
          return deviation >= cfg.jobDeviationThreshold;
        });

        // 绩效：统计全部行（每人一行）
        const salaryByCenterDate = new Map<string, number>();
        salaryData.forEach((row: any) => {
          const center = row.中心 || row.中心名称 || '';
          const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
          const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
          const key = `${center}_${province}_${dateStr}`;
          salaryByCenterDate.set(key, (salaryByCenterDate.get(key) || 0) + 1);
        });

        // 连续出勤：>=20 天 / >30 天
        const att15ByCenterDate = new Map<string, number>();
        const att15Over30ByCenterDate = new Map<string, number>();
        att15Data.forEach((row: any) => {
          const days = parseInt(row.连续出勤天数 || 0) || 0;
          if (days < 20) return;
          const center = row.中心 || row.中心名称 || '';
          const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
          const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
          const key = `${center}_${province}_${dateStr}`;
          att15ByCenterDate.set(key, (att15ByCenterDate.get(key) || 0) + 1);
          if (days > 30) att15Over30ByCenterDate.set(key, (att15Over30ByCenterDate.get(key) || 0) + 1);
        });

        // 未出勤：>=7 天
        const att7ByCenterDate = new Map<string, number>();
        att7Data.forEach((row: any) => {
          const days = parseInt(row.连续未出勤天数 || 0) || 0;
          if (days < 7) return;
          const center = row.中心 || row.中心名称 || '';
          const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
          const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
          const key = `${center}_${province}_${dateStr}`;
          att7ByCenterDate.set(key, (att7ByCenterDate.get(key) || 0) + 1);
        });

        // 工时高：全部行
        const whHighByCenterDate = aggregateByCenterDate(whHighData, () => true);

        // 工时低：全部行
        const whLowByCenterDate = aggregateByCenterDate(whLowData, () => true);

        // 5. 获取月份日期范围
        const { first, last } = getMonthDateRange(monthOffset);
        setMonthLabel(formatMonth(monthOffset));
        const dates = getDatesInRange(first, last);

        // 6. 逐中心逐日计算得分
        const results: CenterMonthlyScore[] = [];

        displayData.forEach((province: any) => {
          (province.subCenters || []).forEach((center: any) => {
            const centerName = center.name;
            const provinceName = province.province;
            const rosterStats = matchRosterStats(centerName, provinceName, rosterByCenter);
            const rosterTotal = rosterStats ? rosterStats.total : 0;

            const dailyDetails: DailyDetail[] = [];
            let jobSum = 0, salarySum = 0, att15Sum = 0, att7Sum = 0, whHighSum = 0, whLowSum = 0, totalSum = 0;
            let dataDays = 0;

            dates.forEach(dateStr => {
              if (rosterTotal === 0) return;

              const counts: DailyCounts = {
                date: dateStr,
                jobAbnormal: findCount(jobByCenterDate, centerName, provinceName, dateStr),
                salaryAbnormal: findCount(salaryByCenterDate, centerName, provinceName, dateStr),
                att15Count: findCount(att15ByCenterDate, centerName, provinceName, dateStr),
                att15Over30: findCount(att15Over30ByCenterDate, centerName, provinceName, dateStr),
                att7Count: findCount(att7ByCenterDate, centerName, provinceName, dateStr),
                whHighCount: findCount(whHighByCenterDate, centerName, provinceName, dateStr),
                whLowCount: findCount(whLowByCenterDate, centerName, provinceName, dateStr),
              };

              const scores = computeDailyScore(counts, rosterTotal);
              dailyDetails.push({ date: dateStr, counts, scores });
              jobSum += scores.job;
              salarySum += scores.salary;
              att15Sum += scores.att15;
              att7Sum += scores.att7;
              whHighSum += scores.whHigh;
              whLowSum += scores.whLow;
              totalSum += scores.total;
              dataDays++;
            });

            if (dataDays > 0) {
              results.push({
                centerName,
                province: provinceName,
                monthlyAvg: parseFloat((totalSum / dataDays).toFixed(1)),
                dimensionAvgs: {
                  job: parseFloat((jobSum / dataDays).toFixed(1)),
                  salary: parseFloat((salarySum / dataDays).toFixed(1)),
                  att15: parseFloat((att15Sum / dataDays).toFixed(1)),
                  att7: parseFloat((att7Sum / dataDays).toFixed(1)),
                  whHigh: parseFloat((whHighSum / dataDays).toFixed(1)),
                  whLow: parseFloat((whLowSum / dataDays).toFixed(1)),
                },
                dataDays,
                dailyDetails,
                rosterTotal,
              });
            }
          });
        });

        // 7. 按月均分降序排列
        results.sort((a, b) => b.monthlyAvg - a.monthlyAvg);

        if (!cancelled) setData(results);
      } catch (err) {
        console.error('[useMonthlyScore] 计算失败:', err);
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [monthOffset, displayData]);

  return { data, loading, monthLabel };
}
