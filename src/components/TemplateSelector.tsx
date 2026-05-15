import { DataType } from '../types/data';
import { cn } from '../lib/utils';

interface TemplateSelectorProps {
  selectedTemplate: DataType | null;
  onSelectTemplate: (template: DataType) => void;
}

interface TemplateItem {
  value: DataType;
  label: string;
  description: string;
  detail: string;
  fields: string[];
  cycle: string;
  icon: string;
}

const TEMPLATES: TemplateItem[] = [
  {
    value: 'job_performance',
    label: '岗位效能异常',
    description: '7 类岗位效能偏离数据，含目标值与实际绩效对比',
    detail: '卸车 / 装车 / 倒包 / 供件 / 封包 / 分拣 / 扫描',
    fields: ['岗位名称', '目标值', '人均日绩效', '目标偏离(%)'],
    cycle: '每日',
    icon: '📊',
  },
  {
    value: 'salary_performance',
    label: '薪资绩效异常',
    description: '工资偏高人员明细，用于覆盖率及算薪计算',
    detail: '覆盖率 = 薪资异常人数 / 算薪人数',
    fields: ['省区', '中心', '覆盖率', '影响人数'],
    cycle: '每日',
    icon: '💰',
  },
  {
    value: 'attendance_15days',
    label: '连续15日出勤',
    description: '连续出勤≥15天的异常人员数据',
    detail: '含覆盖率、触发率、新增人数等指标',
    fields: ['省区', '中心', '覆盖率', '触发率', '新增人数'],
    cycle: '每日',
    icon: '📅',
  },
  {
    value: 'attendance_7days',
    label: '连续7日未出勤',
    description: '连续7天未出勤的异常人员数据',
    detail: '含异常人数及累计计分',
    fields: ['省区', '中心', '异常人数', '累计计分'],
    cycle: '每日',
    icon: '🚫',
  },
  {
    value: 'employee_roster',
    label: '中心在职花名册',
    description: '在职员工信息汇总，用于管幅计算',
    detail: '综合管幅 = (总人数 - 组长 - 主管) / (组长 + 主管)',
    fields: ['省区', '中心', '员工ID', '姓名', '岗位', '二级部门'],
    cycle: '每周',
    icon: '👥',
  },
  {
    value: 'center_daily_attendance',
    label: '中心考勤明细',
    description: '个人日出勤明细，用于考勤模块日历展示',
    detail: '含工号、姓名、部门、组别、岗位、是否出勤',
    fields: ['日期', '省区', '中心', '工号', '姓名', '二级部门', '组别', '岗位', '是否出勤'],
    cycle: '每日',
    icon: '📆',
  },
];

export const TEMPLATE_LABELS = Object.fromEntries(TEMPLATES.map(t => [t.value, t.label]));

export default function TemplateSelector({ selectedTemplate, onSelectTemplate }: TemplateSelectorProps) {
  return (
    <div className="w-full max-w-5xl mx-auto mb-10">
      <div className="mb-6">
        <h3 className="text-base font-bold text-zinc-800">选择数据类型</h3>
        <p className="text-sm text-zinc-400 mt-1">请选择要上传的数据文件类型</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {TEMPLATES.map(t => {
          const isSelected = selectedTemplate === t.value;
          return (
            <button
              key={t.value}
              onClick={() => onSelectTemplate(t.value)}
              className={cn(
                "p-5 text-left transition-all rounded-xl",
                isSelected
                  ? "bg-zinc-900 text-white shadow-lg"
                  : "bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm"
              )}
            >
              <div className="flex items-center justify-end mb-2">
                <span className={cn(
                  "text-[11px] font-bold px-2 py-0.5 rounded-md",
                  isSelected
                    ? "bg-white/20 text-white/90"
                    : "bg-zinc-100 text-zinc-400"
                )}>
                  {t.cycle}
                </span>
              </div>

              <div className={cn(
                "font-bold text-sm leading-tight mb-1.5",
                isSelected ? "text-white" : "text-zinc-800"
              )}>
                {t.label}
              </div>

              <p className={cn(
                "text-xs leading-relaxed mb-1",
                isSelected ? "text-zinc-300" : "text-zinc-500"
              )}>
                {t.description}
              </p>

              <p className={cn(
                "text-xs leading-relaxed mb-3",
                isSelected ? "text-zinc-400" : "text-zinc-400"
              )}>
                {t.detail}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {t.fields.map(f => (
                  <span
                    key={f}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      isSelected
                        ? "bg-white/10 text-zinc-300"
                        : "bg-zinc-50 text-zinc-400"
                    )}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
