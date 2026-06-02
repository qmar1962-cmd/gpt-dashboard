/**
 * 看板配置加载器 — 从 localStorage 读取，未配置时返回默认值
 */

interface DashboardConfig {
  centerResponsibles: Record<string, string>;
  centerClass: Record<string, string>;
  scoring: {
    jobDeviationThreshold: number;
    salaryCoverageThreshold: number;
    att15RateThreshold: number;
    whHighRateThreshold: number;
  };
  nonopThresholds: Record<string, number>;
  spanTargets: { composite: number; leader: number };
  exemptCenters: string[];
}

const DEFAULT: DashboardConfig = {
  centerResponsibles: {},
  centerClass: {},
  scoring: {
    jobDeviationThreshold: 10,
    salaryCoverageThreshold: 3,
    att15RateThreshold: 3,
    whHighRateThreshold: 10,
  },
  nonopThresholds: { A: 8, B: 10, C: 12 },
  spanTargets: { composite: 25, leader: 35 },
  exemptCenters: [],
};

let _cache: DashboardConfig | null = null;

export function loadDashboardConfig(): DashboardConfig {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem('gpt_dashboard_config');
    if (raw) {
      const parsed = JSON.parse(raw);
      _cache = {
        ...DEFAULT,
        ...parsed,
        scoring: { ...DEFAULT.scoring, ...(parsed.scoring || {}) },
        nonopThresholds: { ...DEFAULT.nonopThresholds, ...(parsed.nonopThresholds || {}) },
        spanTargets: { ...DEFAULT.spanTargets, ...(parsed.spanTargets || {}) },
      };
    }
  } catch {}
  return _cache || DEFAULT;
}

/** ConfigPanel 保存后调用，清除缓存 */
export function clearConfigCache() {
  _cache = null;
}

/** 获取中心分类（默认 B） */
export function getCenterClass(centerName: string): string {
  return loadDashboardConfig().centerClass[centerName] || 'B';
}

/** 获取中心负责人 */
export function getCenterResponsible(centerName: string): string {
  return loadDashboardConfig().centerResponsibles[centerName] || '';
}

/** 获取评分阈值 */
export function getScoringConfig() {
  return loadDashboardConfig().scoring;
}

/** 获取管幅目标 */
export function getSpanTargets() {
  return loadDashboardConfig().spanTargets;
}

/** 获取非操阈值（按分类） */
export function getNonopThreshold(cls: string): number {
  return loadDashboardConfig().nonopThresholds[cls] || 10;
}
