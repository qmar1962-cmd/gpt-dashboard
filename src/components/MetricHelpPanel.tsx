import React, { useState } from 'react';
import { HelpCircle, X, Table2, ArrowRight, Hash, FileSpreadsheet, CalendarDays, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

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
  { id: 'employee_roster', name: '中心在职花名册', rows: '全部在职人员（含非操作部门）', dedup: '工号' },
  { id: 'center_daily_attendance', name: '中心日出勤明细', rows: '每人每天一条（有记录=出勤）', dedup: '工号 + 数据日期' },
];

// ── 汇总指标 ──
const AGGREGATION_SPEC = {
  items: [
    { name: '中心绩效得分', formula: '效能得分 + 薪资得分 + 连续出勤得分 + 长期未出勤得分（四项之和，满分100）' },
    { name: '省区绩效得分', formula: '下属参与考核中心得分的算术平均值（取整）' },
    { name: '全区平均分', formula: '各省区总分的算术平均值（取整）' },
    { name: '省区排名', formula: '按省区总分降序排列' },
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
    { col: '当月人均日绩效', desc: '实际人均日绩效值' },
    { col: '目标值', desc: '岗位日绩效目标值' },
    { col: '目标偏离(%)', desc: '(实际-目标)/目标 × 100，≥10% 判为异常' },
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
    formula: '仅统计 目标偏离(%) >= 10% 的岗位\n得分 = max(0, 25 - 异常岗位数 * 5)\nT-2 vs T-3 对比得出新增数量',
    notes: '数据日期为 T-2 (前天)，与弹窗柱状图保持一致，仅统计偏离度>=10%',
    detailFields: DETAIL_FIELDS.job,
  },
  {
    id: 'salary',
    name: '绩效异常',
    weight: 25,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    sourceTable: '薪资异常数据表 (salary_performance)',
    keyColumns: [
      { col: '中心 / 中心名称', desc: '子中心名称' },
      { col: '姓名', desc: '薪资偏高人员' },
      { col: '岗位', desc: '人员岗位' },
      { col: '数据日期', desc: '统计日期' },
    ],
    formula: '覆盖率 = T-2 薪资异常人数 / 在职人数 * 100%\n得分: <=3% 得 25 分; >3% 每多 1% 扣 5 分\n分母 = 花名册中 [二级部门] 含 [中心操作] 的人员总数',
    denominator: '花名册在职人数 (employee_roster) -> 过滤 二级部门 包含"中心操作"',
    notes: '分母统一使用花名册在职人数，非出勤人数*1.12',
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
    formula: '触发率 = 连续出勤>=15天人数 / 在职人数 * 100%\n扣分项:\n  触发率 >3% 时，每多 1% 扣 5 分\n  连续出勤 >30 天者，每人额外扣 2 分',
    denominator: '同上: 花名册在职人数 (中心操作部门)',
    notes: '仅统计连续出勤天数 >=15 天的记录',
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
    formula: '每出现 1 人扣 2 分 (累计计分)，最低 0 分\nmax(0, 25 - 未出勤人数 * 2)',
    notes: '仅统计连续未出勤天数 >=7 天的记录',
    detailFields: DETAIL_FIELDS.att7,
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
    { name: '小组负责人', formula: '来源：花名册中 [组别] 对应的 [操作组长/主管人员姓名]\n手动覆盖优先级最高（localStorage 持久化），花名册重新上传后手动修改仍保留' },
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
  // 排休计划口径（连续出勤弹窗）
  leavePlanSpec: {
    trigger: '连续出勤 ≥ 15天的人员',
    storage: '按工号存储在 localStorage（key: leave_plans_global），15天自动过期',
    autoMatch: '花名册重新上传后，按工号自动匹配已有排休计划',
    fields: [
      { col: '排休开始', desc: '选择排休开始日期' },
      { col: '排休结束', desc: '选择排休结束日期' },
      { col: '设置日期', desc: '记录创建日期，用于判断15天过期' },
    ],
  },
  // 未出勤原因口径（长期未出勤弹窗）
  absenceReasonSpec: {
    trigger: '连续未出勤 ≥ 7天的人员',
    options: '工伤 / 事假 / 病假 / 纠纷 / 挂编 / 出差 / 离职未清 / 已返岗',
    storage: '按工号存储在 localStorage（key: absence_reasons_global），断天自动失效',
    autoClean: '不在当前视图中的工号记录自动删除（断天 = 该人不再是连续未出勤≥7天）',
  },
};

export default function MetricHelpPanel() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="w-5 h-5 rounded-full border border-zinc-300 flex items-center justify-center transition-all duration-200 hover:border-red-400 hover:bg-red-50 group" title="查看各指标数据口径说明">
        <HelpCircle size={13} className="text-zinc-400 group-hover:text-red-500 transition-colors" />
      </button>
      <AnimateWrapper isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
            <div>
              <h3 className="text-sm font-black text-zinc-900 tracking-tight">指标口径说明</h3>
              <p className="text-[10px] text-zinc-400 mt-0.5">数据来源 / 取数字段 / 计算规则</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="w-6 h-6 rounded-full hover:bg-zinc-100 flex items-center justify-center transition-colors"><X size={14} className="text-zinc-400" /></button>
          </div>

          {/* 日期概念 */}
          <div className="bg-zinc-50 rounded-lg p-3 space-y-2">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">日期概念</div>
            <div className="grid grid-cols-3 gap-1.5">
              {DATE_CONCEPTS.map(dc => (
                <div key={dc.term} className="bg-white rounded-md px-2 py-1.5 border border-zinc-100">
                  <span className="font-mono font-black text-[11px] text-zinc-800">{dc.term}</span>
                  <p className="text-[9px] text-zinc-400 mt-0.5 leading-tight">{dc.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 数据源总览 */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">数据源总览（6种上传类型）</div>
            <div className="grid gap-1">
              {DATA_SOURCES.map(ds => (
                <div key={ds.id} className="bg-zinc-50 rounded-md px-3 py-2 flex items-center gap-3">
                  <span className="font-mono font-bold text-[10px] text-zinc-700 min-w-[140px]">{ds.name}</span>
                  <span className="text-[9px] text-zinc-400">{ds.rows}</span>
                  <span className="ml-auto text-[8px] text-zinc-300 font-mono">{ds.dedup}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 汇总指标 */}
          <div className="bg-zinc-900 text-white rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider"><ArrowRight size={10} /> 汇总指标</div>
            {AGGREGATION_SPEC.items.map(item => (
              <div key={item.name} className="space-y-0.5">
                <span className="text-[10px] font-bold text-white">{item.name}</span>
                <pre className="text-[9px] leading-relaxed text-zinc-300 whitespace-pre-wrap font-mono">{item.formula}</pre>
              </div>
            ))}
            <div className="pt-1.5 border-t border-zinc-700 text-[9px] text-amber-400/80 italic">{AGGREGATION_SPEC.exemptions}</div>
          </div>

          {/* 匹配逻辑 */}
          <div className="bg-blue-50/40 rounded-lg p-3 space-y-1.5">
            <div className="text-[10px] font-black text-blue-600 uppercase tracking-wider">匹配逻辑</div>
            {MATCHING_SPEC.rules.map(rule => (
              <div key={rule.name} className="flex items-start gap-1.5 text-[9px]">
                <span className="font-bold text-blue-600 shrink-0">{rule.name}</span>
                <span className="text-zinc-500">{rule.desc}</span>
              </div>
            ))}
            <div className="text-[8px] text-zinc-400 italic mt-1">{MATCHING_SPEC.notes}</div>
          </div>

          {METRIC_SPECS.map((spec) => (
            <div key={spec.id} className="group">
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider", spec.color)}>{spec.weight}分</span>
                <span className="font-bold text-xs text-zinc-900">{spec.name}</span>
                <FileSpreadsheet size={11} className="text-zinc-300 ml-auto" />
              </div>
              <div className="bg-zinc-50 rounded-lg p-3 mb-2 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider"><Table2 size={11} /> 数据来源</div>
                <div className="text-xs font-mono font-semibold text-zinc-800 bg-white rounded-md px-2 py-1.5 border border-zinc-100">{spec.sourceTable}</div>
                <div className="grid grid-cols-2 gap-1">
                  {spec.keyColumns.map((col) => (
                    <div key={col.col} className="flex items-start gap-1.5 text-[10px]">
                      <Hash size={9} className="text-zinc-300 mt-0.5 flex-shrink-0" />
                      <span className="font-mono font-bold text-zinc-700">{col.col}</span>
                      <span className="text-zinc-400">{col.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-900 text-white rounded-lg p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-400 uppercase tracking-wider"><ArrowRight size={10} /> 计算公式</div>
                <pre className="text-[10px] leading-relaxed text-zinc-300 whitespace-pre-wrap font-mono">{spec.formula}</pre>
                {spec.denominator && (<div className="mt-1.5 pt-1.5 border-t border-zinc-700"><span className="text-[9px] text-zinc-500">分母: </span><span className="text-[10px] text-emerald-400 font-medium">{spec.denominator}</span></div>)}
                {spec.notes && (<div className="mt-1 pt-1.5 border-t border-zinc-700 text-[9px] text-zinc-500 italic">{spec.notes}</div>)}
              </div>
              {spec.detailFields && (
                <div className="bg-amber-50/40 rounded-lg p-2.5 mt-1.5 space-y-1.5">
                  <div className="text-[9px] font-black text-amber-600 uppercase tracking-wider">弹窗明细字段</div>
                  <div className="grid grid-cols-2 gap-0.5">
                    {spec.detailFields.map((f: { col: string; desc: string }) => (
                      <div key={f.col} className="flex items-start gap-1 text-[9px]">
                        <span className="font-mono font-bold text-zinc-600">{f.col}</span>
                        <span className="text-zinc-400">{f.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* 管幅 */}
          <div className="pt-4 border-t border-zinc-200 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded border border-zinc-300 text-zinc-600 uppercase tracking-wider">辅助</span>
              <span className="font-bold text-xs text-zinc-800">管幅 &amp; 超目标</span>
            </div>
            <div className="bg-blue-50/50 rounded-lg p-3 mb-2 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-wider"><Table2 size={11} /> 数据来源</div>
              <div className="text-xs font-mono font-semibold text-zinc-800 bg-white rounded-md px-2 py-1.5 border border-zinc-100">{SCOPE_SPEC.sourceTable}</div>
              <div className="grid grid-cols-2 gap-1">
                {SCOPE_SPEC.keyColumns.map((col) => (
                  <div key={col.col} className="flex items-start gap-1.5 text-[10px]">
                    <Hash size={9} className="text-zinc-300 mt-0.5 flex-shrink-0" />
                    <span className="font-mono font-bold text-zinc-700">{col.col}</span>
                    <span className="text-zinc-400">{col.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900 text-white rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider"><ArrowRight size={10} /> 计算公式</div>
              {SCOPE_SPEC.formulas.map((f, i) => (<pre key={i} className="text-[10px] leading-relaxed text-zinc-300 font-mono">{f}</pre>))}
              <div className="mt-1 pt-1.5 border-t border-zinc-700 text-[9px] text-zinc-500 italic">操作人数 = 总人数 - 组长数 - 主管数</div>
              {SCOPE_SPEC.rosterTargetNote && <div className="pt-1 text-[9px] text-amber-400/80 italic">{SCOPE_SPEC.rosterTargetNote}</div>}
            </div>
          </div>

          {/* 中心考勤 */}
          <div className="pt-4 border-t border-zinc-200 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays size={14} className="text-cyan-500" />
              <span className="font-bold text-xs text-zinc-800">中心考勤</span>
              <span className="text-[9px] text-zinc-400 font-normal ml-1">独立模块 - 日历视图 + 预警</span>
            </div>

            {ATTENDANCE_SPEC.dataSources.map((ds, idx) => (
              <div key={idx} className="bg-zinc-50 rounded-lg p-3 mb-2 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider"><Table2 size={11} /> 数据来源{idx + 1}</div>
                  <span className="text-[8px] font-medium px-1.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100">{ds.role.split('-')[0].trim()}</span>
                </div>
                <div className="text-xs font-mono font-semibold text-zinc-800 bg-white rounded-md px-2 py-1.5 border border-zinc-100">{ds.table}</div>
                <div className="grid grid-cols-1 gap-0.5">
                  {ds.columns.map((col) => (
                    <div key={col.col} className="flex items-start gap-1.5 text-[10px]">
                      <Hash size={9} className="text-cyan-300 mt-0.5 flex-shrink-0" />
                      <span className="font-mono font-bold text-zinc-700 min-w-0">{col.col}</span>
                      <span className="text-zinc-400 flex-shrink-0">-&gt;</span>
                      <span className="text-zinc-500">{col.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="space-y-2 mt-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500 uppercase tracking-wider"><ArrowRight size={10} /> 指标计算 (共 {ATTENDANCE_SPEC.metrics.length} 项)</div>
              <div className="grid gap-1.5">
                {ATTENDANCE_SPEC.metrics.map((m) => (
                  <div key={m.name} className="bg-zinc-900 text-white rounded-lg p-2.5 space-y-1">
                    <span className="text-[10px] font-bold text-white block">{m.name}</span>
                    <pre className="text-[9px] leading-relaxed text-zinc-300 whitespace-pre-wrap font-mono">{m.formula}</pre>
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
                    <span className="font-mono font-bold text-zinc-600 min-w-[56px] shrink-0">{f.col}</span>
                    <span className="text-zinc-400">{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 排休计划口径 */}
            <div className="bg-orange-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 uppercase tracking-wider"><CalendarDays size={10} /> 排休计划（连续出勤弹窗）</div>
              <div className="space-y-1 text-[9px]">
                <div className="flex gap-1"><span className="font-bold text-orange-600 shrink-0">触发条件</span><span className="text-zinc-500">{ATTENDANCE_SPEC.leavePlanSpec.trigger}</span></div>
                <div className="flex gap-1"><span className="font-bold text-orange-600 shrink-0">持久化</span><span className="text-zinc-500">{ATTENDANCE_SPEC.leavePlanSpec.storage}</span></div>
                <div className="flex gap-1"><span className="font-bold text-orange-600 shrink-0">自动匹配</span><span className="text-zinc-500">{ATTENDANCE_SPEC.leavePlanSpec.autoMatch}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-0.5 mt-1">
                {ATTENDANCE_SPEC.leavePlanSpec.fields.map((f: { col: string; desc: string }) => (
                  <div key={f.col} className="flex items-start gap-1 text-[9px]">
                    <span className="font-mono font-bold text-zinc-600">{f.col}</span>
                    <span className="text-zinc-400">{f.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 未出勤原因口径 */}
            <div className="bg-purple-50/40 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 uppercase tracking-wider"><AlertCircle size={10} /> 未出勤原因（长期未出勤弹窗）</div>
              <div className="space-y-1 text-[9px]">
                <div className="flex gap-1"><span className="font-bold text-purple-600 shrink-0">触发条件</span><span className="text-zinc-500">{ATTENDANCE_SPEC.absenceReasonSpec.trigger}</span></div>
                <div className="flex gap-1"><span className="font-bold text-purple-600 shrink-0">原因选项</span><span className="text-zinc-500">{ATTENDANCE_SPEC.absenceReasonSpec.options}</span></div>
                <div className="flex gap-1"><span className="font-bold text-purple-600 shrink-0">持久化</span><span className="text-zinc-500">{ATTENDANCE_SPEC.absenceReasonSpec.storage}</span></div>
                <div className="flex gap-1"><span className="font-bold text-purple-600 shrink-0">自动清理</span><span className="text-zinc-500">{ATTENDANCE_SPEC.absenceReasonSpec.autoClean}</span></div>
              </div>
            </div>

            <div className="mt-2 text-[9px] text-zinc-400 italic leading-relaxed space-y-1">
              <p>* 出勤判定: 日出勤明细中有该人该日期的记录 = 出勤(true); 无记录 = 缺勤(false)</p>
              <p>* 人员筛选: 花名册中 二级部门 包含[中心操作] 且 转运中心 匹配当前选中中心</p>
              <p>* 数据优先级: IndexedDB 真实数据 &gt; 静态 JSON fallback</p>
            </div>
          </div>
        </div>
      </AnimateWrapper>
    </>
  );
}

function AnimateWrapper({ isOpen, onClose, children }) {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="fixed right-4 top-20 bottom-14 w-[420px] z-[101] bg-white rounded-xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col animate-in slide-in-from-right duration-200 ease-out">
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </>
  );
}
