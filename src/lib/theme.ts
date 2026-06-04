// 六维度颜色映射（与 Tailwind 颜色一致）
export const DIM_COLORS = {
  job:    { hex: '#ef4444', tailwind: 'red',    label: '效能异常' },
  salary: { hex: '#f59e0b', tailwind: 'amber',  label: '绩效异常' },
  att15:  { hex: '#3b82f6', tailwind: 'blue',   label: '连续出勤' },
  att7:   { hex: '#8b5cf6', tailwind: 'violet',  label: '长期未出勤' },
  whHigh: { hex: '#f97316', tailwind: 'orange', label: '日工时高' },
  whLow:  { hex: '#06b6d4', tailwind: 'cyan',   label: '日工时低' },
} as const;

export type DimKey = keyof typeof DIM_COLORS;
