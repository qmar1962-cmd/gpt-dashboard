/**
 * 数据处理和转换工具函数
 */

/**
 * 将 Excel 日期序列号转换为 YYYY-MM-DD 格式
 * @param excelDate Excel 日期序列号（如 46136.33383101852）或字符串（如 2026/4/1）
 * @returns YYYY-MM-DD 格式字符串（月和日均补零）
 */
function convertExcelDate(excelDate: any): string {
  // 如果是字符串格式，统一转换为 YYYY-MM-DD 并补零
  if (typeof excelDate === 'string') {
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
  
  // 如果是数字（Excel 序列号）
  if (typeof excelDate === 'number') {
    // 使用 UTC 时间避免时区问题
    const excelStartDate = Date.UTC(1899, 11, 30);
    const date = new Date(excelStartDate + excelDate * 24 * 60 * 60 * 1000);
    
    const utcYear = date.getUTCFullYear();
    const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
    const utcDay = String(date.getUTCDate()).padStart(2, '0');
    
    return `${utcYear}-${utcMonth}-${utcDay}`;
  }
  
  // 其他情况返回空字符串
  return '';
}

/**
 * 构建固定的华中大区数据结构
 * 使用 COUNTIFS 逻辑从数据库中提取数据填充
 * @param rawData 原始上传数据
 * @param dataType 数据类型
 * @param date 数据日期（T-2）
 */
/**
 * 获取北京时间（Asia/Shanghai）的 YYYY-MM-DD 字符串
 * 不受浏览器时区影响，始终返回北京时间
 */
function getBeijingDateString(offsetDays: number = 0): string {
  // 最可靠方式：直接操作时间戳，完全避开 setUTCDate 的边界 bug
  const now = new Date();
  // 北京时间 = UTC + 8h；offsetDays 直接加毫秒数
  const beijingMs = now.getTime() + 8 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000;
  const d = new Date(beijingMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildFixedHuazhongData(rawData: any[], dataType: string, date: string): any[] {
  // T-2 = 今天 - 2天（北京时间基准）
  const t2DateStr = getBeijingDateString(-2);
  const t3DateStr = getBeijingDateString(-3);

  // 默认数据（用于无原始数据时的回退）
  const defaultDataMap = new Map([
    ['hubei-prov', {
      dimensions: {
        salary: { score: 18, metrics: [{ label: '覆盖率', value: '4%' }, { label: '算薪', value: 766 }] },
        attendance15: { score: -8, metrics: [{ label: '触发率', value: '5%' }, { label: '新增', value: 53 }] },
        attendance7: { score: 9, metrics: [{ label: '异常', value: 8 }, { label: '人数', value: 76 }] }
      },
      subCenters: {
        '武汉': { salary: 16, att15: -43, att7: 0, att15Rate: '5%', att15New: 53, att7Abnormal: 8, att7Count: 76 },
        '武昌': { salary: 18, att15: -35, att7: 0, att15Rate: '5%', att15New: 53, att7Abnormal: 8, att7Count: 76 },
        '荆州': { salary: 17, att15: -30, att7: 0, att15Rate: '5%', att15New: 53, att7Abnormal: 8, att7Count: 76 },
        '襄阳': { salary: 17, att15: -25, att7: 0, att15Rate: '5%', att15New: 53, att7Abnormal: 8, att7Count: 76 }
      }
    }],
    ['hunan-prov', {
      dimensions: {
        salary: { score: 17, metrics: [{ label: '覆盖率', value: '4%' }, { label: '算薪', value: 574 }] },
        attendance15: { score: -25, metrics: [{ label: '触发率', value: '8%' }, { label: '新增', value: 36 }] },
        attendance7: { score: 5, metrics: [{ label: '异常', value: 3 }, { label: '人数', value: 45 }] }
      },
      subCenters: {
        '长沙': { salary: 20, att15: -30, att7: 0, att15Rate: '8%', att15New: 36, att7Abnormal: 3, att7Count: 45 },
        '衡阳': { salary: 20, att15: -25, att7: 0, att15Rate: '8%', att15New: 36, att7Abnormal: 3, att7Count: 45 },
        '常德': { salary: 20, att15: -20, att7: 0, att15Rate: '8%', att15New: 36, att7Abnormal: 3, att7Count: 45 }
      }
    }],
    ['henan-prov', {
      dimensions: {
        salary: { score: 16, metrics: [{ label: '人数', value: 18 }, { label: '算薪', value: 520 }] },
        attendance15: { score: -20, metrics: [{ label: '状态', value: '正常' }] },
        attendance7: { score: 3, metrics: [{ label: '异常', value: 2 }] }
      },
      subCenters: {
        '郑州': { salary: 20, att15: -25, att7: 0, att15Rate: '正常', att15New: 0, att7Abnormal: 2, att7Count: 45 },
        '漯河': { salary: 20, att15: -20, att7: 0, att15Rate: '正常', att15New: 0, att7Abnormal: 2, att7Count: 45 },
        '新乡': { salary: 20, att15: -18, att7: 0, att15Rate: '正常', att15New: 0, att7Abnormal: 2, att7Count: 45 },
        '商丘': { salary: 20, att15: -15, att7: 0, att15Rate: '正常', att15New: 0, att7Abnormal: 2, att7Count: 45 }
      }
    }],
    ['jiangxi-prov', {
      dimensions: {
        salary: { score: 15, metrics: [{ label: '人数', value: 15 }, { label: '算薪', value: 480 }] },
        attendance15: { score: -18, metrics: [{ label: '状态', value: '正常' }] },
        attendance7: { score: 2, metrics: [{ label: '异常', value: 1 }] }
      },
      subCenters: {
        '南昌': { salary: 20, att15: -20, att7: 0, att15Rate: '正常', att15New: 0, att7Abnormal: 1, att7Count: 45 },
        '赣州': { salary: 20, att15: -18, att7: 0, att15Rate: '正常', att15New: 0, att7Abnormal: 1, att7Count: 45 },
        '横峰': { salary: 20, att15: -15, att7: 0, att15Rate: '正常', att15New: 0, att7Abnormal: 1, att7Count: 45 }
      }
    }]
  ]);

  // 华中大区固定结构（使用数据文件中的实际名称）
  const huazhongStructure = [
    {
      id: 'hubei-prov',
      province: '湖北',
      responsible: '刘洋',
      centers: [
        { id: 'hb-1', name: '武汉', responsible: '臧英英' },
        { id: 'hb-2', name: '武昌', responsible: '万政' },
        { id: 'hb-3', name: '荆州', responsible: '刘志' },
        { id: 'hb-4', name: '襄阳', responsible: '李成程' }
      ]
    },
    {
      id: 'hunan-prov',
      province: '湖南',
      responsible: '陈缘杰',
      centers: [
        { id: 'hn-1', name: '长沙', responsible: '陈缘杰' },
        { id: 'hn-2', name: '衡阳', responsible: '杨清宇' },
        { id: 'hn-3', name: '常德', responsible: '张检' }
      ]
    },
    {
      id: 'henan-prov',
      province: '河南',
      responsible: '张晨',
      centers: [
        { id: 'he-1', name: '郑州', responsible: '李晓文' },
        { id: 'he-2', name: '漯河', responsible: '杨蒙蒙' },
        { id: 'he-3', name: '新乡', responsible: '谢海鹏' },
        { id: 'he-4', name: '商丘', responsible: '靳紫阳' }
      ]
    },
    {
      id: 'jiangxi-prov',
      province: '江西',
      responsible: '-',
      centers: [
        { id: 'jx-1', name: '南昌', responsible: '程傲坤' },
        { id: 'jx-2', name: '赣州', responsible: '刘鸿逸' },
        { id: 'jx-3', name: '横峰', responsible: '张鹏程' }
      ]
    }
  ];

  // 根据不同的数据类型，使用 COUNTIFS 逻辑提取数据
  const result: any[] = [];

  huazhongStructure.forEach(provData => {
    const provinceData: any = {
      id: provData.id,
      province: provData.province,
      responsible: provData.responsible,
      performanceScore: 0,
      ranking: 0,
      totalScore: 0,
      dimensions: {
        job: { name: '效能异常', score: 0, weight: 25, metrics: [] },
        salary: { name: '绩效异常', score: 0, weight: 25, metrics: [] },
        attendance15: { name: '连续出勤', score: 0, weight: 25, metrics: [] },
        attendance7: { name: '长期未出勤', score: 0, weight: 25, metrics: [] }
      },
      subCenters: []
    };

    // 获取默认数据用于回退（必须在 forEach 之前声明，避免暂时性死区）
    const defaults = defaultDataMap.get(provData.id);

    // 处理中心数据
    provData.centers.forEach(center => {
      const centerData: any = {
        id: center.id,
        name: center.name,
        responsible: center.responsible,
        score: 0,
        metrics: { job: 0, salary: 0, att15: 0, att7: 0 }
      };

      // 使用 COUNTIFS 逻辑从 rawData 中提取 T-2 数据（当天）- 实际数据未上传，所以应该是 0
      // 条件：省区 包含 当前省区(模糊匹配) AND 中心 = 当前中心 AND 数据日期 = T-2 日期
      const t2Data = rawData.filter(row => {
        const rowProvince = row.省区 || row.province;
        const rowCenter = row.中心 || row.center;
        const rawRowDate = row.数据日期 || row.date || row.日期;
        const rowDate = convertExcelDate(rawRowDate);
        
        return rowProvince.includes(provData.province) && 
               rowCenter === center.name && 
               rowDate === t2DateStr;
      });

      // 使用 COUNTIFS 逻辑从 rawData 中提取 T-3 数据（前一天）- 上传的数据
      const t3Data = rawData.filter(row => {
        const rowProvince = row.省区 || row.province;
        const rowCenter = row.中心 || row.center;
        const rawRowDate = row.数据日期 || row.date || row.日期;
        const rowDate = convertExcelDate(rawRowDate);
        
        return rowProvince.includes(provData.province) && 
               rowCenter === center.name && 
               rowDate === t3DateStr;
      });

      // 获取该中心默认值
      const centerDefaults = defaults?.subCenters?.[center.name];

      // 根据不同的数据类型计算指标
      if (dataType === 'job_performance' || t2Data.length > 0 || t3Data.length > 0) {
        // 岗位效能异常：统计目标偏离 >= 10 的个数
        // T-2（当天）的异常个数 - 数据未上传，应该是 0
        const abnormalCount = t2Data.filter(row => {
          const targetDeviation = parseFloat(row['目标偏离（%）'] || row.targetDeviation || 0);
          return targetDeviation >= 10;
        }).length;

        // T-3（前一天）的异常个数 - 上传的数据
        const prevAbnormalCount = t3Data.filter(row => {
          const targetDeviation = parseFloat(row['目标偏离（%）'] || row.targetDeviation || 0);
          return targetDeviation >= 10;
        }).length;

        // 计算得分：25 分满分，每个异常扣 5 分，最低 0 分
        const score = Math.max(0, 25 - abnormalCount * 5);
        centerData.metrics.job = score;
        centerData.score += score;
        
        // 存储异常个数，用于省区维度显示
        centerData.abnormalCount = abnormalCount;
        centerData.prevAbnormalCount = prevAbnormalCount;
      }

      // 默认值不再参与 score 计算（各维度实际得分由 App.tsx enrichedData 根据真实上传数据计算）
      if (centerDefaults) {
        // 所有维度 metrics 重置为 0（无真实数据时不残留默认值）
        centerData.metrics.salary = 0;
        centerData.metrics.att15 = 0;
        centerData.metrics.att7 = 0;

        // 展示字段也重置为 0（由 enrichedData 在有真实数据时覆盖）
        centerData.att15Rate = '0%';
        centerData.att15New = 0;
        centerData.att7Abnormal = 0;
        centerData.att7Count = 0;
      }

      provinceData.subCenters.push(centerData);
    });

    // 计算省区总分：各中心总分的平均数，取整数
    const avgTotalScore = provinceData.subCenters.length > 0
      ? Math.round(provinceData.subCenters.reduce((sum, center) => sum + center.score, 0) / provinceData.subCenters.length)
      : 0;
    provinceData.totalScore = avgTotalScore;
    
    // 计算省区各项指标的平均分
    if (provinceData.subCenters.length > 0) {
      const avgJobScore = provinceData.subCenters.reduce((sum, c) => sum + c.metrics.job, 0) / provinceData.subCenters.length;
      const totalAbnormalCount = provinceData.subCenters.reduce((sum, c) => sum + (c.abnormalCount || 0), 0);
      const totalPrevAbnormalCount = provinceData.subCenters.reduce((sum, c) => sum + (c.prevAbnormalCount || 0), 0);
      
      provinceData.dimensions.job.score = Math.round(avgJobScore);
      provinceData.dimensions.job.metrics = [
        { label: '前一天', value: totalPrevAbnormalCount },  // T-3 的异常个数
        { label: '个数', value: totalAbnormalCount }  // T-2 的异常个数
      ];
      
      // 各维度（salary / attendance15 / attendance7）的实际得分和 metrics
      // 由 App.tsx 的 enrichedData 根据真实上传数据计算；此处无原始数据时不填充默认值
      // 以避免未上传数据的维度影响总分和展示
    }

    result.push(provinceData);
  });

  // 计算排名
  result.sort((a, b) => b.totalScore - a.totalScore);
  result.forEach((item, index) => {
    item.ranking = index + 1;
    item.performanceScore = item.totalScore; // 绩效得分 = 总分
  });

  return result;
}

/**
 * 提取指定中心近一周的效能异常明细
 * 以现实日期 T-2（今天 - 2天）为基准，展示前7天（含T-2当天）
 * 若某天数据未上传则显示为空（0 个异常）
 */
export function getWeeklyEfficiencyDetail(
  rawData: any[],
  centerName: string,
  provinceName: string
): WeeklyDetail[] {
  if (!rawData || rawData.length === 0) return [];

  // 从数据中提取所有日期，取最新日期作为 T-2 基准（兼容历史数据）
  const allDates = rawData.map(row => {
    const rawDate = row.数据日期 || row.date || row.日期;
    return convertExcelDate(rawDate);
  }).filter(d => d).sort((a, b) => b.localeCompare(a));
  
  // T-2 = 今天 - 2天（北京时间基准，和 App.tsx / 薪资异常保持一致）
  const now = new Date();
  const beijingMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 24 * 60 * 60 * 1000;
  const t2 = new Date(beijingMs);

  // 展示 T-2 前7天（含T-2当天），即 T-8 ~ T-2
  const days: WeeklyDetail[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t2);
    d.setUTCDate(t2.getUTCDate() - i);
    // UTC 日期字符串 YYYY-MM-DD（与 convertExcelDate 输出保持一致）
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // 筛选该中心该天的数据
    const rows = rawData.filter(row => {
      const rowProvince = row.省区 || row.province || '';
      const rowCenter = row.中心 || row.center || '';
      const rawDate = row.数据日期 || row.date || row.日期;
      const rowDate = convertExcelDate(rawDate);
      return (
        rowProvince.includes(provinceName) &&
        rowCenter.includes(centerName) &&
        rowDate === dateStr
      );
    });

    // 筛选目标偏离 >= 10 的异常岗位
    const abnormalRows = rows.filter(row => {
      const deviation = parseFloat(row['目标偏离（%）'] || row.targetDeviation || 0);
      return deviation >= 10;
    });

    // 提取每个异常岗位的详细信息
    const details = abnormalRows.map(row => ({
      jobName: row['岗位名称'] || row.jobName || row['岗位'] || '未知岗位',
      actualValue: parseFloat(row['当月人均日绩效'] || row.actualValue || 0),
      targetValue: parseFloat(row['目标值'] || row.targetValue || 0),
      deviation: parseFloat(row['目标偏离（%）'] || row.targetDeviation || 0),
      avgValue: parseFloat(row['全网同岗均值'] || row.avgValue || 0),
      avgDeviation: parseFloat(row['均值偏离（%）'] || row.avgDeviation || 0),
    }));

    // 格式化日期为 MM/DD（UTC，即北京时间）
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dateLabel = `${month}/${day}`;

    days.push({
      date: dateStr,
      dateLabel,
      total: rows.length,
      abnormalCount: abnormalRows.length,
      details,
    });
  }

  return days;
}

export interface WeeklyDetail {
  date: string;        // YYYY-MM-DD
  dateLabel: string;   // M/D
  total: number;       // 当天该中心总行数
  abnormalCount: number; // 异常行数（偏离>=10）
  details: {           // 异常岗位明细
    jobName: string;
    actualValue: number;
    targetValue: number;
    deviation: number;
    avgValue: number;
    avgDeviation: number;
  }[];
}

/**
 * 将 Excel 日期序列号转换为 YYYY-MM-DD 字符串
 * Excel 日期起点为 1900-01-01（序列号1），但有一个闰年 bug 导致序列号 1 = 1900-01-01
 */
function excelSerialToDateStr(serial: number): string | null {
  if (!serial || isNaN(serial) || serial < 1) return null;
  // Excel 序列号转 JS Date：起点 1899-12-30（修正 Excel 的闰年 bug）
  const epoch = new Date(1899, 11, 30); // 1899-12-30
  const date = new Date(epoch.getTime() + serial * 86400000);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 将薪资数据中的日期字段统一转换为 YYYY-MM-DD 格式
 * 支持多种输入格式：Excel 序列号、YYYY/MM/DD、YYYY-MM-DD、YYYYMMDD
 */
function normalizeSalaryDate(rawValue: any): string {
  if (typeof rawValue === 'number') {
    const result = excelSerialToDateStr(rawValue);
    return result || '';
  }
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    // 纯数字字符串可能是 Excel 序列号
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const result = excelSerialToDateStr(parseFloat(trimmed));
      return result || trimmed;
    }
    // YYYY/MM/DD 或 YYYY-MM-DD
    return trimmed.replace(/\//g, '-');
  }
  return '';
}

/**
 * 提取指定中心近一周的绩效异常（工资偏高）人员明细
 * 以现实日期 T-2（今天 - 2天）为基准，展示前7天（含T-2当天）
 * salaryData 中每一行本身就是异常记录
 * attendanceData 用于计算算薪人数和覆盖率
 */
export function getWeeklySalaryDetail(
  salaryData: any[],
  centerName: string,
  provinceName: string,
  attendanceData?: any[]
): SalaryWeeklyDetail[] {
  if (!salaryData || salaryData.length === 0) return [];

  // 预处理：将每行的数据日期转换为 YYYY-MM-DD
  const normalized = salaryData.map(row => ({
    ...row,
    _dateStr: normalizeSalaryDate(row['数据日期'] || row.date || row.日期),
  }));

  // 预处理出勤数据：筛选"中心操作"部门，按中心+日期聚合出勤人数
  const attendanceMap = new Map<string, { attendanceCount: number; salaryCount: number }>();
  if (attendanceData && attendanceData.length > 0) {
    // 先收集所有匹配的行（可能有多行对应同一日期，需聚合）
    const dateCountMap = new Map<string, number>();
    let matchCount = 0;
    attendanceData.forEach(row => {
      const dept = row.部门名称 || row.部门 || row.department || '';
      if (!dept.includes('中心操作')) return; // 只取"中心操作"部门
      
      const province = row.省区名称 || row.省区 || row.province || '';
      const center = row.中心名称 || row.中心 || row.center || '';
      const dateStr = normalizeSalaryDate(row.日期 || row.数据日期 || row.date);
      const centerMatch = center.includes(centerName) || centerName.includes(center);
      const normProv = province.replace(/区$/, '');
      const normProvName = provinceName.replace(/区$/, '');
      const provinceMatch = province.includes(provinceName) || provinceName.includes(province) || normProv === normProvName;
      if (dateStr && centerMatch && provinceMatch) {
        const count = parseInt(row.出勤人数 || 0) || 0;
        const existing = dateCountMap.get(dateStr) || 0;
        dateCountMap.set(dateStr, existing + count);
        matchCount++;
      }
    });
    // 转换为最终索引（算薪人数 = 出勤人数 × 1.12）
    dateCountMap.forEach((totalCount, dateStr) => {
      attendanceMap.set(dateStr, { attendanceCount: totalCount, salaryCount: Math.round(totalCount * 1.12) });
    });
  }

  // T-2 = 今天往前推 2 天（北京时间基准）
  const now = new Date();
  const beijingMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 24 * 60 * 60 * 1000;
  const t2 = new Date(beijingMs);

  const days: SalaryWeeklyDetail[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t2);
    d.setUTCDate(t2.getUTCDate() - i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // 筛选该中心该天的数据（模糊匹配：数据中可能带"区"/"中心"后缀）
    const rows = normalized.filter(row => {
      const rowProvince = row.省区 || row.省区名称 || '';
      const rowCenter = row.中心 || row.中心名称 || '';
      const centerMatch = rowCenter.includes(centerName) || centerName.includes(rowCenter);
      const normRowProv = rowProvince.replace(/区$/, '');
      const normProv = provinceName.replace(/区$/, '');
      const provinceMatch = rowProvince.includes(provinceName) || provinceName.includes(rowProvince) || normRowProv === normProv;
      return provinceMatch && centerMatch && row._dateStr === dateStr;
    });

    // 每行都是异常记录，直接提取明细
    const details = rows.map(row => ({
      name: row.姓名 || '',
      jobName: row.岗位 || '',
      attendanceCoeff: parseFloat(row.出勤系数 || 0),
      dailySalary: parseFloat(row.个人平均日薪 || 0),
      jobAvgSalary: parseFloat(row.岗位上月均值 || 0),
      avgDeviation: parseFloat(row['均值偏离（%）'] || 0),
    }));

    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dateLabel = `${month}/${day}`;

    // 每天用各自日期的算薪人数计算覆盖率
    const attendance = attendanceMap.get(dateStr);
    const attendanceCount = attendance?.attendanceCount;
    const salaryCount = attendance?.salaryCount;
    const coverageRate = salaryCount && salaryCount > 0 
      ? parseFloat(((rows.length / salaryCount) * 100).toFixed(1)) 
      : undefined;

    days.push({
      date: dateStr,
      dateLabel,
      abnormalCount: rows.length,
      attendanceCount,
      salaryCount,
      coverageRate,
      details,
    });
  }

  return days;
}

export interface SalaryWeeklyDetail {
  date: string;
  dateLabel: string;
  abnormalCount: number;
  attendanceCount?: number;   // 中心出勤人数
  salaryCount?: number;       // 算薪人数（出勤人数×1.12）
  coverageRate?: number;      // 覆盖率（异常人数/算薪人数）
  details: {
    name: string;
    jobName: string;
    attendanceCoeff: number;
    dailySalary: number;
    jobAvgSalary: number;
    avgDeviation: number;
  }[];
}

export interface Attendance15WeeklyDetail {
  date: string;
  dateLabel: string;
  abnormalCount: number; // 连续出勤 ≥15 天的人数
  details: {
    name: string;
    jobName: string;
    continuousDays: number;
    employeeId: string; // 工号（用于排休计划全局匹配）
  }[];
}

/**
 * 提取指定中心近一周的连续15日出勤明细
 * 以现实日期 T-2（今天 - 2天）为基准，展示前7天（含T-2当天）
 */
export function getWeeklyAttendance15Detail(
  attendance15Data: any[],
  centerName: string,
  provinceName: string
): Attendance15WeeklyDetail[] {
  if (!attendance15Data || attendance15Data.length === 0) return [];

  const normalized = attendance15Data.map(row => ({
    ...row,
    _dateStr: normalizeSalaryDate(row['数据日期'] || row.date || row.日期),
  }));

  const now = new Date();
  const beijingMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 24 * 60 * 60 * 1000;
  const t2 = new Date(beijingMs);

  const days: Attendance15WeeklyDetail[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t2);
    d.setUTCDate(t2.getUTCDate() - i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const rows = normalized.filter(row => {
      const rowProvince = row.省区 || row.省区名称 || '';
      const rowCenter = row.中心 || row.中心名称 || '';
      const days = parseInt(row.连续出勤天数 || 0) || 0;
      const centerMatch = rowCenter.includes(centerName) || centerName.includes(rowCenter);
      const normRowProv = rowProvince.replace(/区$/, '');
      const normProv = provinceName.replace(/区$/, '');
      const provinceMatch = rowProvince.includes(provinceName) || provinceName.includes(rowProvince) || normRowProv === normProv;
      return provinceMatch && centerMatch && row._dateStr === dateStr && days >= 15;
    });

    const details = rows.map(row => ({
      name: row.姓名 || '',
      jobName: row.岗位 || '',
      continuousDays: parseInt(row.连续出勤天数 || 0) || 0,
      employeeId: String(row.工号 || row['员工编号'] || '').trim(),
    }));

    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dateLabel = `${month}/${day}`;

    days.push({
      date: dateStr,
      dateLabel,
      abnormalCount: rows.length,
      details,
    });
  }

  return days;
}

export interface Attendance7WeeklyDetail {
  date: string;
  dateLabel: string;
  abnormalCount: number; // 连续未出勤 ≥7 天的人数
  details: {
    name: string;
    jobName: string;
    continuousDays: number;
    employeeId: string; // 工号（用于未出勤原因全局匹配）
  }[];
}

/**
 * 提取指定中心近一周的连续7日未出勤明细
 * 以现实日期 T-2（今天 - 2天）为基准，展示前7天（含T-2当天）
 */
export function getWeeklyAttendance7Detail(
  attendance7Data: any[],
  centerName: string,
  provinceName: string
): Attendance7WeeklyDetail[] {
  if (!attendance7Data || attendance7Data.length === 0) return [];

  const normalized = attendance7Data.map(row => ({
    ...row,
    _dateStr: normalizeSalaryDate(row['数据日期'] || row.date || row.日期),
  }));

  const now = new Date();
  const beijingMs = now.getTime() + 8 * 60 * 60 * 1000 - 2 * 24 * 60 * 60 * 1000;
  const t2 = new Date(beijingMs);

  const days: Attendance7WeeklyDetail[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(t2);
    d.setUTCDate(t2.getUTCDate() - i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const rows = normalized.filter(row => {
      const rowProvince = row.省区 || row.省区名称 || '';
      const rowCenter = row.中心 || row.中心名称 || '';
      const days = parseInt(row.连续未出勤天数 || 0) || 0;
      const centerMatch = rowCenter.includes(centerName) || centerName.includes(rowCenter);
      const normRowProv = rowProvince.replace(/区$/, '');
      const normProv = provinceName.replace(/区$/, '');
      const provinceMatch = rowProvince.includes(provinceName) || provinceName.includes(rowProvince) || normRowProv === normProv;
      return provinceMatch && centerMatch && row._dateStr === dateStr && days >= 7;
    });

    const details = rows.map(row => ({
      name: row.姓名 || '',
      jobName: row.岗位 || '',
      continuousDays: parseInt(row.连续未出勤天数 || 0) || 0,
      employeeId: String(row.工号 || row['员工编号'] || '').trim(),
    }));

    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dateLabel = `${month}/${day}`;

    days.push({
      date: dateStr,
      dateLabel,
      abnormalCount: rows.length,
      details,
    });
  }

  return days;
}
