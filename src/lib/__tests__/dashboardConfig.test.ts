import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// localStorage mock — vitest 默认 Node 环境没有 localStorage
// 在模块导入前 stub，保证 loadDashboardConfig 运行时能访问到
// ---------------------------------------------------------------------------
const store = new Map<string, string>();
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
  removeItem: vi.fn((key: string) => { store.delete(key); }),
  clear: vi.fn(() => { store.clear(); }),
};
vi.stubGlobal('localStorage', mockLocalStorage);

// suppress console.warn noise in test output
vi.spyOn(console, 'warn').mockImplementation(() => {});

import {
  loadDashboardConfig,
  clearConfigCache,
  getCenterClass,
  getCenterResponsible,
  getScoringConfig,
  getSpanTargets,
  getNonopThreshold,
} from '../dashboardConfig';

// ---------------------------------------------------------------------------
beforeEach(() => {
  store.clear();
  clearConfigCache(); // 清除模块内部缓存
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
describe('loadDashboardConfig', () => {
  it('localStorage 无数据时返回默认值', () => {
    const cfg = loadDashboardConfig();
    expect(cfg.scoring.jobDeviationThreshold).toBe(10);
    expect(cfg.scoring.salaryCoverageThreshold).toBe(3);
    expect(cfg.scoring.att15RateThreshold).toBe(3);
    expect(cfg.scoring.whHighRateThreshold).toBe(10);
    expect(cfg.nonopThresholds).toEqual({ A: 8, B: 10, C: 12 });
    expect(cfg.spanTargets).toEqual({ composite: 25, leader: 35 });
    expect(cfg.centerResponsibles).toEqual({});
    expect(cfg.centerClass).toEqual({});
    expect(cfg.exemptCenters).toEqual([]);
  });

  it('localStorage 有数据时正确解析并合并', () => {
    const stored = {
      centerResponsibles: { SZ01: 'Zhang San' },
      centerClass: { SZ01: 'A' },
      scoring: { jobDeviationThreshold: 15 },
      nonopThresholds: { A: 5 },
      spanTargets: { composite: 30 },
      exemptCenters: ['SZ02'],
    };
    store.set('gpt_dashboard_config', JSON.stringify(stored));

    const cfg = loadDashboardConfig();

    // 顶层合并
    expect(cfg.centerResponsibles).toEqual({ SZ01: 'Zhang San' });
    expect(cfg.centerClass).toEqual({ SZ01: 'A' });
    expect(cfg.exemptCenters).toEqual(['SZ02']);

    // scoring 深层合并：覆盖的用新值，未覆盖的保留默认
    expect(cfg.scoring.jobDeviationThreshold).toBe(15);
    expect(cfg.scoring.salaryCoverageThreshold).toBe(3); // 默认
    expect(cfg.scoring.att15RateThreshold).toBe(3);
    expect(cfg.scoring.whHighRateThreshold).toBe(10);

    // nonopThresholds 深层合并
    expect(cfg.nonopThresholds.A).toBe(5);
    expect(cfg.nonopThresholds.B).toBe(10); // 默认
    expect(cfg.nonopThresholds.C).toBe(12); // 默认

    // spanTargets 深层合并
    expect(cfg.spanTargets.composite).toBe(30);
    expect(cfg.spanTargets.leader).toBe(35); // 默认
  });

  it('localStorage JSON 格式错误时降级为默认值', () => {
    store.set('gpt_dashboard_config', 'this is not valid json');

    const cfg = loadDashboardConfig();

    // 应吞掉错误，返回完整默认值
    expect(cfg.scoring.jobDeviationThreshold).toBe(10);
    expect(cfg.nonopThresholds).toEqual({ A: 8, B: 10, C: 12 });
    expect(console.warn).toHaveBeenCalledOnce();
  });

  it('stored 中缺少 scoring/nonopThresholds/spanTargets 时深层对象不被覆盖', () => {
    // 只存部分字段，没有 scoring 等嵌套对象
    store.set('gpt_dashboard_config', JSON.stringify({ centerClass: { WH01: 'A' } }));

    const cfg = loadDashboardConfig();
    // 嵌套对象应保持默认
    expect(cfg.scoring).toEqual({
      jobDeviationThreshold: 10,
      salaryCoverageThreshold: 3,
      att15RateThreshold: 3,
      whHighRateThreshold: 10,
    });
    expect(cfg.nonopThresholds).toEqual({ A: 8, B: 10, C: 12 });
    expect(cfg.spanTargets).toEqual({ composite: 25, leader: 35 });
    expect(cfg.centerClass.WH01).toBe('A');
  });

  // 审查改进1：非对象 JSON 类型异常测试
  describe('非对象 JSON 类型异常', () => {
    it.each([
      ['数组', '[1,2,3]'],
      ['字符串', '"hello"'],
      ['null', 'null'],
      ['数字', '42'],
      ['布尔', 'true'],
    ])('localStorage 存 %s 时不崩溃并返回默认值', (_, raw) => {
      store.set('gpt_dashboard_config', raw);
      const cfg = loadDashboardConfig();
      expect(cfg.scoring.jobDeviationThreshold).toBe(10);
      expect(cfg.scoring.salaryCoverageThreshold).toBe(3);
      expect(cfg.nonopThresholds).toEqual({ A: 8, B: 10, C: 12 });
      expect(cfg.spanTargets).toEqual({ composite: 25, leader: 35 });
      expect(cfg.exemptCenters).toEqual([]);
    });
  });

  // 审查改进2：字段值类型不一致
  it('字段值类型不一致时不崩溃（如数字字段存成字符串）', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ scoring: { jobDeviationThreshold: '15' } }));
    const cfg = loadDashboardConfig();
    expect(cfg.scoring.jobDeviationThreshold).toBe('15');
    expect(cfg.scoring.att15RateThreshold).toBe(3);
    expect(cfg.scoring.whHighRateThreshold).toBe(10);
  });

  // 审查改进3：缓存命中验证
  it('缓存命中时只读取一次 localStorage', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ centerClass: { SZ01: 'A' } }));
    loadDashboardConfig();
    expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(1);
    loadDashboardConfig();
    loadDashboardConfig();
    expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(1);
  });

  // 审查改进5：边界用例 — scoring 为 null
  it('scoring 为 null 时使用默认评分', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ scoring: null }));
    const cfg = loadDashboardConfig();
    expect(cfg.scoring).toEqual({
      jobDeviationThreshold: 10,
      salaryCoverageThreshold: 3,
      att15RateThreshold: 3,
      whHighRateThreshold: 10,
    });
  });

  // 审查改进5：边界用例 — exemptCenters
  it('exemptCenters 可正常存储和读取', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ exemptCenters: ['WH01', 'SZ02', 'CD03'] }));
    const cfg = loadDashboardConfig();
    expect(cfg.exemptCenters).toEqual(['WH01', 'SZ02', 'CD03']);
  });

  it('exemptCenters 未配置时默认为空数组', () => {
    const cfg = loadDashboardConfig();
    expect(cfg.exemptCenters).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe('clearConfigCache', () => {
  it('清缓存后 loadDashboardConfig 重新读取', () => {
    // 第一次写入
    store.set('gpt_dashboard_config', JSON.stringify({ centerClass: { SZ01: 'A' } }));
    const cfg1 = loadDashboardConfig();
    expect(cfg1.centerClass.SZ01).toBe('A');

    // 修改 localStorage + 清缓存
    store.set('gpt_dashboard_config', JSON.stringify({ centerClass: { SZ01: 'C' } }));
    clearConfigCache();

    const cfg2 = loadDashboardConfig();
    expect(cfg2.centerClass.SZ01).toBe('C');
  });
});

// ---------------------------------------------------------------------------
describe('getCenterClass', () => {
  it('无配置时返回默认值 B', () => {
    expect(getCenterClass('ANY')).toBe('B');
  });

  it('有配置时返回配置值', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ centerClass: { SZ01: 'A' } }));
    expect(getCenterClass('SZ01')).toBe('A');
    // 未配置的仍返回 B
    expect(getCenterClass('SZ02')).toBe('B');
  });
});

// ---------------------------------------------------------------------------
describe('getCenterResponsible', () => {
  it('无配置时返回空字符串', () => {
    expect(getCenterResponsible('ANY')).toBe('');
  });

  it('有配置时返回负责人', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ centerResponsibles: { SZ01: 'Li Si' } }));
    expect(getCenterResponsible('SZ01')).toBe('Li Si');
    expect(getCenterResponsible('SZ02')).toBe('');
  });
});

// ---------------------------------------------------------------------------
describe('getScoringConfig', () => {
  it('返回默认评分阈值', () => {
    expect(getScoringConfig()).toEqual({
      jobDeviationThreshold: 10,
      salaryCoverageThreshold: 3,
      att15RateThreshold: 3,
      whHighRateThreshold: 10,
    });
  });

  it('localStorage 覆盖部分阈值', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ scoring: { jobDeviationThreshold: 20 } }));
    expect(getScoringConfig().jobDeviationThreshold).toBe(20);
    expect(getScoringConfig().att15RateThreshold).toBe(3);
  });
});

// ---------------------------------------------------------------------------
describe('getSpanTargets', () => {
  it('返回默认管幅目标', () => {
    expect(getSpanTargets()).toEqual({ composite: 25, leader: 35 });
  });

  it('localStorage 覆盖部分目标', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ spanTargets: { composite: 40 } }));
    expect(getSpanTargets().composite).toBe(40);
    expect(getSpanTargets().leader).toBe(35);
  });
});

// ---------------------------------------------------------------------------
describe('getNonopThreshold', () => {
  it('默认分类阈值', () => {
    expect(getNonopThreshold('A')).toBe(8);
    expect(getNonopThreshold('B')).toBe(10);
    expect(getNonopThreshold('C')).toBe(12);
  });

  it('未知分类返回兜底值 10', () => {
    expect(getNonopThreshold('D')).toBe(10);
    expect(getNonopThreshold('')).toBe(10);
  });

  it('localStorage 覆盖特定分类阈值', () => {
    store.set('gpt_dashboard_config', JSON.stringify({ nonopThresholds: { B: 6 } }));
    expect(getNonopThreshold('A')).toBe(8);
    expect(getNonopThreshold('B')).toBe(6);
    expect(getNonopThreshold('C')).toBe(12);
  });
});
