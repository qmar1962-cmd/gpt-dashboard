import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, Ban, CheckCircle2, ExternalLink } from 'lucide-react';
import { RegionalData } from '../types';
import { cn, formatNumber } from '../lib/utils';
import { getWeeklyEfficiencyDetail, WeeklyDetail, getWeeklySalaryDetail, SalaryWeeklyDetail, getWeeklyAttendance15Detail, Attendance15WeeklyDetail, getWeeklyAttendance7Detail, Attendance7WeeklyDetail } from '../lib/dataProcessor';
import EfficiencyDetailModal from './EfficiencyDetailModal';
import SalaryDetailModal from './SalaryDetailModal';
import Attendance15DetailModal from './Attendance15DetailModal';
import Attendance7DetailModal from './Attendance7DetailModal';

import { Selection } from '../App';

interface DataTableProps {
  data: RegionalData[];
  onSelect?: (selection: Selection) => void;
  currentSelection?: Selection;
  adminMode?: boolean;
  exemptCenters?: Set<string>;
  onToggleExempt?: (centerId: string) => void;
  rawData?: any[];
  salaryData?: any[];
  attendanceData?: any[];
  attendance15Data?: any[];
  attendance7Data?: any[];
  rosterData?: any[];
}

interface DetailModalState {
  isOpen: boolean;
  centerName: string;
  provinceName: string;
  weeklyData: WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

interface SalaryModalState {
  isOpen: boolean;
  centerName: string;
  provinceName: string;
  weeklyData: SalaryWeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

interface Attendance15ModalState {
  isOpen: boolean;
  centerName: string;
  provinceName: string;
  weeklyData: Attendance15WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

interface Attendance7ModalState {
  isOpen: boolean;
  centerName: string;
  provinceName: string;
  weeklyData: Attendance7WeeklyDetail[];
  currentCount: number;
  prevCount: number;
}

export default function DataTable({ data, onSelect, currentSelection, adminMode, exemptCenters, onToggleExempt, rawData, salaryData, attendanceData, attendance15Data, attendance7Data, rosterData }: DataTableProps) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({ 'shanghai-prov': true });
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [salaryModal, setSalaryModal] = useState<SalaryModalState>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [attendance15Modal, setAttendance15Modal] = useState<Attendance15ModalState>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });
  const [attendance7Modal, setAttendance7Modal] = useState<Attendance7ModalState>({
    isOpen: false,
    centerName: '',
    provinceName: '',
    weeklyData: [],
    currentCount: 0,
    prevCount: 0,
  });

  const toggleRow = (id: string, e: React.MouseEvent) => {
    // Avoid double trigger if clicking on something that also selects
    e.stopPropagation();
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleRegionClick = (item: RegionalData) => {
    if (onSelect) {
      onSelect({ type: 'region', id: item.id, label: item.province });
    }
  };

  const handleCenterClick = (center: any, item: RegionalData) => {
    if (onSelect) {
      onSelect({ type: 'center', id: center.id, label: `${item.province} - ${center.name}` });
    }
  };

  return (
    <div className="w-full border-t border-zinc-200 bg-white" id="performance-data-table">
      {/* Table Header */}
      <div className="grid grid-cols-[50px_160px_80px_100px_100px_1fr] bg-zinc-50 border-b border-zinc-200 py-3 px-4 sticky top-[95px] z-20">
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">排名</div>
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em]">分区 / 负责人</div>
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] text-right">绩效得分</div>
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] text-right">管幅</div>
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] text-right">超目标</div>
        <div className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] text-center">各维度明细</div>
      </div>

      <div className="flex flex-col">
        {[...data].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0)).map((item, idx) => (
          <React.Fragment key={item.id}>
            {/* Province Row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => handleRegionClick(item)}
              className={cn(
                "grid grid-cols-[50px_160px_80px_100px_100px_1fr] items-center py-5 px-4 border-b border-zinc-100 cursor-pointer group transition-all",
                currentSelection?.id === item.id ? "bg-zinc-900 text-white shadow-[0_0_30px_rgba(0,0,0,0.2)] z-20" : 
                expandedRows[item.id] ? "bg-white shadow-[0_0_25px_rgba(0,0,0,0.03)] z-10" : "bg-white hover:bg-zinc-50/50"
              )}
            >
              <div className={cn(
                "text-3xl font-black italic tracking-tighter transition-opacity",
                currentSelection?.id === item.id ? "opacity-100" : "opacity-10 group-hover:opacity-100"
              )}>#{idx + 1}</div>
              
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="font-black text-base uppercase tracking-tighter leading-none mb-1">{item.province}</span>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest leading-none",
                    currentSelection?.id === item.id ? "opacity-60" : "opacity-30"
                  )}>{item.responsible}</span>
                </div>
                {item.subCenters && (
                   <div 
                     onClick={(e) => toggleRow(item.id, e)}
                     className={cn("transition-transform duration-300 p-2 hover:bg-black/10 rounded-full", expandedRows[item.id] ? "rotate-180" : "")}
                   >
                     <ChevronDown size={14} className={currentSelection?.id === item.id ? "opacity-100" : "opacity-20"} />
                   </div>
                )}
              </div>

              <div className="text-right flex justify-end items-center gap-2 pr-4">
                <div className={cn(
                  "px-3 py-1 font-mono font-black text-sm",
                  item.performanceScore < 0 ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
                )}>
                  {formatNumber(item.performanceScore)}
                </div>
              </div>

              <div className="text-right pr-4 flex flex-col items-end justify-center gap-1">
                {(() => {
                  const centersWithScope = (item.subCenters || []).filter((c: any) => c.compositeScope !== undefined);
                  if (centersWithScope.length > 0) {
                    const avgComp = centersWithScope.reduce((s: number, c: any) => s + (c.compositeScope || 0), 0) / centersWithScope.length;
                    const avgLead = centersWithScope.reduce((s: number, c: any) => s + (c.leaderScope || 0), 0) / centersWithScope.length;
                    return (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 leading-none">综合</span>
                          <span className="font-black text-xl tracking-tighter leading-none">{avgComp.toFixed(1)}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 leading-none">组长</span>
                          <span className="font-black text-base tracking-tighter text-zinc-500 leading-none">{avgLead.toFixed(1)}</span>
                        </div>
                      </>
                    );
                  }
                  return <span className="text-sm font-bold text-zinc-300">—</span>;
                })()}
              </div>

              {/* 超目标列 */}
              <div className="text-right pr-4 flex flex-col items-end justify-center gap-1">
                {(() => {
                  const centersWithScope = (item.subCenters || []).filter((c: any) => c.compositeScope !== undefined);
                  if (centersWithScope.length > 0) {
                    const sumCompOT = centersWithScope.reduce((s: number, c: any) => s + (c.compOverTarget || 0), 0);
                    const sumLeadOT = centersWithScope.reduce((s: number, c: any) => s + (c.leadOverTarget || 0), 0);
                    return (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 leading-none">综合</span>
                          <span className={cn("font-black text-base font-mono tracking-tighter leading-none", sumCompOT > 0 ? "text-red-500" : sumCompOT < 0 ? "text-emerald-500" : "text-zinc-400")}>{sumCompOT > 0 ? '+' : ''}{sumCompOT.toFixed(1)}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 leading-none">组长</span>
                          <span className={cn("font-black text-xs font-mono tracking-tighter text-zinc-500 leading-none", sumLeadOT > 0 ? "!text-red-400" : sumLeadOT < 0 ? "!text-emerald-400" : "")}>{sumLeadOT > 0 ? '+' : ''}{sumLeadOT.toFixed(1)}</span>
                        </div>
                      </>
                    );
                  }
                  return <span className="text-sm font-bold text-zinc-300">—</span>;
                })()}
              </div>

              <div className="grid grid-cols-[repeat(4,1fr)] gap-2 pl-4 border-l border-zinc-100 min-w-0">
                <DimensionCell label="效能异常" score={item.dimensions?.job?.score ?? 0} metrics={item.dimensions?.job?.metrics ?? []} />
                <DimensionCell label="绩效异常" score={item.dimensions?.salary?.score ?? 0} metrics={item.dimensions?.salary?.metrics ?? []} />
                <DimensionCell label="连续出勤" score={item.dimensions?.attendance15?.score ?? 0} metrics={item.dimensions?.attendance15?.metrics ?? []} />
                <DimensionCell label="长期未出勤" score={item.dimensions?.attendance7?.score ?? 0} metrics={item.dimensions?.attendance7?.metrics ?? []} />
              </div>
            </motion.div>

            {/* Sub-Center Rows */}
            <AnimatePresence>
              {expandedRows[item.id] && item.subCenters?.map((center) => {
                const exempt = exemptCenters?.has(center.id) ?? false;
                return (
                <motion.div
                  key={center.id}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onClick={() => !adminMode && handleCenterClick(center, item)}
                  className={cn(
                    "grid grid-cols-[50px_160px_80px_100px_100px_1fr] items-center py-3 px-4 border-b border-zinc-50 transition-all",
                    adminMode ? "cursor-default" : "cursor-pointer",
                    exempt ? "opacity-40" : "",
                    currentSelection?.id === center.id && !adminMode ? "bg-red-600 text-white" : "bg-zinc-50/20 hover:bg-zinc-100/50 last:border-b-zinc-200"
                  )}
                >
                  <div />
                  <div className="flex items-center gap-2">
                    {/* 管理员模式：豁免开关 */}
                    {adminMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleExempt?.(center.id);
                        }}
                        title={exempt ? '点击恢复考核' : '点击豁免（不计入得分）'}
                        className={cn(
                          "flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wide transition-all border",
                          exempt
                            ? "bg-zinc-200 text-zinc-400 border-zinc-300 hover:bg-red-50 hover:border-red-300 hover:text-red-500"
                            : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-red-50 hover:border-red-300 hover:text-red-500"
                        )}
                      >
                        {exempt
                          ? <><Ban size={10} /> 豁免</>
                          : <><CheckCircle2 size={10} /> 考核</>
                        }
                      </button>
                    )}
                    <div className={cn(
                      "flex flex-col pl-4 border-l-4",
                      currentSelection?.id === center.id && !adminMode ? "border-white" : "border-zinc-900"
                    )}>
                      <span className="font-black text-xs uppercase tracking-tight">{center.name}中心</span>
                      <span className={cn(
                        "text-[9px] font-bold",
                        currentSelection?.id === center.id && !adminMode ? "opacity-80" : "opacity-30"
                      )}>{center.responsible}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className={cn(
                      "text-[10px] font-black px-2 py-1 rounded tracking-tight",
                      (center.score || 0) >= 80 ? "bg-emerald-100 text-emerald-700" :
                      (center.score || 0) >= 60 ? "bg-blue-100 text-blue-700" :
                      (center.score || 0) >= 40 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    )}>
                      {center.score ?? 0}
                    </span>
                  </div>
                  <div className={cn(
                    "text-right pr-4 flex flex-col items-end justify-center gap-1",
                    currentSelection?.id === center.id ? "opacity-100" : "opacity-40"
                  )}>
                    {center.compositeScope !== undefined ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 leading-none">综合</span>
                          <span className="font-black text-base tracking-tighter leading-none">{center.compositeScope?.toFixed(1)}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 leading-none">组长</span>
                          <span className="font-black text-xs tracking-tighter text-zinc-500 leading-none">{center.leaderScope?.toFixed(1)}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-zinc-300">—</span>
                    )}
                  </div>

                  {/* 超目标列 */}
                  <div className={cn(
                    "text-right pr-4 flex flex-col items-end justify-center gap-1",
                    currentSelection?.id === center.id ? "opacity-100" : "opacity-40"
                  )}>
                    {center.compositeScope !== undefined ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 leading-none">综合</span>
                          <span className={cn("font-black text-xs font-mono tracking-tighter leading-none", (center.compOverTarget || 0) > 0 ? "text-red-500" : (center.compOverTarget || 0) < 0 ? "text-emerald-500" : "text-zinc-400")}>{(center.compOverTarget || 0) > 0 ? '+' : ''}{(center.compOverTarget || 0).toFixed(1)}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[9px] font-bold text-zinc-400 leading-none">组长</span>
                          <span className={cn("font-black text-[10px] font-mono tracking-tighter text-zinc-500 leading-none", (center.leadOverTarget || 0) > 0 ? "!text-red-400" : (center.leadOverTarget || 0) < 0 ? "!text-emerald-400" : "")}>{(center.leadOverTarget || 0) > 0 ? '+' : ''}{(center.leadOverTarget || 0).toFixed(1)}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-zinc-300">—</span>
                    )}
                  </div>
                  <div className="grid grid-cols-[repeat(4,1fr)] gap-2 pl-4 border-l border-zinc-100 min-w-0">
                    <div
                      className={cn(
                        "flex flex-col border-l border-zinc-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        rawData && rawData.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={rawData && rawData.length > 0 ? "" : "请上传岗位效能异常数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (rawData && rawData.length > 0) {
                          const weekly = getWeeklyEfficiencyDetail(rawData, center.name, item.province);
                          setDetailModal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.abnormalCount || 0,
                            prevCount: center.prevAbnormalCount || 0,
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-tight flex items-center gap-1">
                          效能异常
                          {rawData && rawData.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-900 transition-colors",
                          rawData && rawData.length > 0 && "group-hover:bg-zinc-100"
                        )}>{center.metrics?.job ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">前一天</span>
                          <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{center.prevAbnormalCount || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">个数</span>
                          <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{center.abnormalCount || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex flex-col border-l border-zinc-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        salaryData && salaryData.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={salaryData && salaryData.length > 0 ? "" : "请上传薪资异常数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (salaryData && salaryData.length > 0) {
                          const weekly = getWeeklySalaryDetail(salaryData, center.name, item.province, attendanceData);
                          setSalaryModal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.metrics.salary || 0,
                            prevCount: center.prevSalaryCount || 0,
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-tight flex items-center gap-1">
                          绩效异常
                          {salaryData && salaryData.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-900 transition-colors",
                          salaryData && salaryData.length > 0 && "group-hover:bg-zinc-100"
                        )}>{center.metrics?.salary ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">覆盖率</span>
                          <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{center.salaryCoverage || '0%'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">算薪</span>
                          <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{center.salaryCount || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex flex-col border-l border-zinc-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        attendance15Data && attendance15Data.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={attendance15Data && attendance15Data.length > 0 ? "" : "请上传连续15日出勤数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (attendance15Data && attendance15Data.length > 0) {
                          const weekly = getWeeklyAttendance15Detail(attendance15Data, center.name, item.province);
                          setAttendance15Modal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.att15Count || 0,
                            prevCount: (center.att15Count || 0) - (center.att15New || 0),
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-tight flex items-center gap-1">
                          连续出勤
                          {attendance15Data && attendance15Data.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-900 transition-colors",
                          attendance15Data && attendance15Data.length > 0 && "group-hover:bg-zinc-100"
                        )}>{center.metrics?.att15 ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">触发率</span>
                          <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{center.att15Rate || '0%'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">新增</span>
                          <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{center.att15New || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex flex-col border-l border-zinc-200 pl-3 py-1 group relative min-w-0 overflow-hidden",
                        attendance7Data && attendance7Data.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                      )}
                      title={attendance7Data && attendance7Data.length > 0 ? "" : "请上传连续7日未出勤数据以查看详情"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (attendance7Data && attendance7Data.length > 0) {
                          const weekly = getWeeklyAttendance7Detail(attendance7Data, center.name, item.province);
                          setAttendance7Modal({
                            isOpen: true,
                            centerName: center.name,
                            provinceName: item.province,
                            weeklyData: weekly,
                            currentCount: center.att7Count || 0,
                            prevCount: (center.att7Count || 0) - (center.att7New || 0),
                          });
                        }
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-tight flex items-center gap-1">
                          长期未出勤
                          {attendance7Data && attendance7Data.length > 0 && (
                            <ExternalLink size={9} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm font-black px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-900 transition-colors",
                          attendance7Data && attendance7Data.length > 0 && "group-hover:bg-zinc-100"
                        )}>{center.metrics?.att7 ?? 0}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">异常</span>
                          <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{center.att7Count || 0}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
                          <span className="opacity-40 truncate">新增</span>
                          <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{center.att7New || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>
          </React.Fragment>
        ))}
      </div>

      {/* 效能异常详情弹窗 */}
      <EfficiencyDetailModal
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
        centerName={detailModal.centerName}
        provinceName={detailModal.provinceName}
        weeklyData={detailModal.weeklyData}
        currentCount={detailModal.currentCount}
        prevCount={detailModal.prevCount}
      />

      {/* 绩效异常详情弹窗 */}
      <SalaryDetailModal
        isOpen={salaryModal.isOpen}
        onClose={() => setSalaryModal(prev => ({ ...prev, isOpen: false }))}
        centerName={salaryModal.centerName}
        provinceName={salaryModal.provinceName}
        weeklyData={salaryModal.weeklyData}
        currentCount={salaryModal.currentCount}
        prevCount={salaryModal.prevCount}
      />

      {/* 连续出勤详情弹窗 */}
      <Attendance15DetailModal
        isOpen={attendance15Modal.isOpen}
        onClose={() => setAttendance15Modal(prev => ({ ...prev, isOpen: false }))}
        centerName={attendance15Modal.centerName}
        provinceName={attendance15Modal.provinceName}
        weeklyData={attendance15Modal.weeklyData}
        currentCount={attendance15Modal.currentCount}
        prevCount={attendance15Modal.prevCount}
      />

      {/* 长期未出勤详情弹窗 */}
      <Attendance7DetailModal
        isOpen={attendance7Modal.isOpen}
        onClose={() => setAttendance7Modal(prev => ({ ...prev, isOpen: false }))}
        centerName={attendance7Modal.centerName}
        provinceName={attendance7Modal.provinceName}
        weeklyData={attendance7Modal.weeklyData}
        currentCount={attendance7Modal.currentCount}
        prevCount={attendance7Modal.prevCount}
      />

      {/* Scoring Rules Footer */}
      <div className="p-8 bg-zinc-50 border-t border-zinc-200 mt-4">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-4">计分规则解析</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">岗位绩效异常</span>
              <p className="text-[11px] font-medium leading-relaxed">当月最后一天触发的岗位数量，每触发1个岗位扣5分。</p>
            </div>
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">个人薪资异常占比</span>
              <p className="text-[11px] font-medium leading-relaxed">个人薪资模块考核：覆盖率 ≤ 3% 得 25 分；覆盖率 &gt; 3%，每增加 1% 扣 5 分，最低 0 分。</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">连出勤15天异常占比</span>
              <p className="text-[11px] font-medium leading-relaxed">覆盖率 &le; 3% 不扣分；覆盖率 &gt; 3%，每增加1%扣5分。当月连续出勤 &gt; 30天，过程中每出现1人扣2分。</p>
            </div>
            <div className="rule-item">
              <span className="text-[9px] font-bold block opacity-50 uppercase">连未出勤7天异常</span>
              <p className="text-[11px] font-medium leading-relaxed">过程中出现1人扣2分，累计计分（不含病假、伤残、跨组织架构等特殊情况）。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DimensionCell({ label, score, metrics }: { label: string, score: number, metrics: any[] }) {
  return (
    <div className="flex flex-col border-l border-zinc-200 pl-3 py-1 min-w-0">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-black text-zinc-400 uppercase tracking-tight truncate">{label}</span>
        <span className={cn(
          "text-sm font-black px-1.5 py-0.5 rounded flex-shrink-0",
          score < 0 ? "bg-red-50 text-red-600" : "bg-zinc-50 text-zinc-900"
        )}>
          {score}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {metrics.map((m, i) => (
          <div key={i} className="flex justify-between items-center text-[9px] font-bold leading-none min-w-0">
            <span className="opacity-40 truncate">{m.label}</span>
            <span className="font-mono text-zinc-600 flex-shrink-0 ml-1">{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DimensionMini({ score, label, active }: { score: number, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "pl-4 border-l flex items-center justify-between group/mini flex-1",
      active ? "border-white/20" : "border-zinc-100"
    )}>
      <div className="flex flex-col">
        <span className={cn(
          "text-[8px] font-black uppercase transition-colors",
          active ? "text-white/60" : "text-zinc-300 group-hover/mini:text-zinc-500"
        )}>{label}</span>
        <span className={cn(
          "text-[11px] font-black leading-none", 
          score < 0 ? (active ? "text-white underline decoration-red-500 underline-offset-2" : "text-red-500") : (active ? "text-white" : "text-zinc-500")
        )}>{score}</span>
      </div>
      <div className={cn(
         "w-10 h-1 ml-2 rounded-full overflow-hidden",
         active ? "bg-white/20" : "bg-zinc-100"
      )}>
        <div 
          className={cn(
            "h-full transition-all duration-500", 
            score < 0 ? (active ? "bg-white" : "bg-red-500") : (active ? "bg-white" : "bg-zinc-800")
          )} 
          style={{ width: `${Math.max(5, Math.min(100, (Math.abs(score) / 25) * 100))}%` }} 
        />
      </div>
    </div>
  );
}
