import { useState, useEffect } from 'react';
import { X, Settings, Save, RotateCcw } from 'lucide-react';
import { cn } from '../lib/utils';
import { clearConfigCache } from '../lib/dashboardConfig';

const CONFIG_KEY = 'gpt_dashboard_config';

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

const defaultConfig: DashboardConfig = {
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

function loadConfig(): DashboardConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {}
  return { ...defaultConfig };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  centers: { name: string; province: string }[];
  onConfigChange: (config: DashboardConfig) => void;
}

const CLASS_OPTIONS = ['A', 'B', 'C'];

export default function ConfigPanel({ isOpen, onClose, centers, onConfigChange }: Props) {
  const [config, setConfig] = useState<DashboardConfig>(loadConfig);
  const [tab, setTab] = useState<'centers' | 'scoring' | 'thresholds'>('centers');
  const [saved, setSaved] = useState(true);

  useEffect(() => { if (isOpen) { setConfig(loadConfig()); setSaved(true); } }, [isOpen]);

  const update = (patch: Partial<DashboardConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    clearConfigCache();
    onConfigChange(config);
    setSaved(true);
  };

  const handleReset = () => {
    setConfig({ ...defaultConfig });
    localStorage.removeItem(CONFIG_KEY);
    onConfigChange(defaultConfig);
    setSaved(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[80]" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white shadow-2xl z-[90] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-slate-600" />
            <h2 className="text-sm font-black text-slate-900">看板配置</h2>
          </div>
          <div className="flex items-center gap-1">
            {!saved && <span className="text-[10px] text-amber-500 font-medium mr-1">未保存</span>}
            <button onClick={handleSave} className={cn("p-1.5 rounded-lg transition-colors", saved ? "text-slate-300" : "text-blue-600 hover:bg-blue-50")} title="保存"><Save size={15} /></button>
            <button onClick={handleReset} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="恢复默认"><RotateCcw size={15} /></button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg ml-1"><X size={16} className="text-slate-400" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5">
          {[
            { key: 'centers' as const, label: '中心设置' },
            { key: 'scoring' as const, label: '评分规则' },
            { key: 'thresholds' as const, label: '阈值配置' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cn(
              "px-3 py-2 text-[11px] font-bold border-b-2 transition-colors",
              tab === t.key ? "border-slate-900 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-600",
            )}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'centers' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">中心负责人</h3>
                {centers.map(c => (
                  <div key={c.name} className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-slate-600 w-24 shrink-0">{c.name}</span>
                    <input
                      type="text"
                      value={config.centerResponsibles[c.name] || ''}
                      onChange={e => update({ centerResponsibles: { ...config.centerResponsibles, [c.name]: e.target.value } })}
                      placeholder="负责人姓名"
                      className="flex-1 px-2 py-1 text-[11px] border border-slate-200 rounded focus:outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">中心分类（影响非操占比阈值）</h3>
                {centers.map(c => (
                  <div key={c.name} className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-slate-600 w-24 shrink-0">{c.name}</span>
                    <div className="flex gap-1">
                      {CLASS_OPTIONS.map(cls => (
                        <button key={cls} onClick={() => update({ centerClass: { ...config.centerClass, [c.name]: cls } })}
                          className={cn("px-2.5 py-0.5 text-[10px] font-bold rounded border transition-colors",
                            (config.centerClass[c.name] || 'B') === cls ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200 hover:border-slate-400",
                        )}>{cls}类</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">豁免中心（不计入评分）</h3>
                {centers.map(c => (
                  <label key={c.name} className="flex items-center gap-2 mb-1.5 cursor-pointer">
                    <input type="checkbox" checked={config.exemptCenters.includes(c.name)}
                      onChange={e => {
                        const list = e.target.checked
                          ? [...config.exemptCenters, c.name]
                          : config.exemptCenters.filter(n => n !== c.name);
                        update({ exemptCenters: list });
                      }}
                      className="w-3.5 h-3.5" />
                    <span className="text-[11px] text-slate-600">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === 'scoring' && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">评分规则</h3>
              {[
                { key: 'jobDeviationThreshold' as const, label: '效能异常：目标偏离阈值（%）', unit: '%' },
                { key: 'salaryCoverageThreshold' as const, label: '绩效异常：覆盖率阈值（%）', unit: '%' },
                { key: 'att15RateThreshold' as const, label: '连续出勤≥15天：触发率阈值（%）', unit: '%' },
                { key: 'whHighRateThreshold' as const, label: '日工时高>12.5h：触发占比阈值（%）', unit: '%' },
              ].map(item => (
                <div key={item.key} className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600 flex-1">{item.label}</span>
                  <input type="number" value={config.scoring[item.key]} step={0.5}
                    onChange={e => update({ scoring: { ...config.scoring, [item.key]: parseFloat(e.target.value) || 0 } })}
                    className="w-16 px-2 py-1 text-[11px] border border-slate-200 rounded text-right focus:outline-none focus:border-blue-400" />
                  <span className="text-[10px] text-slate-400 w-4">{item.unit}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">管幅目标</h3>
                {[
                  { key: 'composite' as const, label: '综合管幅目标' },
                  { key: 'leader' as const, label: '组长管幅目标' },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-slate-600 flex-1">{item.label}</span>
                    <input type="number" value={config.spanTargets[item.key]} step={1}
                      onChange={e => update({ spanTargets: { ...config.spanTargets, [item.key]: parseInt(e.target.value) || 0 } })}
                      className="w-16 px-2 py-1 text-[11px] border border-slate-200 rounded text-right focus:outline-none focus:border-blue-400" />
                    <span className="text-[10px] text-slate-400 w-4">:1</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'thresholds' && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">非操占比阈值（按中心分类）</h3>
              {CLASS_OPTIONS.map(cls => (
                <div key={cls} className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] text-slate-600 w-16">{cls}类中心</span>
                  <input type="number" value={config.nonopThresholds[cls] || 0} step={0.5}
                    onChange={e => update({ nonopThresholds: { ...config.nonopThresholds, [cls]: parseFloat(e.target.value) || 0 } })}
                    className="w-20 px-2 py-1 text-[11px] border border-slate-200 rounded text-right focus:outline-none focus:border-blue-400" />
                  <span className="text-[10px] text-slate-400">%</span>
                </div>
              ))}
              <div className="pt-3 text-[10px] text-slate-400 leading-relaxed">
                非操占比 = (非操作人数+外包) ÷ (在册+外包)×100%。超过阈值扣分。
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
