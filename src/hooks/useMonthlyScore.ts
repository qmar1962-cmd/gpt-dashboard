/**
 * 月度计分 Hook — 按用户给定口径：滚动累计 / 日均 / 去重计数
 */
import { useState, useEffect } from 'react';
import { parseDate, getMonthDateRange, formatMonth, getDatesInRange } from '../lib/dateUtils';
import { getScoringConfig } from '../lib/dashboardConfig';
import {
  computeMonthlyScore,
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
  monthlyScore: number;
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

        const centerToProvince = new Map<string, string>();
        displayData.forEach((province: any) => {
          (province.subCenters || []).forEach((center: any) => {
            if (center.name) centerToProvince.set(center.name, province.province);
          });
        });

        const rosterByCenter = buildRosterMap(rosterData);
        const cfg = getScoringConfig();

        // 效能：仅统计偏离 >= 阈值
        const jobByCenterDate = aggregateByCenterDate(jobData, row => {
          const deviation = parseFloat(row['目标偏离（%）'] || row.targetDeviation || 0);
          return deviation >= cfg.jobDeviationThreshold;
        });

        // 绩效：每人一行
        const salaryByCenterDate = new Map<string, number>();
        salaryData.forEach((row: any) => {
          const center = row.中心 || row.中心名称 || '';
          const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
          const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
          const key = `${center}_${province}_${dateStr}`;
          salaryByCenterDate.set(key, (salaryByCenterDate.get(key) || 0) + 1);
        });

        // 连续出勤：≥20 天 / >30 天
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

        // 未出勤：≥15 天（月度口径，每日人次合计不去重）
        const att7ByCenterDate = new Map<string, number>();
        att7Data.forEach((row: any) => {
          const days = parseInt(row.连续未出勤天数 || 0) || 0;
          if (days < 15) return;
          const center = row.中心 || row.中心名称 || '';
          const province = row.省区 || row.省区名称 || centerToProvince.get(center) || '';
          const dateStr = parseDate(row['数据日期'] || row.date || row.日期);
          const key = `${center}_${province}_${dateStr}`;
          att7ByCenterDate.set(key, (att7ByCenterDate.get(key) || 0) + 1);
        });

        const whHighByCenterDate = aggregateByCenterDate(whHighData, () => true);
        const whLowByCenterDate = aggregateByCenterDate(whLowData, () => true);

        const { first, last } = getMonthDateRange(monthOffset);
        setMonthLabel(formatMonth(monthOffset));
        const dates = getDatesInRange(first, last);

        const results: CenterMonthlyScore[] = [];

        displayData.forEach((province: any) => {
          (province.subCenters || []).forEach((center: any) => {
            const centerName = center.name;
            const provinceName = province.province;
            const rosterStats = matchRosterStats(centerName, provinceName, rosterByCenter);
            const rosterTotal = rosterStats ? rosterStats.total : 1;

            const dailyDetails: DailyDetail[] = [];
            let att15Sum = 0, att15O30Sum = 0;
            let att7Sum = 0, whHighSum = 0, whLowSum = 0;
            let lastDayJob = 0, lastDaySalary = 0;
            let dataDays = 0;
            const lastDate = dates.length > 0 ? dates[dates.length - 1] : '';

            dates.forEach(dateStr => {
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

              // 当日得分（明细展示用）
              const dailyScore = {
                job: Math.max(0, 25 - counts.jobAbnormal * 5),
                salary: (() => {
                  const rate = rosterTotal > 0 ? (counts.salaryAbnormal / rosterTotal) * 100 : 0;
                  return rate <= 3 ? 15 : Math.max(0, 15 - Math.round((rate - 3) * 3));
                })(),
                att15: (() => {
                  const rate = rosterTotal > 0 ? (counts.att15Count / rosterTotal) * 100 : 0;
                  const ded = rate <= 3 ? 0 : Math.round((rate - 3) * 5);
                  return Math.max(0, 25 - ded - counts.att15Over30 * 2);
                })(),
                att7: Math.max(0, 25 - counts.att7Count * 2),
                whHigh: (() => {
                  const rate = rosterTotal > 0 ? (counts.whHighCount / rosterTotal) * 100 : 0;
                  return rate <= 10 ? 5 : Math.max(0, 5 - Math.round(rate - 10));
                })(),
                whLow: Math.max(0, 5 - counts.whLowCount),
              };
              const dailyTotal = dailyScore.job + dailyScore.salary + dailyScore.att15 + dailyScore.att7 + dailyScore.whHigh + dailyScore.whLow;
              const dailyDimScores: DimensionScores = { ...dailyScore, total: dailyTotal };

              dailyDetails.push({ date: dateStr, counts, scores: dailyDimScores });
              // 最后一天数据（效能+绩效用）
              if (dateStr === lastDate) {
                lastDayJob = counts.jobAbnormal;
                lastDaySalary = counts.salaryAbnormal;
              }
              att15Sum += counts.att15Count;
              att15O30Sum += counts.att15Over30;
              att7Sum += counts.att7Count;
              whHighSum += counts.whHighCount;
              whLowSum += counts.whLowCount;
              dataDays++;
            });

            if (dataDays > 0) {
              const days = dataDays || 1;
              const monthlyScores = computeMonthlyScore(
                lastDayJob,          // 月底最后一天异常岗位数
                lastDaySalary,       // 月底最后一天绩效触发人数
                att15Sum / days,     // 日均连续出勤触发人数
                att15O30Sum,         // 全月超30天总人次
                att7Sum,             // 每日≥15天人次合计(不去重)
                whHighSum / days,    // 日均工时高人数
                whLowSum,            // 每日工时低人次合计(不去重)
                rosterTotal,
                dataDays,
              );

              results.push({
                centerName,
                province: provinceName,
                monthlyScore: monthlyScores.total,
                dimensionAvgs: {
                  job: monthlyScores.job,
                  salary: monthlyScores.salary,
                  att15: monthlyScores.att15,
                  att7: monthlyScores.att7,
                  whHigh: monthlyScores.whHigh,
                  whLow: monthlyScores.whLow,
                },
                dataDays,
                dailyDetails,
                rosterTotal,
              });
            }
          });
        });

        results.sort((a, b) => b.monthlyScore - a.monthlyScore);

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
