import { RegionalData } from './types';

export const PERFORMANCE_DATA: RegionalData[] = [
  {
    id: 'hubei-prov',
    province: '湖北省区',
    responsible: '刘洋',
    performanceScore: 0,
    ranking: 1,
    totalScore: 0,
    dimensions: {
      job: { name: '效能异常', score: 0, weight: 25, metrics: [{ label: '前一天', value: 0 }, { label: '个数', value: 0 }] },
      salary: { name: '绩效异常', score: 0, weight: 25, metrics: [{ label: '覆盖率', value: '0%' }, { label: '算薪', value: 0 }] },
      attendance15: { name: '连续出勤', score: 0, weight: 25, metrics: [{ label: '触发率', value: '0%' }, { label: '新增', value: 0 }] },
      attendance7: { name: '长期未出勤', score: 0, weight: 25, metrics: [{ label: '异常', value: 0 }, { label: '新增', value: 0 }] }
    },
    subCenters: [
      { id: 'hb-1', name: '武汉', responsible: '臧英英', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'hb-2', name: '武昌', responsible: '万政', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'hb-3', name: '荆州', responsible: '刘志', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'hb-4', name: '襄阳', responsible: '李成程', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } }
    ]
  },
  {
    id: 'hunan-prov',
    province: '湖南省区',
    responsible: '陈缘杰',
    performanceScore: 0,
    ranking: 2,
    totalScore: 0,
    dimensions: {
      job: { name: '效能异常', score: 0, weight: 25, metrics: [{ label: '前一天', value: 0 }, { label: '个数', value: 0 }] },
      salary: { name: '绩效异常', score: 0, weight: 25, metrics: [{ label: '覆盖率', value: '0%' }, { label: '算薪', value: 0 }] },
      attendance15: { name: '连续出勤', score: 0, weight: 25, metrics: [{ label: '触发率', value: '0%' }, { label: '新增', value: 0 }] },
      attendance7: { name: '长期未出勤', score: 0, weight: 25, metrics: [{ label: '异常', value: 0 }, { label: '新增', value: 0 }] }
    },
    subCenters: [
      { id: 'hn-1', name: '长沙', responsible: '陈缘杰', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'hn-2', name: '衡阳', responsible: '杨清宇', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'hn-3', name: '常德', responsible: '张检', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } }
    ]
  },
  {
    id: 'henan-prov',
    province: '河南省区',
    responsible: '张晨',
    performanceScore: 0,
    ranking: 3,
    totalScore: 0,
    dimensions: {
      job: { name: '效能异常', score: 0, weight: 25, metrics: [{ label: '前一天', value: 0 }, { label: '个数', value: 0 }] },
      salary: { name: '绩效异常', score: 0, weight: 25, metrics: [{ label: '覆盖率', value: '0%' }, { label: '算薪', value: 0 }] },
      attendance15: { name: '连续出勤', score: 0, weight: 25, metrics: [{ label: '触发率', value: '0%' }, { label: '新增', value: 0 }] },
      attendance7: { name: '长期未出勤', score: 0, weight: 25, metrics: [{ label: '异常', value: 0 }, { label: '新增', value: 0 }] }
    },
    subCenters: [
      { id: 'he-1', name: '郑州', responsible: '李晓文', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'he-2', name: '漯河', responsible: '杨蒙蒙', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'he-3', name: '新乡', responsible: '谢海鹏', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'he-4', name: '商丘', responsible: '靳紫阳', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } }
    ]
  },
  {
    id: 'jiangxi-prov',
    province: '江西省区',
    responsible: '-',
    performanceScore: 0,
    ranking: 4,
    totalScore: 0,
    dimensions: {
      job: { name: '效能异常', score: 0, weight: 25, metrics: [{ label: '前一天', value: 0 }, { label: '个数', value: 0 }] },
      salary: { name: '绩效异常', score: 0, weight: 25, metrics: [{ label: '覆盖率', value: '0%' }, { label: '算薪', value: 0 }] },
      attendance15: { name: '连续出勤', score: 0, weight: 25, metrics: [{ label: '触发率', value: '0%' }, { label: '新增', value: 0 }] },
      attendance7: { name: '长期未出勤', score: 0, weight: 25, metrics: [{ label: '异常', value: 0 }, { label: '新增', value: 0 }] }
    },
    subCenters: [
      { id: 'jx-1', name: '南昌', responsible: '程傲坤', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'jx-2', name: '赣州', responsible: '刘鸿逸', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } },
      { id: 'jx-3', name: '横峰', responsible: '张鹏程', score: 0, metrics: { job: 0, salary: 0, att15: 0, att7: 0 } }
    ]
  }
];
