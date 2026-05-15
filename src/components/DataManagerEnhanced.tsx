import React, { useState, useCallback } from 'react';
import { 
  Database, 
  Upload, 
  AlertCircle, 
  CheckCircle, 
  BarChart3,
  Trash2,
  TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import DataUploaderEnhanced from './DataUploaderEnhanced';
import { DataType, CenterData } from '../types/data';
import { parseDataByTemplate, extractDateFromData } from '../lib/dataParser';
import { saveDailyData, cleanupExpiredData, getStorageStats, getAllDates, getDataByDate, clearRawDataByType, getRawDataStats, clearAllData } from '../lib/database';

interface DataManagerProps {
  onDataLoaded: (data: any[], fileName: string, dataType: DataType, date: string) => void;
}

type TabType = 'upload' | 'overview';

export default function DataManagerEnhanced({ onDataLoaded }: DataManagerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [uploadCount, setUploadCount] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [dataStats, setDataStats] = useState<Record<string, number>>({});

  // 加载 IndexedDB 实际存储统计
  const refreshStats = useCallback(async () => {
    const stats = await getRawDataStats();
    setDataStats(stats);
    const typesWithData = Object.values(stats).filter(c => c > 0).length;
    const rows = Object.values(stats).reduce((a, b) => a + b, 0);
    setUploadCount(typesWithData);
    setTotalRows(rows);
  }, []);

  React.useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const handleFileProcessed = useCallback(async (
    rawData: any[], 
    fileName: string, 
    dataType: DataType,
    date: string
  ) => {
    try {
      // 解析数据
      const parsedData = parseDataByTemplate(rawData, dataType, date);
      
      // 保存到数据库（聚合数据，轻量）
      await saveDailyData(date, dataType, parsedData);
      
      // 通知父组件（App.tsx 会调用 saveRawData 存原始数据到 IndexedDB）
      onDataLoaded(rawData, fileName, dataType, date);
      
      // 刷新统计
      await refreshStats();
    } catch (error) {
      console.error('[上传] 数据处理失败:', error);
      alert(`数据处理失败: ${error instanceof Error ? error.message : '未知错误'}\n请检查文件格式和列名是否正确`);
    }
  }, [onDataLoaded, refreshStats]);

  const handleError = useCallback((error: string) => {
    console.error('上传错误:', error);
  }, []);

  const handleCleanup = async () => {
    if (confirm('确定要清理超过 30 天的数据吗？此操作不可恢复。')) {
      const deleted = await cleanupExpiredData(30);
      alert(`清理完成：删除了 ${deleted} 天的数据`);
    }
  };

  return (
    <div className="w-full h-full bg-zinc-50">
      {/* 顶部操作栏 */}
      <div className="bg-white border-b border-zinc-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
              <Database size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">数据管理中心</h2>
              <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                已存储 {uploadCount}/7 种数据类型 • 共 {totalRows.toLocaleString()} 条记录
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCleanup}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-amber-200 transition-colors"
          >
            <Trash2 size={14} />
            清理过期数据
          </button>
        </div>
      </div>

      {/* 标签页导航 */}
      <div className="bg-white border-b border-zinc-200 px-8">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              "px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
              activeTab === 'upload'
                ? "border-red-600 text-red-600 bg-red-50"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
            )}
          >
            <Upload size={14} />
            数据上传
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
              activeTab === 'overview'
                ? "border-red-600 text-red-600 bg-red-50"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50"
            )}
          >
            <Database size={14} />
            数据概览
          </button>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-8">
        {activeTab === 'upload' && (
          <DataUploaderEnhanced 
            onFileProcessed={handleFileProcessed}
            onError={handleError}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewTab onCleaned={() => setUploadCount(0)} />
        )}
      </div>
    </div>
  );
}

// 数据概览 — 合并历史数据/存储统计/数据清理为一体
function OverviewTab({ onCleaned }: { onCleaned: () => void }) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStats = useCallback(async () => {
    const [rawStats, info] = await Promise.all([getRawDataStats(), getStorageStats()]);
    setStats(rawStats);
    setStorageInfo(info);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const handleClear = async (key: string, label: string) => {
    const count = stats[key] || 0;
    if (count === 0) { alert(`「${label}」暂无数据，无需清理`); return; }
    if (!confirm(`确定要清除「${label}」的全部数据吗？\n共 ${count} 条记录，此操作不可恢复。`)) return;

    setCleaning(key);
    try {
      await new Promise(r => setTimeout(r, 100));
      const deleted = await clearRawDataByType(key);
      await refreshStats();
      onCleaned();
      alert(`已清除「${label}」，共 ${deleted} 条记录`);
    } catch (e) {
      console.error('[清理] 失败:', e);
      alert(`清除「${label}」失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setCleaning(null);
    }
  };

  const handleClearAll = async () => {
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    if (total === 0) return;
    if (!confirm(`确定要清除全部数据吗？\n共 ${total} 条记录，此操作不可恢复。`)) return;

    setCleaning('all');
    try {
      await new Promise(r => setTimeout(r, 100));
      await clearAllData();
      await refreshStats();
      onCleaned();
      alert(`已清除全部数据，共 ${total} 条记录`);
    } catch (e) {
      console.error('[清理全部] 失败:', e);
      alert(`清除全部数据失败: ${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setCleaning(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-2 border-zinc-300 border-t-red-600 rounded-full animate-spin-faster mx-auto mb-4" />
        <p className="text-zinc-600">加载中...</p>
      </div>
    );
  }

  const totalRows = Object.values(stats).reduce((a, b) => a + b, 0);
  const typesWithData = Object.values(stats).filter(c => c > 0).length;
  const maxRows = Math.max(...Object.values(stats).filter(c => c > 0), 1);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-zinc-200">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">数据类型</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{typesWithData}<span className="text-sm text-zinc-400 font-bold">/7</span></p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">总记录数</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{totalRows.toLocaleString()}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-200">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">聚合数据</p>
          <p className="text-2xl font-black text-zinc-900 mt-1">{storageInfo?.storageSizeKB || '0.00'}<span className="text-sm text-zinc-400 font-bold"> KB</span></p>
        </div>
      </div>

      {/* 各类型数据一览表（含清除按钮） */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
          <h4 className="font-black text-sm text-zinc-900 flex items-center gap-2">
            <BarChart3 size={16} />
            各数据类型详情
          </h4>
          <button
            onClick={handleClearAll}
            disabled={cleaning !== null || totalRows === 0}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all",
              totalRows > 0 && cleaning === null
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-zinc-100 text-zinc-300"
            )}
          >
            {cleaning === 'all' ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={13} />
            )}
            清除全部
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">数据类型</th>
              <th className="text-left px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">说明</th>
              <th className="text-right px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">记录数</th>
              <th className="text-center px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">分布</th>
              <th className="text-center px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">状态</th>
              <th className="text-right px-6 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {DATA_TYPE_CONFIG.map(config => {
              const count = stats[config.key] || 0;
              const hasData = count > 0;
              const pct = count > 0 ? Math.round((count / maxRows) * 100) : 0;
              const isCleaning = cleaning === config.key;

              return (
                <tr key={config.key} className={cn(
                  "border-b border-zinc-100 last:border-0 transition-colors",
                  hasData ? "bg-white hover:bg-zinc-50/50" : "bg-zinc-50/50"
                )}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-lg", config.bgColor)}>
                        {config.icon}
                      </div>
                      <span className={cn("font-black text-sm", config.color)}>{config.label}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-500 text-xs max-w-[280px]">{config.desc}</td>
                  <td className="px-6 py-4 text-right font-mono font-black text-zinc-900">{count.toLocaleString()}</td>
                  <td className="px-6 py-4 w-[120px]">
                    <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", count > 0 ? "bg-red-500" : "bg-zinc-200")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {hasData ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase">
                        <CheckCircle size={10} />
                        已存储
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-100 text-zinc-400 text-[10px] font-black uppercase">
                        <AlertCircle size={10} />
                        未上传
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleClear(config.key, config.label)}
                      disabled={cleaning !== null}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all ml-auto",
                        count > 0 && cleaning === null
                          ? "text-red-600 bg-red-50 hover:bg-red-100"
                          : "text-zinc-300 bg-zinc-50 cursor-default"
                      )}
                    >
                      {isCleaning ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      清除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 存储说明 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2 text-sm">
            <TrendingUp size={16} />
            存储说明
          </h4>
          <ul className="text-xs text-blue-800 space-y-1.5">
            <li>• 原始 Excel 数据存储在浏览器 IndexedDB 中（支持大数据量）</li>
            <li>• 汇总聚合数据存储在 localStorage 中（显示为上方「聚合数据」KB 数）</li>
            <li>• 刷新页面不会丢失数据，数据持久保存在本地浏览器中</li>
          </ul>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            注意事项
          </h4>
          <ul className="text-xs text-amber-800 space-y-1.5">
            <li>• 清除后数据不可恢复，请谨慎操作</li>
            <li>• 清除后重新上传数据即可恢复</li>
            <li>• 薪资异常和中心出勤支持多天累积，清除会删除全部历史</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// 数据类型配置
const DATA_TYPE_CONFIG: { key: string; label: string; icon: string; color: string; bgColor: string; desc: string }[] = [
  { key: 'salary_performance', label: '薪资异常数据', icon: '💰', color: 'text-amber-700', bgColor: 'bg-amber-50', desc: '工资偏高人员明细，用于绩效异常弹窗和覆盖率计算' },
  { key: 'attendance_15days', label: '连续15日出勤', icon: '📅', color: 'text-orange-700', bgColor: 'bg-orange-50', desc: '连续15日出勤数据，用于连续出勤得分计算' },
  { key: 'attendance_7days', label: '连续7日未出勤', icon: '🚫', color: 'text-purple-700', bgColor: 'bg-purple-50', desc: '连续7日未出勤数据，用于长期未出勤得分计算' },
  { key: 'employee_roster', label: '在职花名册', icon: '👥', color: 'text-emerald-700', bgColor: 'bg-emerald-50', desc: '中心在职花名册，用于管幅计算（综合管幅+组长管幅）和覆盖率分母' },
  { key: 'center_daily_attendance', label: '日出勤明细', icon: '📆', color: 'text-cyan-700', bgColor: 'bg-cyan-50', desc: '个人当天是否出勤数据，用于考勤汇总统计' },
  { key: 'job_performance', label: '岗位效能异常', icon: '📊', color: 'text-red-700', bgColor: 'bg-red-50', desc: '岗位效能异常数据，用于效能异常弹窗展示' },
];


