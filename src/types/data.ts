/**
 * 数据类型定义 - 6 种数据模板
 */

// 数据类型枚举
export type DataType = 
  | 'job_performance'      // 岗位效能异常
  | 'salary_performance'   // 薪资绩效异常
  | 'attendance_15days'    // 连续 15 日出勤
  | 'attendance_7days'     // 七日未出勤
  | 'employee_roster'      // 中心在职花名册
  | 'center_daily_attendance'; // 中心日出勤明细（个人当天是否出勤）

// 基础中心数据结构
export interface BaseCenterData {
  id: string;              // 中心 ID
  province: string;        // 省区
  center: string;          // 中心名称
  date: string;            // 数据日期
  uploadTime: number;      // 上传时间戳
}

// 1. 岗位效能异常数据
export interface JobPerformanceData extends BaseCenterData {
  dataType: 'job_performance';
  jobs: JobData[];
  // 聚合字段
  abnormalCount?: number;      // 异常个数（目标偏离 >= 10）
  previousDayCount?: number;   // 前一天异常个数
  score?: number;              // 得分（25 分满分，每个扣 5 分）
  maxScore?: number;           // 满分（25）
}

export interface JobData {
  jobName: string;         // 岗位名称：卸车/装车/倒包/供件/封包/分拣/扫描
  target: number;          // 目标值
  actual: number;          // 当月人均日绩效
  targetDeviation: number; // 目标偏离（%）
  networkAvg?: number;     // 全网同岗均值
  networkDeviation?: number; // 均值偏离（%）
}

// 2. 薪资绩效异常数据
export interface SalaryPerformanceData extends BaseCenterData {
  dataType: 'salary_performance';
  coverage: number;        // 覆盖率
  affectedCount: number;   // 影响人数
  salaryAmount?: number;   // 算薪金额
  abnormalRate?: number;   // 异常率
}

// 3. 连续 15 日出勤数据
export interface Attendance15DaysData extends BaseCenterData {
  dataType: 'attendance_15days';
  coverage: number;        // 覆盖率
  triggerRate: number;     // 触发率
  newCount: number;        // 新增人数
  totalCount: number;      // 总人数
}

// 4. 七日未出勤数据
export interface Attendance7DaysData extends BaseCenterData {
  dataType: 'attendance_7days';
  abnormalCount: number;   // 异常人数
  cumulativeScore: number; // 累计计分
  excludedCount?: number;  // 排除人数（病假/伤残等）
}

// 5. 中心在职花名册数据
export interface EmployeeRosterData extends BaseCenterData {
  dataType: 'employee_roster';
  employeeId: string;      // 员工 ID
  employeeName: string;    // 员工姓名
  position: string;        // 岗位
  entryDate: string;       // 入职日期
  status: string;          // 状态（在职/离职）
  department?: string;     // 部门
}

// 7. 中心日出勤明细数据
export interface CenterDailyAttendanceData extends BaseCenterData {
  dataType: 'center_daily_attendance';
  employeeId: string;      // 员工 ID
  employeeName: string;    // 员工姓名
  department: string;      // 二级部门
  group: string;           // 组别
  position: string;        // 岗位
  isPresent: boolean;      // 当天是否出勤
}

// 联合类型
export type CenterData = 
  | JobPerformanceData
  | SalaryPerformanceData
  | Attendance15DaysData
  | Attendance7DaysData
  | EmployeeRosterData
  | CenterDailyAttendanceData;

// 每日数据汇总
export interface DailyData {
  date: string;
  uploadTime: number;
  centers: {
    [centerId: string]: {
      jobPerformance?: JobPerformanceData;
      salaryPerformance?: SalaryPerformanceData;
      attendance15Days?: Attendance15DaysData;
      attendance7Days?: Attendance7DaysData;
    }
  };
}

// 趋势查询参数
export interface TrendQuery {
  centerId: string;
  dataType: DataType;
  jobName?: string;        // 岗位效能数据需要
  days: number;            // 查询天数
}

// 数据模板配置
export interface DataTemplate {
  id: DataType;
  name: string;
  description: string;
  requiredFields: string[];
  fileExample: string;
}

// 数据模板列表
export const DATA_TEMPLATES: DataTemplate[] = [
  {
    id: 'job_performance',
    name: '岗位效能异常',
    description: '包含 7 个岗位类型的效能数据：卸车、装车、倒包、供件、封包、分拣、扫描',
    requiredFields: ['数据日期', '省区', '中心', '岗位名称', '目标值', '当月人均日绩效', '目标偏离（%）'],
    fileExample: '岗位效能异常_2026-04-24.csv'
  },
  {
    id: 'salary_performance',
    name: '薪资绩效异常',
    description: '个人薪资模块考核数据，包含覆盖率、影响人数等',
    requiredFields: ['数据日期', '省区', '中心', '覆盖率', '影响人数'],
    fileExample: '薪资绩效异常_2026-04-24.csv'
  },
  {
    id: 'attendance_15days',
    name: '连续 15 日出勤',
    description: '连续出勤 15 天的异常数据，包含覆盖率、触发率等',
    requiredFields: ['数据日期', '省区', '中心', '覆盖率', '触发率', '新增人数'],
    fileExample: '连续 15 日出勤_2026-04-24.csv'
  },
  {
    id: 'attendance_7days',
    name: '七日未出勤',
    description: '连续 7 天未出勤的异常数据',
    requiredFields: ['数据日期', '省区', '中心', '异常人数', '累计计分'],
    fileExample: '七日未出勤_2026-04-24.csv'
  },
  {
    id: 'employee_roster',
    name: '中心在职花名册',
    description: '中心在职员工花名册，包含员工 ID、姓名、岗位等',
    requiredFields: ['数据日期', '省区', '中心', '员工 ID', '员工姓名', '岗位', '入职日期', '状态'],
    fileExample: '中心在职花名册_2026-04-24.csv'
  },
  {
    id: 'center_daily_attendance',
    name: '中心日出勤明细',
    description: '读取个人当天是否出勤，包含工号、姓名、部门、组别、岗位、出勤状态等',
    requiredFields: ['数据日期', '省区', '中心', '工号', '姓名', '二级部门', '组别', '岗位', '是否出勤'],
    fileExample: '中心日出勤明细_2026-05-05.xlsx'
  }
];
