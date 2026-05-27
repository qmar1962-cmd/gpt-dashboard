/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 版本：2026-05-26 - 重构：拆分组件，提取数据加载逻辑
 */

import { useState } from 'react';
import { ShieldAlert, Zap, ArrowRight, BarChart3, Upload, Settings, CalendarDays } from 'lucide-react';
import AttendanceModule from './components/AttendanceModule';
import Login from './components/Login';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingOverlay from './components/LoadingOverlay';
import KPICard from './components/KPICard';
import DataTable from './components/DataTable';
import SummaryChart from './components/SummaryChart';
import DataManagerEnhanced from './components/DataManagerEnhanced';
import ReportModal from './components/ReportModal';
import MetricHelpPanel from './components/MetricHelpPanel';
import ConfirmModal from './components/ConfirmModal';
import { PERFORMANCE_DATA } from './constants';
import { cn } from './lib/utils';
import { beijingDate, beijingDateCN } from './lib/dateUtils';
import { DataType } from './lib/types.js';
import { useAdminMode } from './hooks/useAdminMode';
import { useAuth } from './hooks/useAuth';
import { useViewMode } from './hooks/useViewMode';
import { useDataInit } from './hooks/useDataInit';
import { useEnrichedData } from './hooks/useEnrichedData';
import { useFilteredData } from './hooks/useFilteredData';

export type Selection = {
  type: 'all' | 'region' | 'center';
  id: string | null;
  label?: string;
};

export default function App() {
  // ── Hooks ──
  const { isLoggedIn, loggedInUser, isAdminLogin, handleLoginSuccess, handleLogout } = useAuth();
  const { viewMode, setViewMode, safeSetViewMode, showLeaveConfirm, confirmLeave, cancelLeave } = useViewMode();
  const { adminMode, toggleAdmin, exemptCenters, toggleExempt } = useAdminMode();
  const {
    loading, customData, rawDataState, salaryDataState,
    attendance15DataState, attendance7DataState, rosterDataState,
    workHoursHighDataState, workHoursLowDataState,
    dataFileName, handleDataLoaded: rawHandleDataLoaded, initError,
  } = useDataInit();

  // ── 局部状态 ──
  const [selection, setSelection] = useState<Selection>({ type: 'all', id: null });
  const [reportOpen, setReportOpen] = useState(false);

  // ── 派生数据 ──
  const displayData = customData && customData.length > 0 ? customData : PERFORMANCE_DATA;
  const enrichedData = useEnrichedData(
    displayData, rawDataState, salaryDataState, attendance15DataState,
    attendance7DataState, rosterDataState, workHoursHighDataState, workHoursLowDataState,
  );
  const filteredData = useFilteredData(enrichedData, exemptCenters);

  const avgTotalScore = Math.round(filteredData.reduce((acc, curr) => acc + curr.totalScore, 0) / filteredData.length);
  const totalUnits = filteredData.length;

  // ── 事件处理 ──
  const handleSelect = (newSelection: Selection) => {
    if (selection.id === newSelection.id && selection.type === newSelection.type) {
      setSelection({ type: 'all', id: null });
    } else {
      setSelection(newSelection);
    }
  };

  const handleDataLoaded = async (data: any[], fileName: string, newDataType: DataType, date: string) => {
    await rawHandleDataLoaded(data, fileName, newDataType, date);
    setViewMode('dashboard');
  };

  // ── 时间 ──
  const formattedDate = beijingDate(0);
  const formattedT2Date = beijingDateCN(-2);

  // ── 渲染 ──
  return (
    <>
      <LoadingOverlay
        isLoading={loading.isLoading}
        message={loading.message}
        progress={loading.progress}
      />

      {initError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
          <span className="text-sm font-bold">数据加载失败：{initError}</span>
          <button
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-white text-red-600 text-xs font-bold rounded hover:bg-red-50"
          >
            刷新重试
          </button>
        </div>
      )}

      {!isLoggedIn ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex relative border-8 border-white overflow-hidden" id="bold-dashboard">
          {/* Vertical Intelligence Sidebar */}
          <nav className="w-16 h-full border-r border-zinc-200 flex flex-col items-center justify-center bg-white">
            <div className="flex items-center gap-4 whitespace-nowrap" style={{ writingMode: 'vertical-rl' }}>
              <span className="text-[10px] uppercase tracking-[0.3em] font-bold">报告：刘洋 {formattedDate}</span>
            </div>

            <div className="mt-auto mb-8 flex flex-col gap-4">
              <button
                onClick={toggleAdmin}
                className={cn(
                  "p-3 rounded-lg transition-all flex items-center justify-center",
                  adminMode
                    ? "bg-amber-500 text-white shadow-lg scale-110 ring-2 ring-amber-300"
                    : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                )}
                title={adminMode ? "退出管理员模式" : "管理员模式（设置考核豁免）"}
              >
                <Settings size={18} />
              </button>
              <button
                onClick={() => safeSetViewMode('dashboard')}
                className={`p-3 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'dashboard'
                    ? 'bg-red-600 text-white shadow-lg scale-110'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
                title="数据看板"
              >
                <BarChart3 size={18} />
              </button>
              <button
                onClick={() => safeSetViewMode('attendance')}
                className={`p-3 rounded-lg transition-all flex items-center justify-center ${
                  viewMode === 'attendance'
                    ? 'bg-red-600 text-white shadow-lg scale-110'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
                title="中心考勤"
              >
                <CalendarDays size={18} />
              </button>
              {isAdminLogin && (
                <button
                  onClick={() => safeSetViewMode('data')}
                  className={`relative p-3 rounded-lg transition-all flex items-center justify-center ${
                    viewMode === 'data'
                      ? 'bg-red-600 text-white shadow-lg scale-110'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                  title="数据上传与管理"
                >
                  <Upload size={20} strokeWidth={2.5} />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                </button>
              )}
            </div>
          </nav>

          {/* Main Stream Area */}
          <div className="flex-1 flex flex-col overflow-auto h-screen">
            <header className="h-24 min-h-[96px] border-b border-zinc-200 flex items-center justify-between px-12 bg-white sticky top-0 z-50">
              <div className="flex flex-col">
                <h1 className="text-5xl font-black tracking-tighter leading-none">GPT 数据通报</h1>
                <p className="text-[10px] uppercase tracking-[0.4em] font-semibold text-zinc-400 mt-1">中区绩效指标与数据复盘</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs font-mono bg-black text-white px-3 py-1">数据日期：{formattedT2Date}</span>
                <div className="flex items-center gap-2 mt-2 text-red-500">
                  <ShieldAlert size={14} className="animate-pulse" />
                  <span className="text-[10px] font-black border-b-2 border-red-500 uppercase">高风险动态反馈</span>
                </div>
                {loggedInUser && (
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                    <span className="font-bold text-zinc-700">
                      {loggedInUser.name}
                      {isAdminLogin && <span className="ml-1 text-amber-600">（管理员）</span>}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-zinc-400 hover:text-red-500 transition-colors underline underline-offset-2"
                      title="退出登录"
                    >
                      退出
                    </button>
                  </div>
                )}
              </div>
            </header>

            <main className="flex-1 grid grid-cols-12 auto-rows-min overflow-visible">
              {viewMode === 'data' ? (
                <div className="col-span-12">
                  <DataManagerEnhanced onDataLoaded={handleDataLoaded} />
                </div>
              ) : viewMode === 'attendance' ? (
                <div className="col-span-12">
                  <ErrorBoundary label="中心考勤模块">
                    <AttendanceModule />
                  </ErrorBoundary>
                </div>
              ) : (
                <>
                  {/* Main Visual & Registry */}
                  <div className="col-span-12 xl:col-span-9 border-r border-zinc-200 bg-white">
                    <div className="p-12 border-b border-zinc-200 bg-zinc-50/50">
                      <div className="flex justify-between items-end mb-8">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-400 block">中区加权平均得分统计</label>
                          <span className="text-6xl font-black leading-none tracking-tighter">{avgTotalScore} 分</span>
                        </div>
                        <div className="max-w-2xl text-right">
                          <p className="text-lg font-bold leading-tight">
                            {(() => {
                              const sortedByScore = [...filteredData].sort((a, b) => a.totalScore - b.totalScore);
                              const worstProv = sortedByScore.slice(0, 2);
                              if (customData && customData.length > 0) {
                                const worst = worstProv[0];
                                const second = worstProv[1];
                                if (!worst) return `已加载自定义数据：${dataFileName}，共 ${displayData.length} 个区域`;
                                const dims = worst.dimensions || {};
                                const dimScores = Object.entries(dims)
                                  .filter(([key, d]: [string, any]) => d && typeof d.score === 'number' && d.weight > 0)
                                  .sort((a, b) => a[1].score - b[1].score);
                                const worstDim = dimScores[0];
                                let summary = '';
                                if (second && second.totalScore < 60) {
                                  summary += `${second.province}（${second.totalScore}分）、`;
                                }
                                summary += `${worst.province}（${worst.totalScore}分）`;
                                if (worstDim) {
                                  summary += `，需重点关注${worstDim[1].name}指标`;
                                }
                                summary += '。';
                                return summary;
                              }
                              return `东区各维度得分已进入核心监控期。${displayData[0]?.province} 和 ${displayData[3]?.province} 的出勤指标触发系统预警。`;
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-0">
                      <div className="p-8 pb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <h2 className="text-xl font-black uppercase tracking-tighter italic border-b-4 border-black inline-block leading-none">区域注册监控器</h2>
                          <MetricHelpPanel />
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                          <span>过滤器：{selection.type === 'all' ? '所有节点' : selection.label}</span>
                          {customData && customData.length > 0 && (
                            <span className="text-red-500 font-bold">• 自定义数据</span>
                          )}
                        </div>
                      </div>
                      {adminMode && (
                        <div className="mx-8 mb-4 px-4 py-2 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-3">
                          <Settings size={14} className="text-amber-600 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                          <span className="text-[11px] font-black text-amber-700 uppercase tracking-wide">
                            管理员模式已激活 — 点击中心旁的按钮切换考核状态。
                            {exemptCenters.size > 0 && ` 当前豁免 ${exemptCenters.size} 个中心。`}
                          </span>
                          <button
                            onClick={toggleAdmin}
                            className="ml-auto text-[10px] font-black text-amber-600 hover:text-amber-800 underline whitespace-nowrap"
                          >
                            退出
                          </button>
                        </div>
                      )}
                      <DataTable
                        data={filteredData}
                        onSelect={handleSelect}
                        currentSelection={selection}
                        adminMode={adminMode}
                        exemptCenters={exemptCenters}
                        onToggleExempt={toggleExempt}
                        rawData={rawDataState || undefined}
                        salaryData={salaryDataState || undefined}
                        attendance15Data={attendance15DataState || undefined}
                        attendance7Data={attendance7DataState || undefined}
                        rosterData={rosterDataState || undefined}
                        workHoursHighData={workHoursHighDataState || undefined}
                        workHoursLowData={workHoursLowDataState || undefined}
                      />
                    </div>
                  </div>

                  {/* Tactical Sidebar */}
                  <div className="col-span-12 xl:col-span-3 flex flex-col bg-white border-l border-zinc-200">
                    <div className="p-8 border-b border-zinc-200">
                      <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-zinc-400 block mb-6 text-center">多维核心指标分析</span>
                      <div className="w-full aspect-square">
                        <SummaryChart selection={selection} data={filteredData} />
                      </div>
                      {selection.type !== 'all' && (
                        <div className="mt-4 flex justify-center">
                          <button
                            onClick={() => setSelection({ type: 'all', id: null })}
                            className="text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-black transition-colors flex items-center gap-1"
                          >
                            重置为全局概览 [CLEAR]
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2">
                      <KPICard
                        label="活跃节点"
                        value={totalUnits}
                        description={customData && customData.length > 0 ? "自定义数据" : "总上报点位"}
                        className="border-b border-r"
                      />
                      <KPICard
                        label="数据源"
                        value={customData && customData.length > 0 ? "上传" : "默认"}
                        trend={customData && customData.length > 0 ? 100 : 0}
                        description={customData && customData.length > 0 ? dataFileName : "系统预设"}
                        className="border-b"
                      />
                    </div>

                    <div className="p-8 flex-1 flex flex-col gap-6">
                      <div className="mt-auto">
                        <div className="bg-black text-white p-6 shadow-[6px_6px_0px_0px_rgba(239,68,68,0.3)]">
                          <div className="flex items-center gap-2 mb-3">
                            <Zap size={14} className="text-red-500 fill-red-500" />
                            <h5 className="text-[10px] font-bold uppercase tracking-[0.2em]">关键行动指令</h5>
                          </div>
                          <p className="text-[11px] font-bold leading-relaxed mb-4 opacity-80">
                            {(() => {
                              const allCenters: any[] = [];
                              filteredData.forEach(prov => {
                                (prov.subCenters || []).forEach((c: any) => {
                                  if (!exemptCenters.has(c.id)) {
                                    allCenters.push({
                                      province: prov.province,
                                      center: c.name,
                                      score: c.score || 0,
                                      jobCount: c.abnormalCount || 0,
                                      salaryCount: c.t2SalaryCount || 0,
                                      att15Count: c.t2Att15Count || 0,
                                      att7Count: c.t2Att7Count || 0,
                                    });
                                  }
                                });
                              });
                              if (customData && customData.length > 0 && allCenters.length > 0) {
                                const worstCenters = allCenters.sort((a, b) => a.score - b.score).slice(0, 2);
                                let actions: string[] = [];
                                worstCenters.forEach(c => {
                                  if (c.jobCount > 0) actions.push(`改善${c.center}岗位效能异常`);
                                  if (c.salaryCount > 0) actions.push(`修正${c.center}薪资异常`);
                                  if (c.att15Count > 0) actions.push(`确定${c.center}对应模块出勤率，落实调休计划`);
                                  if (c.att7Count > 0) actions.push(`确定${c.center}员工未出勤原因明细，及时清理离职员工`);
                                });
                                if (actions.length > 0) {
                                  return `优先处理：${actions.slice(0, 3).join('、')}。`;
                                }
                                return `${worstCenters[0].province}·${worstCenters[0].center}（${worstCenters[0].score}分）排名末尾，建议查看详情报告。`;
                              }
                              return '监测到上海及安徽省区出勤指标持续偏低，已触发人力资源风险预警。';
                            })()}
                          </p>
                          <button
                            onClick={() => setReportOpen(true)}
                            className="w-full py-2.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                          >
                            生成详情报告 <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </main>

            <footer className="h-20 min-h-[80px] border-t border-zinc-200 bg-zinc-100 flex items-center px-12 justify-between z-10">
              <div className="flex gap-8 items-center text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span>实时流：活跃</span>
                </div>
                <div className="h-4 w-px bg-zinc-300"></div>
                <span className="opacity-40">内部机密：4级加密</span>
              </div>
              <div className="flex gap-2">
                <div className="w-1 h-1 bg-zinc-900"></div>
                <div className="w-1 h-1 bg-zinc-900"></div>
                <div className="w-1 h-1 bg-zinc-900"></div>
                <div className="w-8 h-1 bg-zinc-900 ml-4"></div>
              </div>
            </footer>
          </div>
          <ReportModal
            isOpen={reportOpen}
            onClose={() => setReportOpen(false)}
            params={{
              filteredData,
              rawData: rawDataState || undefined,
              salaryData: salaryDataState || undefined,
              attendance15Data: attendance15DataState || undefined,
              attendance7Data: attendance7DataState || undefined,
              workHoursHighData: workHoursHighDataState || undefined,
              workHoursLowData: workHoursLowDataState || undefined,
            }}
          />
        </div>
      )}

      <ConfirmModal
        isOpen={showLeaveConfirm}
        title="有未保存的负责人修改"
        message="中心考勤界面有未保存的负责人修改，离开前是否保存到云端？"
        confirmText="保存并离开"
        cancelText="不保存，直接离开"
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </>
  );
}
