import React, { useState } from 'react';
import { HelpCircle, X, Table2, ArrowRight, Hash, FileSpreadsheet, CalendarDays, AlertCircle, Upload, GitBranch, RefreshCw, Clock, Book, Building2, Users } from 'lucide-react';
import { cn } from '../lib/utils';

// ── 章节定义 ──
type SectionId = 'overview' | 'operation' | 'metrics' | 'staffing' | 'scope' | 'attendance' | 'matching';

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '概览', icon: <Table2 size={12} /> },
  { id: 'operation', label: '操作规范', icon: <Upload size={12} /> },
  { id: 'metrics', label: '指标口径', icon: <ArrowRight size={12} /> },
  { id: 'staffing', label: '配置标准', icon: <Users size={12} /> },
  { id: 'scope', label: '管幅', icon: <Hash size={12} /> },
  { id: 'attendance', label: '中心考勤', icon: <CalendarDays size={12} /> },
  { id: 'matching', label: '匹配逻辑', icon: <GitBranch size={12} /> },
];

// ── 日期概念 ──
const DATE_CONCEPTS = [
  { term: 'T-2', desc: '今天 - 2天（前天），所有指标的"当天"数据基准' },
  { term: 'T-3', desc: '今天 - 3天（大前天），"前一天"/环比基准' },
  { term: 'T-8 ~ T-2', desc: '7天范围，弹窗周明细展示区间' },
];

// ── 数据源总览 ──
const DATA_SOURCES = [
  { id: 'job_performance', name: '岗位效能异常', rows: '岗位名称+省区+中心+日期', dedup: '岗位名称 + 数据日期 + 中心' },
  { id: 'salary_performance', name: '薪资绩效异常', rows: '每人一条（姓名+岗位+日期）', dedup: '姓名 + 岗位 + 数据日期' },
  { id: 'attendance_15days', name: '连续15日出勤', rows: '连续出勤≥15天的员工', dedup: '工号 + 数据日期' },
  { id: 'attendance_7days', name: '连续7日未出勤', rows: '连续未出勤≥7天的员工', dedup: '工号 + 数据日期' },
  { id: 'work_hours_high', name: '日工时高（&gt;12.5h）', rows: '出勤工时&gt;12.5h的员工', dedup: '工号 + 数据日期' },
  { id: 'work_hours_low', name: '日工时低（&le;8h）', rows: '出勤工时&le;8h的员工', dedup: '工号 + 数据日期' },
  { id: 'employee_roster', name: '中心在职花名册', rows: '全部在职人员（含非操作部门）', dedup: '工号' },
  { id: 'center_daily_attendance', name: '中心日出勤明细', rows: '每人每天一条（有记录=出勤）', dedup: '工号 + 数据日期' },
  { id: 'outsourcing', name: '转运中心外包人数', rows: '14个转运中心的外包人数', dedup: '中心名称' },
];

// ── 操作规范 ──
const OPERATION_SPEC = {
  naming: [
    { type: '岗位效能异常', pattern: 'job_performance_YYYYMMDD.xlsx', example: 'job_performance_20260514.xlsx' },
    { type: '薪资绩效异常', pattern: 'salary_performance_YYYYMMDD.xlsx', example: 'salary_performance_20260514.xlsx' },
    { type: '连续15日出勤', pattern: 'attendance15_YYYYMMDD.xlsx', example: 'attendance15_20260514.xlsx' },
    { type: '连续7日未出勤', pattern: 'attendance7_YYYYMMDD.xlsx', example: 'attendance7_20260514.xlsx' },
    { type: '日工时高（&gt;12.5h）', pattern: 'work_hours_high_YYYYMMDD.xlsx', example: 'work_hours_high_20260514.xlsx' },
    { type: '日工时低（&le;8h）', pattern: 'work_hours_low_YYYYMMDD.xlsx', example: 'work_hours_low_20260514.xlsx' },
    { type: '中心在职花名册', pattern: 'roster_YYYYMMDD.xlsx', example: 'roster_20260514.xlsx' },
    { type: '外包人数', pattern: 'outsourcing.xlsx', example: 'outsourcing.xlsx（固定文件名，覆盖更新）' },
    { type: '中心日出勤明细', pattern: 'center_attendance_YYYYMMDD.xlsx', example: 'center_attendance_20260514.xlsx' },
  ],
  uploadSteps: [
    '1. 从 TMS 导出 Excel 到 Downloads，双击运行 process_data.py',
    '2. 脚本自动过滤省区、合并岗位、输出Excel、转JSON、git push',
    '3. 花名册和外包文件手动放到 public/database/ 目录',
    '4. 等待 GitHub Actions 自动部署（约 1-2 分钟）',
    '5. 线上 Ctrl+F5 强制刷新页面即可看到新数据',
  ],
  updateFreq: [
    { item: '岗位效能异常 / 薪资绩效异常', freq: '每日', note: 'T-2 数据，每天更新' },
    { item: '连续15日出勤 / 连续7日未出勤', freq: '每日', note: 'T-2 数据，每天更新' },
    { item: '日工时高 / 日工时低', freq: '每日', note: 'T-2 数据，每天更新，基于中心日出勤明细计算' },
    { item: '中心日出勤明细', freq: '每日', note: '用于考勤模块和工时统计，可按需上传多天数据' },
    { item: '中心在职花名册', freq: '每周或按需', note: '人员变动时更新，影响管幅和覆盖率分母' },
    { item: '外包人数', freq: '每周或按需', note: '外包人员变动时更新，影响非操占比计算' },
  ],
  codeUpdate: [
    '1. 本地修改代码后，运行 npm run build 确认无报错',
    '2. git add -A && git commit -m "描述修改内容"',
    '3. git push 推送到远程仓库',
    '4. Vercel/Netlify 会自动部署（约 1-2 分钟）',
    '5. 线上按 Ctrl+F5 强制刷新，清除浏览器缓存',
  ],
  cacheNote: '系统使用 IndexedDB 缓存数据，并追踪已加载文件名。重复加载同一文件不会导致数据重复，但新增/修改文件后需"清除缓存并重新加载"才能生效。',
};

// ── 汇总指标 ──
const AGGREGATION_SPEC = {
  items: [
    { name: '中心绩效得分', formula: '效能得分 + 薪资得分 + 连续出勤得分 + 长期未出勤得分 + 日工时高得分 + 日工时低得分（六项之和，满分100）' },
    { name: '省区绩效得分', formula: '下属参与考核中心得分的算术平均值（取整）' },
    { name: '全区平均分', formula: '各省区总分的算术平均值（取整）' },
    { name: '省区排名', formula: '按省区总分降序排列' },
    { name: '非操占比', formula: '非操作人数 ÷ 总人数 × 100%\n\n【计算口径】\n非操作人数 = 花名册中"非操作部门"人数 + 外包人数\n  · 花名册匹配: 九级单位 = "xx转运中心"，排除以下岗位:\n    ① 中心操作类: 中心操作/操作员/操作组长/操作主管\n    ② 特殊岗位: 安检员/仓库管理员/环保袋管理维修员\n  · 外包人数: outsourcing.xlsx → 中心→人数映射\n总人数 = 花名册在职人数 + 外包人数\n\n【异常判定】\n非操占比超过对应分类阈值 → 标记异常\n  · A类中心 ≤8%, B类 ≤10%, C类 ≤12%\n  · 阈值可在看板配置面板自定义' },
  ],
  exemptions: '管理员模式可豁免中心（不计入省区得分），豁免后省区得分仅基于参与考核的中心重新计算',
};

// ── 匹配逻辑 ──
const MATCHING_SPEC = {
  rules: [
    { name: '中心名匹配', desc: '优先精确匹配 → 互相包含匹配（includes）→ 去后缀匹配（去掉"中心""省区""区"后比较）→ 别名映射' },
    { name: '省区名匹配', desc: '优先精确匹配 → 互相包含匹配 → 去"区"后缀匹配' },
    { name: '别名映射', desc: '武昌 ↔ 武吕（不同数据源对同一中心的叫法不一致时，硬编码映射）' },
    { name: '花名册列名', desc: '动态 findKey + includes()，兼容零宽字符（U+200C/U+200D/U+FEFF）' },
  ],
  notes: '所有匹配均不支持正则，仅基于字符串包含和去后缀比较',
};

// ── 弹窗明细字段 ──
const DETAIL_FIELDS = {
  job: [
    { col: '岗位名称', desc: '异常岗位名（卸车/装车/倒包/供件/封包/分拣/扫描）' },
    { col: '当月人均日绩效', desc: '实际人均日绩效值（弹窗列名：实际）' },
    { col: '目标值', desc: '岗位日绩效目标值（弹窗列名：目标）' },
    { col: '目标偏离(%)', desc: '(实际-目标)/目标 × 100，≥10% 判为异常（弹窗列名：偏离）' },
    { col: '全网同岗均值', desc: '全网同一岗位的平均绩效' },
    { col: '均值偏离(%)', desc: '(实际-全网均值)/全网均值 × 100' },
  ],
  salary: [
    { col: '姓名', desc: '薪资偏高人员' },
    { col: '岗位', desc: '人员岗位' },
    { col: '出勤系数', desc: '当月出勤天数/应出勤天数' },
    { col: '个人平均日薪', desc: '该人员当月平均日薪' },
    { col: '岗位上月均值', desc: '该岗位上月全员平均日薪' },
    { col: '均值偏离(%)', desc: '(个人日薪-岗位均值)/岗位均值 × 100' },
  ],
  att15: [
    { col: '姓名', desc: '连续出勤人员' },
    { col: '岗位', desc: '人员岗位' },
    { col: '连续出勤天数', desc: '从最近日期倒推，连续有出勤记录的天数' },
    { col: '工号', desc: '用于排休计划全局匹配' },
  ],
  att7: [
    { col: '姓名', desc: '长期未出勤人员' },
    { col: '岗位', desc: '人员岗位' },
    { col: '连续未出勤天数', desc: '从最近日期倒推，连续无出勤记录的天数' },
    { col: '工号', desc: '用于未出勤原因全局匹配' },
  ],
  workHoursHigh: [
    { col: '姓名', desc: '日工时&gt;12.5h人员' },
    { col: '岗位', desc: '人员岗位' },
    { col: '出勤工时', desc: '当日出勤工时' },
    { col: '超过12.5h天数', desc: '统计周期内超过12.5h的天数' },
  ],
  workHoursLow: [
    { col: '姓名', desc: '日工时&le;8h人员' },
    { col: '岗位', desc: '人员岗位' },
    { col: '出勤工时', desc: '当日出勤工时' },
    { col: '低于8h天数', desc: '统计周期内低于8h的天数' },
  ],
};

const METRIC_SPECS = [
  {
    id: 'job',
    name: '效能异常',
    weight: 25,
    color: 'text-red-600 bg-red-50 border-red-200',
    sourceTable: '岗位效能异常 (job_performance)',
    keyColumns: [
      { col: '省区 / 省区名称', desc: '省区归属' },
      { col: '中心 / 中心名称', desc: '子中心名称' },
      { col: '岗位名称', desc: '卸车/装车/倒包/供件/封包/分拣/扫描' },
      { col: '目标值', desc: '岗位日绩效目标值' },
      { col: '当月人均日绩效', desc: '实际人均日绩效' },
      { col: '目标偏离 (%)', desc: '(实际-目标)/目标 * 100' },
      { col: '数据日期', desc: '统计日期' },
    ],
    formula: '当月最后一天触发的岗位数量，每触发1个岗位扣5分。满分25分，最低0分。',
    notes: '仅统计目标偏离 >= 10% 的岗位，数据日期为 T-2',
    detailFields: DETAIL_FIELDS.job,
  },
  {
    id: 'salary',
    name: '绩效异常',
    weight: 15,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    sourceTable: '薪资异常数据表 (salary_performance)',
    keyColumns: [
      { col: '中心 / 中心名称', desc: '子中心名称' },
      { col: '姓名', desc: '薪资偏高人员' },
      { col: '岗位', desc: '人员岗位' },
      { col: '数据日期', desc: '统计日期' },
    ],
    formula: '个人薪资模块考核：覆盖率 ≤ 3% 得 15 分；覆盖率 > 3%，每增加 1% 扣 3 分，最低 0 分。',
    denominator: '覆盖率 = 薪资异常人数 / 在职人数 × 100%（分母为花名册中心操作部门人数）',
    notes: '分母统一使用花名册在职人数',
    detailFields: DETAIL_FIELDS.salary,
  },
  {
    id: 'att15',
    name: '连续出勤',
    weight: 25,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    sourceTable: '连续15日出勤表 (attendance_15days)',
    keyColumns: [
      { col: '中心 / 中心名称', desc: '子中心名称' },
      { col: '工号', desc: '员工工号' },
      { col: '连续出勤天数', desc: '连续出勤天数' },
      { col: '数据日期', desc: '统计日期' },
    ],
    formula: '覆盖率 ≤ 3% 不扣分；覆盖率 > 3%，每增加 1% 扣 5 分。当月连续出勤 > 30 天，过程中每出现 1 人扣 2 分。满分 25 分，最低 0 分。',
    denominator: '覆盖率 = 连续出勤≥15天人数 / 在职人数 × 100%',
    notes: '仅统计连续出勤天数 ≥ 15 天的记录',
    detailFields: DETAIL_FIELDS.att15,
  },
  {
    id: 'att7',
    name: '长期未出勤',
    weight: 25,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    sourceTable: '连续7日未出勤表 (attendance_7days)',
    keyColumns: [
      { col: '中心 / 中心名称', desc: '子中心名称' },
      { col: '工号', desc: '员工工号' },
      { col: '连续未出勤天数', desc: '连续未出勤天数' },
      { col: '数据日期', desc: '统计日期' },
    ],
    formula: '过程中出现 1 人扣 2 分，累计计分，满分 25 分，最低 0 分（不含病假、伤残、跨组织架构等特殊情况）。',
    notes: '仅统计连续未出勤天数 ≥ 7 天的记录',
    detailFields: DETAIL_FIELDS.att7,
  },
  {
    id: 'workHoursHigh',
    name: '日工时高',
    weight: 5,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
    sourceTable: '日工时高表 (work_hours_high)',
    keyColumns: [
      { col: '中心 / 中心名称', desc: '子中心名称' },
      { col: '工号', desc: '员工工号' },
      { col: '姓名', desc: '员工姓名' },
      { col: '出勤工时', desc: '当日出勤工时' },
      { col: '数据日期', desc: '统计日期' },
    ],
    formula: '日均触发占比 ≤ 10% 得 5 分；占比 > 10%，每增加 1% 扣 1 分（四舍五入），最低 0 分。',
    notes: '仅统计当日出勤工时 > 12.5h 的记录',
    detailFields: DETAIL_FIELDS.workHoursHigh,
  },
  {
    id: 'workHoursLow',
    name: '日工时低',
    weight: 5,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200',
    sourceTable: '日工时低表 (work_hours_low)',
    keyColumns: [
      { col: '中心 / 中心名称', desc: '子中心名称' },
      { col: '工号', desc: '员工工号' },
      { col: '姓名', desc: '员工姓名' },
      { col: '出勤工时', desc: '当日出勤工时' },
      { col: '数据日期', desc: '统计日期' },
    ],
    formula: '每出现 1 人扣 1 分，满分 5 分，最低 0 分。',
    notes: '仅统计当日出勤工时 ≤ 8h 的记录',
    detailFields: DETAIL_FIELDS.workHoursLow,
  },
];

const SCOPE_SPEC = {
  sourceTable: '在职花名册 (employee_roster)',
  keyColumns: [
    { col: '六级单位 / 七级单位', desc: '中心名称' },
    { col: '五级单位', desc: '省区' },
    { col: '二级部门', desc: '过滤条件: 包含"中心操作"' },
    { col: '岗位名称', desc: '区分 操作组长 / 操作主管 / 其他操作人员' },
  ],
  formulas: [
    '综合管幅 = 操作人数 / (组长数 + 主管数)',
    '组长管幅 = 操作人数 / 组长数',
    '综合超目标 = 操作人数/25 - (组长+主管)（正=缺管理，负=超编）',
    '组长超目标 = 操作人数/35 - 组长数（正=缺管理，负=超编）',
  ],
  rosterTargetNote: '编制/应配人数来源于花名册，若花名册无此字段则为0',
};

const ATTENDANCE_SPEC = {
  dataSources: [
    {
      table: '在职花名册 (employee_roster)',
      role: '人员底表 - 构建谁在考勤的人员清单',
      columns: [
        { col: '工号 (B列)', desc: '唯一标识，关联出勤明细' },
        { col: '姓名 (C列)', desc: '员工姓名' },
        { col: '二级部门 (AI列)', desc: '过滤: 仅保留含[中心操作]的行' },
        { col: '组别 (AM列)', desc: '操作小组，用于分组统计和负责人匹配' },
        { col: '岗位 (AU列)', desc: '区分组长/主管/操作人员' },
        { col: '转运中心/七级单位 (Y列)', desc: '匹配当前选中中心的筛选条件' },
      ],
    },
    {
      table: '日出勤明细 (center_daily_attendance)',
      role: '日历数据 - 每人每天是否出勤 (有记录=出勤，无记录=缺勤)',
      columns: [
        { col: '工号', desc: '与花名册工号关联' },
        { col: '日期 / 数据日期 / 出勤日期', desc: '出勤日期，YYYY-MM-DD 格式' },
        { col: '有该行记录 -> 出勤', desc: 'true，日历显示绿色数字' },
        { col: '无该行记录 -> 缺勤', desc: 'false/undefined，日历显示红色标记' },
      ],
    },
  ],
  metrics: [
    { name: '在职人数', formula: '花名册中匹配当前中心 + 二级部门含[中心操作]的行数', note: '即考勤表格的总行数 (序号最大值)' },
    { name: 'T-2 出勤人数', formula: '在日出勤明细中，T-2日期 有记录(=true) 的花名册人数\n若 T-2 不在数据范围内且有真实数据 -> 出勤人数=0' },
    { name: 'T-2 缺勤人数', formula: '在职人数 - T-2出勤人数\n或: 当 T-2 不在有数据范围内时 -> 缺勤=全部在职人数' },
    { name: '个人出勤率', formula: '出勤天数 / 统计天数 * 100%', note: '统计天数 = 日历视图中有数据的所有日期数量' },
    { name: '小组出勤率 (近10天)', formula: '组内成员近10天总出勤天 / (组内人数 * 10) * 100%', note: '用于长期出勤/缺勤预警卡片展示' },
    { name: '长期出勤预警', formula: '扫描近10天的日出勤明细，连续 N 天都有记录(true) 的人\n阈值: 连续 >=10天 触发黄色预警' },
    { name: '长期缺勤预警', formula: '扫描近10天的日出勤明细，连续 N 天都无记录(false) 的人\n阈值: 连续 >=5天 触发红色预警' },
    { name: '小组负责人', formula: '来源：花名册中 [组别] 对应的 [操作组长/主管人员姓名]\n手动覆盖优先级最高，存储于 GitHub 仓库 group_leaders.json，多人协作编辑，一人修改全员可见' },
  ],
  summaryTableCols: ['应出勤','实际出勤','出勤天数','缺勤天数','旷工扣款','带薪假','事假','病假','旷工天数','迟到(分)','早退(分)','法定计薪天','报表出勤','系统差异'],
  summaryTableSpec: [
    { col: '应出勤', desc: '统计期内应出勤天数（工作日数）' },
    { col: '实际出勤', desc: '实际有出勤记录的天数' },
    { col: '出勤天数', desc: '同"实际出勤"' },
    { col: '缺勤天数', desc: '应出勤 - 实际出勤' },
    { col: '旷工扣款', desc: '旷工天数对应扣款金额' },
    { col: '带薪假', desc: '带薪休假天数' },
    { col: '事假', desc: '事假天数' },
    { col: '病假', desc: '病假天数' },
    { col: '旷工天数', desc: '无假且未出勤的天数' },
    { col: '迟到(分)', desc: '迟到累计分钟数' },
    { col: '早退(分)', desc: '早退累计分钟数' },
    { col: '法定计薪天', desc: '法定应计薪天数' },
    { col: '报表出勤', desc: '原始报表中的出勤天数' },
    { col: '系统差异', desc: '报表出勤 - 实际出勤（非0时有差异）' },
  ],
  leavePlanSpec: {
    trigger: '连续出勤 ≥ 15天的人员',
    storage: '存储于 Supabase leave_plans 表，多人协作编辑，一人修改全员可见',
    autoMatch: '按姓名自动匹配已有排休计划，savedAt 间隔 ≤1 天自动继承',
    fields: [
      { col: '排休日期段', desc: '支持多段不连续日期，显示如 5/20~5/22, 5/28~5/30' },
      { col: '小组出勤率', desc: 'T-2 花名册+出勤明细计算，≥85% 标"无法排休"' },
      { col: 'savedAt', desc: '真实保存日期（YYYY-MM-DD），用于继承判断，保存时强制更新为当天' },
    ],
  },
  absenceReasonSpec: {
    trigger: '连续未出勤 ≥ 7天的人员',
    options: '工伤 / 事假 / 病假 / 纠纷 / 挂编 / 出差 / 离职未清 / 已返岗',
    storage: '存储于 Supabase absence_reasons 表，多人协作编辑，一人修改全员可见',
    autoClean: '不在当前视图中的工号记录自动删除（断天 = 该人不再是连续未出勤≥7天）',
  },
  groupLeadersSpec: {
    storage: '存储于 GitHub 仓库 group_leaders.json，多人协作编辑，一人修改全员可见；修改后需点击"保存到云端"',
    fields: [
      { col: '班组负责人', desc: '班组级负责人姓名，在出勤日历表格中显示；点击单元格可编辑' },
    ],
  },
};

export default function MetricHelpPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center transition-all duration-200 hover:border-red-400 hover:bg-red-50 group" title="查看各指标数据口径说明">
        <HelpCircle size={13} className="text-slate-400 group-hover:text-red-500 transition-colors" />
      </button>
      <button onClick={() => setIsManualOpen(true)} className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 group" title="查看版本修订历史">
        <Book size={13} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
      </button>
      <AnimateWrapper isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="flex flex-col h-full">
          {/* 头部 */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">指标口径说明</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">数据来源 / 取数字段 / 计算规则</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"><X size={14} className="text-slate-400" /></button>
          </div>

          {/* 章节导航 */}
          <div className="flex gap-1 py-3 border-b border-slate-100 overflow-x-auto shrink-0">
            {SECTIONS.map(sec => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold whitespace-nowrap transition-colors",
                  activeSection === sec.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                )}
              >
                {sec.icon}
                {sec.label}
              </button>
            ))}
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-y-auto pt-4 space-y-5">
            {activeSection === 'overview' && <OverviewSection />}
            {activeSection === 'operation' && <OperationSection />}
            {activeSection === 'metrics' && <MetricsSection />}
            {activeSection === 'staffing' && <StaffingSection />}
            {activeSection === 'scope' && <ScopeSection />}
            {activeSection === 'attendance' && <AttendanceSection />}
            {activeSection === 'matching' && <MatchingSection />}
          </div>
        </div>
      </AnimateWrapper>

      {/* 版本修订历史手册 */}
      <AnimateWrapper isOpen={isManualOpen} onClose={() => setIsManualOpen(false)}>
        <div className="flex flex-col h-full">
          {/* 头部 */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">版本修订历史</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">功能更新 / 修复记录 / 版本说明</p>
            </div>
            <button onClick={() => setIsManualOpen(false)} className="w-6 h-6 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"><X size={14} className="text-slate-400" /></button>
          </div>

          {/* 版本历史内容 */}
          <div className="flex-1 overflow-y-auto pt-4 space-y-4">
            {/* V3.2.0 - 2026-05-29 */}
            <div className="bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">V3.2.0</span>
                <span className="text-[9px] text-slate-400">2026-05-29</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">非操占比列：花名册(排除中心操作+特殊岗位) + 外包人数，点击查看各部门明细</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">排休计划多段日期选择：一个人可选多个不连续日期段</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">效能异常弹窗新增全网同岗均值、均值偏离两列</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">数据管道自动化：process_data.py 推送前自动 Excel→JSON</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">继承逻辑自动保存到 Supabase：三个弹窗（排休/未出勤/工时低）打开即继承</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">协作数据存储从 GitHub API 迁移到 Supabase，解决多人并发冲突</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">0527/0528 数据不显示（JSON 未生成），Office 锁文件入库，非操占比分子漏加外包</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">删除</span>
                  <span className="text-slate-600">移除长期未出勤弹窗的考勤负责人编辑功能</span>
                </div>
              </div>
            </div>

            {/* V3.1.0 - 2026-05-27 */}
            <div className="bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">V3.1.0</span>
                <span className="text-[9px] text-slate-400">2026-05-27</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">数据去重升级：IndexedDB 写入从 JSON.stringify 去重改为业务键去重（工号+日期），重复推送同一天数据不再重复显示</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">管理员登录加固：密码从源码明文 123456 改为 SHA-256 哈希存储，源码和 JS 包均不暴露密码</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">数据清理完善："清除全部数据"按钮新增清理文件缓存、管理员模式、豁免中心等残留项</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">安全</span>
                  <span className="text-slate-600">GitHub 仓库从公开改为私有，保护员工数据不外泄</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">安全</span>
                  <span className="text-slate-600">Git 远程 URL 移除硬编码的 PAT 令牌，消除令牌泄露风险</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">安全</span>
                  <span className="text-slate-600">Supabase 5 张协作数据表启用 RLS（行级安全），后续可随时收紧写入权限</span>
                </div>
              </div>
            </div>

            {/* V3.0.0 - 2026-05-26 */}
            <div className="bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">V3.0.0</span>
                <span className="text-[9px] text-slate-400">2026-05-26</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">数据加载架构升级：Excel 预解析为 JSON，浏览器直接加载 JSON，速度提升 5 倍+</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">增量更新修复：引入 MD5 hash 对比机制，解决 filelist.json mtime 被重置问题，只加载变更文件</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">自动兼容模式：先尝试 JSON 加载，失败后自动回退 Excel，本地开发无需手动生成 JSON</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">动态导入 xlsx：xlsx 库从主包中拆分，减少主包体积，加速首屏加载</span>
                </div>
              </div>
            </div>

            {/* V2.9.0 - 2026-05-25 */}
            <div className="bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">V2.9.0</span>
                <span className="text-[9px] text-slate-400">2026-05-25</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">协作数据存储迁移：从 GitHub API 迁移到 Supabase 数据库，解决多人并发编辑冲突</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">支持 5 种协作数据实时同步：排休计划、未出勤原因、考勤负责人、班组负责人、工时低原因</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">支持实时多人协作：Supabase Realtime 自动推送，多人同时编辑不再冲突</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">移除 GitHub API 限流限制：无 60次/小时 请求上限，支持 20 人同时使用</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">旧数据乱码问题：修复了 GitHub API 编码错误导致的历史数据中文乱码</span>
                </div>
              </div>
            </div>

            {/* V2.9.0 - 2026-06-02 */}
            <div className="bg-blue-50/60 rounded-lg p-3 space-y-2 border border-blue-100">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-500 text-white">V2.9.0</span>
                <span className="text-[9px] text-slate-400">2026-06-02（当前）</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">数据导出 Excel：表头右上角按钮，一键导出 14 中心全维度数据</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">历史趋势弹窗：中心名旁的📈按钮，6 维度折线图+时间范围切换+明细表</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">智能告警+数据校验：侧栏关键行动内嵌，恶化/改善/异常分组，变化&gt;30%自动标黄</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">侧栏综合总览：大号得分+KPI网格（9项）+维度得分进度条，替代雷达图和无效KPI卡片</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">看板配置面板：⚙️齿轮打开，中心负责人/ABC分类/评分阈值/豁免管理，保存即生效</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">中心考勤月份切换：左右箭头翻月，自动跳到数据最新月份</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">全局色彩升级 zinc→slate，更专业冷调；自定义主题色</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">GPU 加速动画：省区行 FLIP 动画 + 中心行 scaleY，选中高亮 CSS transition</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">表格列居中、列宽 160→120px、表头毛玻璃、顶部得分区精简、scrollbar 稳定</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">花名册 JSON 153MB→12MB（去零宽字符+删无用列，减少92%）</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">IndexedDB 空数据不加载 bug、自定义域名 base 路径+CNAME、中心考勤日期不匹配</span>
                </div>
              </div>
            </div>

            {/* V2.8.0 - 2026-05-22 */}
            <div className="bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">V2.8.0</span>
                <span className="text-[9px] text-slate-400">2026-05-22</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">日工时高考核维度：出勤工时&gt;12.5h，日均触发占比超10%每增加1%扣1分，满分5分封顶0分</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">日工时低考核维度：出勤工时&le;8h，每出现1人扣1分，满分5分封顶0分</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">日工时低原因字段：支持选择原因（倒班、临时事假、脱岗、其他），支持继承逻辑</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">薪资异常权重调整：从25分调整为15分（总分保持100分不变）</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">数据通报全面支持日工时高/低：报告文案、统计条、各中心详情、总览图片均新增日工时维度</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">各维度明细支持日工时高/低：中心卡片网格从4列扩展为6列，支持点击查看明细</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">计分规则解析同步更新：新增日工时高/低规则说明，薪资异常改为15分</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">省区维度显示0分Bug：日工时高触发人数为0时（满分5分）被误判为无数据，导致维度显示0分</span>
                </div>
              </div>
            </div>

            {/* V2.7.0 - 2026-05-22 */}
            <div className="bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">V2.7.0</span>
                <span className="text-[9px] text-slate-400">2026-05-22</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">通报总览图片生成：支持一键生成精致报告风格图片，可直接粘贴到微信</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">图片表格结构：10列精简为8列，管幅/超目标合并为2列（每列内显示综合+组长两行）</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">图片标红规则：绩效异常&gt;1个、薪资异常&gt;3%、连续出勤&gt;3%、长期未出勤&gt;3% 红色加粗</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">图片标题栏布局：标题左上对齐，副标题在下，全区均分标签居右，整体深蓝背景全宽渲染</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">得分背景色：高分浅绿/#d1fae5、中分浅黄/#fef3c7、低分浅红/#fecaca，视觉更柔和</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">标题栏与表头断开问题：标题栏、表头、数据行全部全宽连成一体</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">左右留白过大：边距从24px压缩到4px，图片更紧凑</span>
                </div>
              </div>
            </div>

            {/* V2.7.2 - 2026-05-22 */}
            <div className="bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">V2.7.2</span>
                <span className="text-[9px] text-slate-400">2026-05-22</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">自动继承逻辑：只继承"连续异常"情况（历史最近日期与当前窗口第一天差距≤3天），不继承"中断后重新异常"</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">保存逻辑修复：保存时只清理当前窗口数据，不删除历史数据（防止历史原因/排休计划丢失）</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">自动继承bug：之前只检查"此人是否有任何原因"，导致新日期缺失原因不填充，现改为对每个日期单独检查</span>
                </div>
              </div>
            </div>

            {/* V2.6.0 - 2026-05-21 */}
            <div className="bg-emerald-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">V2.6.0</span>
                <span className="text-[9px] text-slate-400">2026-05-21</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">未出勤原因自动继承：选原因时同一个人所有日期自动填（覆盖），清除时也同步清除</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">排休计划自动继承：选排休日期时同一个人所有日期自动填（覆盖），清除时也同步清除</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">保存时自动清理：保存未出勤原因/排休计划时，自动删掉不在当前7天异常列表的人</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">班组负责人批量编辑模式：修改后暂存本地，黄色提示条提醒未保存，统一点击"保存到云端"上传</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">离开考勤界面时保存提醒：切换 Tab 或刷新/关闭页面时弹窗提醒保存未提交的修改</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">未保存修改刷新不丢失：修改负责人后未保存，刷新页面修改仍在本地</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">保存时重建数据结构：根据reasonMap/leavePlans重建collaborationData，确保同一个人所有日期都存进去（修复自动继承后未保存的问题）</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-red-600 font-bold shrink-0">修复</span>
                  <span className="text-slate-600">协作数据 UTF-8 编码修复：解决保存后排休计划、未出勤原因等中文内容乱码问题</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">弹窗界面美化：原生 alert/confirm 替换为 WPS 风格美观弹窗</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">优化</span>
                  <span className="text-slate-600">口径说明更新：新增排休计划、未出勤原因、中心负责人、班组负责人的存储方式说明</span>
                </div>
              </div>
            </div>

            {/* V2.5.0 - 2026-05-19 */}
            <div className="bg-blue-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">V2.5.0</span>
                <span className="text-[9px] text-slate-400">2026-05-19</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">排休计划协作编辑：支持为连续出勤≥15天的员工添加排休计划，存储于 GitHub 仓库</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">未出勤原因协作编辑：支持为连续未出勤≥7天的员工添加未出勤原因，存储于 GitHub 仓库</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">中心负责人编辑：支持设置中心考勤负责人，存储于 GitHub 仓库</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">班组负责人编辑：支持设置各班组负责人，存储于 GitHub 仓库</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">多人协作支持：所有协作数据通过 GitHub API 读写，所有用户共享，实时同步</span>
                </div>
              </div>
            </div>

            {/* V2.0 - 2026-05-20 */}
            <div className="bg-blue-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">V2.0</span>
                <span className="text-[9px] text-slate-400">2026-05-20</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">添加版本修订历史手册（点击口径说明旁边的书本图标查看）</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">分离连续出勤和连续未出勤的筛选功能（各自独立筛选）</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-emerald-600 font-bold shrink-0">新增</span>
                  <span className="text-slate-600">分离连续出勤和连续未出勤的导出图片功能（分别导出两张图片）</span>
                </div>
              </div>
            </div>

            {/* V1.0 - 2026-05-15 */}
            <div className="bg-slate-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">V1.0</span>
                <span className="text-[9px] text-slate-400">2026-05-15</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">初始</span>
                  <span className="text-slate-600">GPT每日通报可视化看板正式上线</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">功能</span>
                  <span className="text-slate-600">支持岗位效能、薪资绩效、连续出勤、长期未出勤四大指标展示</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-blue-600 font-bold shrink-0">功能</span>
                  <span className="text-slate-600">中心考勤模块：出勤日历、预警统计、导出图片</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AnimateWrapper>
    </>
  );
}

// ── 概览章节 ──
function OverviewSection() {
  return (
    <div className="space-y-5">
      {/* 日期概念 */}
      <div className="bg-slate-50 rounded-lg p-3 space-y-2">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">日期概念</div>
        <div className="grid grid-cols-3 gap-1.5">
          {DATE_CONCEPTS.map(dc => (
            <div key={dc.term} className="bg-white rounded-md px-2 py-1.5 border border-slate-100">
              <span className="font-mono font-black text-[11px] text-slate-800">{dc.term}</span>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{dc.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 数据源总览 */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">数据源总览（9种上传类型）</div>
        <div className="grid gap-1">
          {DATA_SOURCES.map(ds => (
            <div key={ds.id} className="bg-slate-50 rounded-md px-3 py-2 flex items-center gap-3">
              <span className="font-mono font-bold text-[10px] text-slate-700 min-w-[140px]">{ds.name}</span>
              <span className="text-[9px] text-slate-400">{ds.rows}</span>
              <span className="ml-auto text-[8px] text-slate-300 font-mono">{ds.dedup}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 汇总指标 */}
      <div className="bg-slate-900 text-white rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider"><ArrowRight size={10} /> 汇总指标</div>
        {AGGREGATION_SPEC.items.map(item => (
          <div key={item.name} className="space-y-0.5">
            <span className="text-[10px] font-bold text-white">{item.name}</span>
            <pre className="text-[9px] leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">{item.formula}</pre>
          </div>
        ))}
        <div className="pt-1.5 border-t border-slate-700 text-[9px] text-amber-400/80 italic">{AGGREGATION_SPEC.exemptions}</div>
      </div>
    </div>
  );
}

// ── 操作规范章节 ──
function OperationSection() {
  return (
    <div className="space-y-5">
      {/* 文件命名规范 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider"><FileSpreadsheet size={11} /> 文件命名规范</div>
        <div className="grid gap-1">
          {OPERATION_SPEC.naming.map(n => (
            <div key={n.type} className="bg-slate-50 rounded-md px-3 py-2 space-y-1">
              <span className="text-[10px] font-bold text-slate-700">{n.type}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-100">{n.pattern}</span>
                <span className="text-[8px] text-slate-400">例: {n.example}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-amber-50/60 rounded-md p-2.5 space-y-1 border border-amber-100">
          <div className="text-[10px] font-bold text-amber-700">为什么文件命名必须使用英文？</div>
          <ul className="space-y-0.5">
            <li className="text-[9px] text-slate-600 leading-relaxed">1. 跨平台兼容：英文文件名在不同操作系统（Windows/Mac/Linux）间传输不会乱码，中文文件名在部分服务器环境可能显示为乱码</li>
            <li className="text-[9px] text-slate-600 leading-relaxed">2. 程序自动扫描：系统按英文前缀（如 job_performance、salary_performance）匹配文件，中文前缀无法被正确识别</li>
            <li className="text-[9px] text-slate-600 leading-relaxed">3. Git 版本控制：Git 对中文文件名支持不稳定，英文命名可避免提交冲突和乱码问题</li>
            <li className="text-[9px] text-slate-600 leading-relaxed">4. 减少人为错误：英文命名避免因输入法切换、全半角等问题导致文件名格式不一致</li>
          </ul>
        </div>
      </div>

      {/* 数据上传流程 */}
      <div className="bg-blue-50/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-600 uppercase tracking-wider"><Upload size={11} /> 数据上传流程</div>
        <ol className="space-y-1.5">
          {OPERATION_SPEC.uploadSteps.map((step, i) => (
            <li key={i} className="text-[10px] text-slate-600 leading-relaxed">{step}</li>
          ))}
        </ol>
        <div className="mt-2 pt-2 border-t border-blue-100">
          <div className="text-[10px] font-bold text-blue-700 mb-1">详细操作步骤：</div>
          <ol className="space-y-1">
            <li className="text-[9px] text-slate-600 leading-relaxed"><span className="font-bold text-slate-700">Step 1：</span>准备好 Excel 数据文件，确保列名与指标口径中要求的字段一致</li>
            <li className="text-[9px] text-slate-600 leading-relaxed"><span className="font-bold text-slate-700">Step 2：</span>按"英文类型_日期"格式重命名文件，如 job_performance_20260515.xlsx（日期必须与数据日期一致）</li>
            <li className="text-[9px] text-slate-600 leading-relaxed"><span className="font-bold text-slate-700">Step 3：</span>将文件放入项目根目录下的 public/database/ 文件夹中</li>
            <li className="text-[9px] text-slate-600 leading-relaxed"><span className="font-bold text-slate-700">Step 4：</span>运行 git add -A && git commit -m "更新数据文件" && git push 将文件推送到仓库</li>
            <li className="text-[9px] text-slate-600 leading-relaxed"><span className="font-bold text-slate-700">Step 5：</span>等待 Netlify 自动部署（约 1-2 分钟）</li>
            <li className="text-[9px] text-slate-600 leading-relaxed"><span className="font-bold text-slate-700">Step 6：</span>线上打开看板页面，点击"数据管理" → "清除缓存并重新加载"，或直接按 Ctrl+F5 强制刷新</li>
            <li className="text-[9px] text-slate-600 leading-relaxed"><span className="font-bold text-slate-700">Step 7：</span>验证数据是否生效：检查对应省区/中心的指标数值是否与 Excel 数据一致</li>
          </ol>
        </div>
      </div>

      {/* 更新频率 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-wider"><Clock size={11} /> 更新频率</div>
        <div className="grid gap-1">
          {OPERATION_SPEC.updateFreq.map(u => (
            <div key={u.item} className="bg-slate-50 rounded-md px-3 py-2 flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-700 flex-1">{u.item}</span>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">{u.freq}</span>
              <span className="text-[9px] text-slate-400">{u.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 代码更新流程 */}
      <div className="bg-purple-50/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black text-purple-600 uppercase tracking-wider"><GitBranch size={11} /> 网页代码更新流程</div>
        <ol className="space-y-1">
          {OPERATION_SPEC.codeUpdate.map((step, i) => (
            <li key={i} className="text-[10px] text-slate-600 leading-relaxed">{step}</li>
          ))}
        </ol>
      </div>

      {/* 缓存说明 */}
      <div className="flex items-start gap-2 bg-amber-50/40 rounded-lg p-3">
        <RefreshCw size={12} className="text-amber-500 mt-0.5 shrink-0" />
        <p className="text-[10px] text-slate-600 leading-relaxed">{OPERATION_SPEC.cacheNote}</p>
      </div>
    </div>
  );
}

// ── 指标口径章节 ──
function MetricsSection() {
  return (
    <div className="space-y-6">
      {METRIC_SPECS.map((spec) => (
        <div key={spec.id} className="group">
          <div className="flex items-center gap-2 mb-2">
            <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider", spec.color)}>{spec.weight}分</span>
            <span className="font-bold text-xs text-slate-900">{spec.name}</span>
            <FileSpreadsheet size={11} className="text-slate-300 ml-auto" />
          </div>
          <div className="bg-slate-50 rounded-lg p-3 mb-2 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider"><Table2 size={11} /> 数据来源</div>
            <div className="text-xs font-mono font-semibold text-slate-800 bg-white rounded-md px-2 py-1.5 border border-slate-100">{spec.sourceTable}</div>
            <div className="grid grid-cols-2 gap-1">
              {spec.keyColumns.map((col) => (
                <div key={col.col} className="flex items-start gap-1.5 text-[10px]">
                  <Hash size={9} className="text-slate-300 mt-0.5 flex-shrink-0" />
                  <span className="font-mono font-bold text-slate-700">{col.col}</span>
                  <span className="text-slate-400">{col.desc}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-slate-900 text-white rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wider"><ArrowRight size={10} /> 计算公式</div>
            <pre className="text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">{spec.formula}</pre>
            {spec.denominator && (<div className="mt-1.5 pt-1.5 border-t border-slate-700"><span className="text-[9px] text-slate-500">分母: </span><span className="text-[10px] text-emerald-400 font-medium">{spec.denominator}</span></div>)}
            {spec.notes && (<div className="mt-1 pt-1.5 border-t border-slate-700 text-[9px] text-slate-500 italic">{spec.notes}</div>)}
          </div>
          {spec.detailFields && (
            <div className="bg-amber-50/40 rounded-lg p-2.5 mt-1.5 space-y-1.5">
              <div className="text-[9px] font-black text-amber-600 uppercase tracking-wider">弹窗明细字段</div>
              <div className="grid grid-cols-2 gap-0.5">
                {spec.detailFields.map((f: { col: string; desc: string }) => (
                  <div key={f.col} className="flex items-start gap-1 text-[9px]">
                    <span className="font-mono font-bold text-slate-600">{f.col}</span>
                    <span className="text-slate-400">{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 配置标准章节 ──
const STAFFING_STANDARDS = [
  { dept: '转运中心', positions: [
    { pos: '部长', rule: 'A/B/C类均配置1人' },
    { pos: '副部长', rule: 'A/B类标配1人，C类不配置' },
  ]},
  { dept: '中心人资', positions: [
    { pos: '中心人资主管', rule: '标配1人（省区驻地>1350人可配主管1人，≤1350不配负责人）' },
    { pos: '人资专员（薪酬/招聘/人才/基础）', rule: '按中心在职人数分档——\n≤500人: 2人 | 500~800: 3人 | 800~1100: 4人\n1100~1400: 5人 | 1400~1700: 6人 | >1700: 7人' },
  ]},
  { dept: '中心环保袋管理', positions: [
    { pos: '中心环保袋管理主管', rule: '仅维修工厂所在地设主管岗（漯河、武汉）' },
    { pos: '环保袋仓库管理员', rule: '按维修量+出入库量计算（需数据暂不计入）' },
  ]},
  { dept: '中心行政保障', positions: [
    { pos: '中心行政负责人', rule: '标配1人' },
    { pos: '行政事务专员', rule: 'A类2人，B/C类1人' },
    { pos: '主厨', rule: '按在职人数近似——\n≤900人: 2名 | 900~1400: 3名\n1400~1800: 4名 | >1800: 5名\n四餐中心加1名，上限5人' },
    { pos: '帮厨', rule: '就餐人次服务比1:135（需数据暂不计入）' },
    { pos: '水电维修工', rule: 'A/B类1-2人，C类1人（软件按1人计）' },
    { pos: '宿舍管理员', rule: '按入住人数/房间数分档（需数据暂不计入）' },
    { pos: '锅炉工', rule: '标准2人，冬季使用，北方城市（需数据暂不计入）' },
    { pos: '保洁', rule: '按楼层数配置（需数据暂不计入）' },
    { pos: '保安', rule: '门岗每班次1人（白晚班最低2人）' },
    { pos: '消防中控员', rule: '标准配置2人（白晚班各1）' },
    { pos: '行政车驾驶员', rule: '省总/区域总配置1个（需数据暂不计入）' },
  ]},
  { dept: '中心财务', positions: [
    { pos: '财务支持专员', rule: '配置1人（A类独立中心最高可申请2人）' },
  ]},
  { dept: '中心运能调度', positions: [
    { pos: '中心运能调度主管', rule: '标配1人' },
    { pos: '运力/配载/运行质量专员', rule: '按日均发车量分6档（需数据暂不计入）' },
  ]},
  { dept: '中心质量监督控制', positions: [
    { pos: '中心质量监督控制主管', rule: '标配1人' },
    { pos: '中心质量监督控制专员', rule: 'A类2人，B/C类1人' },
    { pos: '异常件管理员', rule: '日处理量135单/人（需数据暂不计入）' },
    { pos: '中心客服员', rule: '日均工单处理量135单/人（需数据暂不计入）' },
  ]},
  { dept: '中心工艺工程', positions: [
    { pos: '中心工艺工程主管', rule: '标配1人' },
    { pos: 'IT运维/自动化/设备工程师', rule: '按设备维养工时配置（需数据暂不计入）' },
  ]},
  { dept: '中心安全监察', positions: [
    { pos: '中心安全监察主管', rule: 'A/B类标配1人，C类与安全管理员共用1个编制' },
    { pos: '安全管理员', rule: 'A类2人，B类1人，C类与主管共用编制' },
    { pos: '安检员', rule: '按安检机数量+班次配置，1台2人，2台以上1.5倍（需数据暂不计入）' },
  ]},
];

const CENTER_CLASS_LIST = [
  { cls: 'A类', centers: '武汉、郑州、长沙、漯河、南昌' },
  { cls: 'B类', centers: '武昌、荆州、衡阳、新乡' },
  { cls: 'C类', centers: '襄阳、常德、赣州、横峰、商丘' },
];

function StaffingSection() {
  return (
    <div className="space-y-5">
      {/* 中心分类 */}
      <div className="bg-blue-50/40 rounded-lg p-3 space-y-2">
        <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider">中心分类</div>
        <div className="grid gap-1">
          {CENTER_CLASS_LIST.map(c => (
            <div key={c.cls} className="flex items-start gap-2 text-[10px]">
              <span className="font-bold text-blue-600 shrink-0">{c.cls}</span>
              <span className="text-slate-500">{c.centers}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 各部门配置标准 */}
      <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">各部门岗位配置标准（2025年暂定版）</div>
      <div className="space-y-4">
        {STAFFING_STANDARDS.map(dept => (
          <div key={dept.dept} className="bg-slate-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-700">{dept.dept}</span>
              <span className="text-[8px] text-slate-400">({dept.positions.length}个岗位)</span>
            </div>
            <div className="space-y-1.5">
              {dept.positions.map(p => (
                <div key={p.pos} className="bg-white rounded-md px-3 py-2 border border-slate-100">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-slate-700">{p.pos}</span>
                    {p.rule.includes('暂不计入') && <span className="text-[8px] font-bold text-amber-500 bg-amber-50 px-1 py-0.5 rounded">暂估</span>}
                  </div>
                  <pre className="text-[9px] leading-relaxed text-slate-400 whitespace-pre-wrap font-sans">{p.rule}</pre>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 自动计算说明 */}
      <div className="bg-amber-50/40 rounded-lg p-3 space-y-2">
        <div className="text-[10px] font-black text-amber-600 uppercase tracking-wider">自动计算口径</div>
        <div className="text-[10px] text-slate-600 leading-relaxed space-y-1">
          <p>1. 中心分类：A/B/C类按上表固定</p>
          <p>2. 人资专员分档：花名册在职人数（九级单位=xx转运中心）</p>
          <p>3. 主厨分档：按在职人数近似（≤900/1400/1800分档）</p>
          <p>4. 环保袋主管：仅武汉、漯河</p>
          <p>5. 安全监察：A类=1主管+2管理员，B类=1+1，C类=共用1个编制</p>
          <p className="text-amber-600">6. 标注"暂估"的岗位不参与自动计算，表示人数达标不超额</p>
        </div>
      </div>
    </div>
  );
}

// ── 管幅章节 ──
function ScopeSection() {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50/50 rounded-lg p-3 mb-2 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider"><Table2 size={11} /> 数据来源</div>
        <div className="text-xs font-mono font-semibold text-slate-800 bg-white rounded-md px-2 py-1.5 border border-slate-100">{SCOPE_SPEC.sourceTable}</div>
        <div className="grid grid-cols-2 gap-1">
          {SCOPE_SPEC.keyColumns.map((col) => (
            <div key={col.col} className="flex items-start gap-1.5 text-[10px]">
              <Hash size={9} className="text-slate-300 mt-0.5 flex-shrink-0" />
              <span className="font-mono font-bold text-slate-700">{col.col}</span>
              <span className="text-slate-400">{col.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-900 text-white rounded-lg p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider"><ArrowRight size={10} /> 计算公式</div>
        {SCOPE_SPEC.formulas.map((f, i) => (<pre key={i} className="text-[10px] leading-relaxed text-slate-300 font-mono">{f}</pre>))}
        <div className="mt-1 pt-1.5 border-t border-slate-700 text-[9px] text-slate-500 italic">操作人数 = 总人数 - 组长数 - 主管数</div>
        {SCOPE_SPEC.rosterTargetNote && <div className="pt-1 text-[9px] text-amber-400/80 italic">{SCOPE_SPEC.rosterTargetNote}</div>}
      </div>
    </div>
  );
}

// ── 中心考勤章节 ──
function AttendanceSection() {
  return (
    <div className="space-y-4">
      {ATTENDANCE_SPEC.dataSources.map((ds, idx) => (
        <div key={idx} className="bg-slate-50 rounded-lg p-3 mb-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider"><Table2 size={11} /> 数据来源{idx + 1}</div>
            <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100">{ds.role.split('-')[0].trim()}</span>
          </div>
          <div className="text-xs font-mono font-semibold text-slate-800 bg-white rounded-md px-2 py-1.5 border border-slate-100">{ds.table}</div>
          <div className="grid grid-cols-1 gap-0.5">
            {ds.columns.map((col) => (
              <div key={col.col} className="flex items-start gap-1.5 text-[10px]">
                <Hash size={9} className="text-cyan-300 mt-0.5 flex-shrink-0" />
                <span className="font-mono font-bold text-slate-700 min-w-0">{col.col}</span>
                <span className="text-slate-400 flex-shrink-0">-&gt;</span>
                <span className="text-slate-500">{col.desc}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="space-y-2 mt-3">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 uppercase tracking-wider"><ArrowRight size={10} /> 指标计算 (共 {ATTENDANCE_SPEC.metrics.length} 项)</div>
        <div className="grid gap-1.5">
          {ATTENDANCE_SPEC.metrics.map((m) => (
            <div key={m.name} className="bg-slate-900 text-white rounded-lg p-2.5 space-y-1">
              <span className="text-[10px] font-bold text-white block">{m.name}</span>
              <pre className="text-[9px] leading-relaxed text-slate-300 whitespace-pre-wrap font-mono">{m.formula}</pre>
              {m.note && <span className="text-[8px] text-emerald-400/70 italic block">* {m.note}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 bg-blue-50/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider"><Table2 size={11} /> 出勤汇总统计表字段</div>
        <div className="grid gap-0.5">
          {ATTENDANCE_SPEC.summaryTableSpec.map((f: { col: string; desc: string }) => (
            <div key={f.col} className="flex items-start gap-1.5 text-[9px]">
              <span className="font-mono font-bold text-slate-600 min-w-[56px] shrink-0">{f.col}</span>
              <span className="text-slate-400">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 排休计划口径 */}
      <div className="bg-orange-50/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 uppercase tracking-wider"><CalendarDays size={10} /> 排休计划（连续出勤弹窗）</div>
        <div className="space-y-1 text-[9px]">
          <div className="flex gap-1"><span className="font-bold text-orange-600 shrink-0">触发条件</span><span className="text-slate-500">{ATTENDANCE_SPEC.leavePlanSpec.trigger}</span></div>
          <div className="flex gap-1"><span className="font-bold text-orange-600 shrink-0">持久化</span><span className="text-slate-500">{ATTENDANCE_SPEC.leavePlanSpec.storage}</span></div>
          <div className="flex gap-1"><span className="font-bold text-orange-600 shrink-0">自动匹配</span><span className="text-slate-500">{ATTENDANCE_SPEC.leavePlanSpec.autoMatch}</span></div>
        </div>
        <div className="grid grid-cols-2 gap-0.5 mt-1">
          {ATTENDANCE_SPEC.leavePlanSpec.fields.map((f: { col: string; desc: string }) => (
            <div key={f.col} className="flex items-start gap-1 text-[9px]">
              <span className="font-mono font-bold text-slate-600">{f.col}</span>
              <span className="text-slate-400">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 未出勤原因口径 */}
      <div className="bg-purple-50/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 uppercase tracking-wider"><AlertCircle size={10} /> 未出勤原因（长期未出勤弹窗）</div>
        <div className="space-y-1 text-[9px]">
          <div className="flex gap-1"><span className="font-bold text-purple-600 shrink-0">触发条件</span><span className="text-slate-500">{ATTENDANCE_SPEC.absenceReasonSpec.trigger}</span></div>
          <div className="flex gap-1"><span className="font-bold text-purple-600 shrink-0">原因选项</span><span className="text-slate-500">{ATTENDANCE_SPEC.absenceReasonSpec.options}</span></div>
          <div className="flex gap-1"><span className="font-bold text-purple-600 shrink-0">持久化</span><span className="text-slate-500">{ATTENDANCE_SPEC.absenceReasonSpec.storage}</span></div>
          <div className="flex gap-1"><span className="font-bold text-purple-600 shrink-0">自动清理</span><span className="text-slate-500">{ATTENDANCE_SPEC.absenceReasonSpec.autoClean}</span></div>
        </div>
      </div>

      {/* 班组负责人口径 */}
      <div className="bg-sky-50/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-sky-600 uppercase tracking-wider"><Users size={10} /> 班组负责人（出勤日历表格）</div>
        <div className="space-y-1 text-[9px]">
          <div className="flex gap-1"><span className="font-bold text-sky-600 shrink-0">持久化</span><span className="text-slate-500">{ATTENDANCE_SPEC.groupLeadersSpec.storage}</span></div>
        </div>
        <div className="grid grid-cols-1 gap-0.5 mt-1">
          {ATTENDANCE_SPEC.groupLeadersSpec.fields.map((f: { col: string; desc: string }) => (
            <div key={f.col} className="flex items-start gap-1 text-[9px]">
              <span className="font-mono font-bold text-slate-600">{f.col}</span>
              <span className="text-slate-400">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 text-[9px] text-slate-400 italic leading-relaxed space-y-1">
        <p>* 出勤判定: 日出勤明细中有该人该日期的记录 = 出勤(true); 无记录 = 缺勤(false)</p>
        <p>* 人员筛选: 花名册中 二级部门 包含[中心操作] 且 转运中心 匹配当前选中中心</p>
        <p>* 数据优先级: IndexedDB 真实数据 &gt; 静态 JSON fallback</p>
      </div>
    </div>
  );
}

// ── 匹配逻辑章节 ──
function MatchingSection() {
  return (
    <div className="space-y-5">
      <div className="bg-blue-50/40 rounded-lg p-3 space-y-1.5">
        <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider">匹配逻辑</div>
        {MATCHING_SPEC.rules.map(rule => (
          <div key={rule.name} className="flex items-start gap-1.5 text-[9px]">
            <span className="font-bold text-blue-600 shrink-0">{rule.name}</span>
            <span className="text-slate-500">{rule.desc}</span>
          </div>
        ))}
        <div className="text-[8px] text-slate-400 italic mt-1">{MATCHING_SPEC.notes}</div>
      </div>

      {/* 各指标明细字段汇总 */}
      <div className="space-y-3">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider">弹窗明细字段汇总</div>
        {([
          { title: '效能异常', fields: DETAIL_FIELDS.job, color: 'text-red-600' },
          { title: '绩效异常', fields: DETAIL_FIELDS.salary, color: 'text-amber-600' },
          { title: '连续出勤', fields: DETAIL_FIELDS.att15, color: 'text-orange-600' },
          { title: '长期未出勤', fields: DETAIL_FIELDS.att7, color: 'text-purple-600' },
        ]).map(g => (
          <div key={g.title} className="bg-slate-50 rounded-lg p-2.5 space-y-1">
            <div className={cn("text-[9px] font-black uppercase tracking-wider", g.color)}>{g.title}</div>
            <div className="grid grid-cols-2 gap-0.5">
              {g.fields.map((f: { col: string; desc: string }) => (
                <div key={f.col} className="flex items-start gap-1 text-[9px]">
                  <span className="font-mono font-bold text-slate-600">{f.col}</span>
                  <span className="text-slate-400">{f.desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimateWrapper({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed right-4 top-20 bottom-14 w-[420px] z-[101] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in slide-in-from-right duration-200 ease-out">
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </>
  );
}
