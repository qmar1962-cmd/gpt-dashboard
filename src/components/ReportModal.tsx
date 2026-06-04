/**
 * 详情报告弹窗 — 自动生成文字报告 + 总览图导出
 */
import { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Download, Image, FileText, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { generateReport, renderReportAsText, type FullReport } from '../lib/reportGenerator';
import { getNonopThreshold, getCenterClass } from '../lib/dashboardConfig';
import { cn } from '../lib/utils';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: {
    filteredData: any[];
    rawData?: any[];
    salaryData?: any[];
    attendance15Data?: any[];
    attendance7Data?: any[];
    workHoursHighData?: any[];
    workHoursLowData?: any[];
  };
}

const DIM_LABELS: Record<string, string> = {
  jobAbnormalCount: '效能异常', salaryCount: '绩效异常', att15Count: '连续出勤',
  att7Count: '长期未出勤', workHoursHighCount: '日工时高', workHoursLowCount: '日工时低',
};
const DIM_UNITS: Record<string, string> = {
  jobAbnormalCount: '个', salaryCount: '人', att15Count: '人',
  att7Count: '人', workHoursHighCount: '人', workHoursLowCount: '人',
};
type DimKey = keyof typeof DIM_LABELS;

export default function ReportModal({ isOpen, onClose, params }: ReportModalProps) {
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<FullReport | null>(null);
  const [textContent, setTextContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imgStatus, setImgStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [imgMsg, setImgMsg] = useState('');
  const [expandedProvince, setExpandedProvince] = useState<string | null>(null);
  const imgTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isOpen) return;
    try {
      setError(null);
      const rep = generateReport(params);
      const text = renderReportAsText(rep);
      setReport(rep);
      setTextContent(text);
    } catch (e: any) {
      console.error('[ReportModal] 报告生成失败:', e);
      setError(e?.message || '报告生成失败，请检查数据');
      setReport(null);
      setTextContent('');
    }
  }, [isOpen, params]);

  useEffect(() => () => { if (imgTimerRef.current) clearTimeout(imgTimerRef.current); }, []);

  if (!isOpen) return null;

  if (error || !report) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white w-[90%] max-w-sm rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="bg-red-600 text-white px-5 py-4 flex items-center gap-3">
            <AlertTriangle size={18} /><h2 className="text-sm font-black">报告生成失败</h2>
          </div>
          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-slate-500">{error || '未知错误'}</p>
            <button onClick={onClose} className="px-5 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800">关闭</button>
          </div>
        </div>
      </div>
    );
  }

  const dimKeys: DimKey[] = ['jobAbnormalCount', 'salaryCount', 'att15Count', 'att7Count', 'workHoursHighCount', 'workHoursLowCount'];
  const totals = {} as Record<DimKey, number>;
  dimKeys.forEach(k => { totals[k] = report.provinces.reduce((s, p) => s + p.centers.reduce((c, cc) => c + (cc[k] || 0), 0), 0); });

  // Canvas 总览图生成（稍作精调）
  const handleGenerateOverviewImage = async () => {
    if (!report || imgStatus === 'generating') return;
    setImgStatus('generating'); setImgMsg('');
    try {
      const rows = report.overviewTable || [];
      const headers = ['中心', '得分', '管幅', '超目标', '非操', '效能异常', '绩效异常', '连续出勤', '长期未出勤', '日工时高', '日工时低'];
      const colWidths = [80, 50, 85, 85, 55, 55, 60, 60, 70, 70, 70];
      // 非操标红阈值（从配置读取）
      const nonOpThresholds: Record<string, number> = {};
      rows.forEach(r => {
        nonOpThresholds[r.centerName] = getNonopThreshold(getCenterClass(r.centerName));
      });
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const rowHeight = 42, headerHeight = 36, titleHeight = 72, footerHeight = 28, padding = 4;
      const tableHeight = headerHeight + rows.length * rowHeight;
      const canvasWidth = tableWidth + padding * 2;
      const canvasHeight = titleHeight + tableHeight + footerHeight + 20;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * 2; canvas.height = canvasHeight * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);

      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 标题栏
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, canvasWidth, titleHeight);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText('GPT 数据总览', padding, 14);
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`数据日期：${report.reportDate}`, padding, 42);
      // 分数字标
      const scoreText = `全区均分 ${report.overallScore} 分`;
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      const sw = ctx.measureText(scoreText).width;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(canvasWidth - padding - sw - 28, 18, sw + 28, 32);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(scoreText, canvasWidth - padding - sw / 2 - 14, 34);

      // 表头
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, titleHeight, canvasWidth, headerHeight);
      ctx.fillStyle = '#fafafa';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textBaseline = 'middle';
      let xPos = padding;
      headers.forEach((h, i) => {
        ctx.textAlign = i === 0 ? 'left' : 'center';
        ctx.fillText(h, i === 0 ? xPos + 10 : xPos + colWidths[i] / 2, titleHeight + headerHeight / 2);
        xPos += colWidths[i];
      });

      // 数据行
      rows.forEach((row, r) => {
        const y = titleHeight + headerHeight + r * rowHeight;
        ctx.fillStyle = r % 2 === 0 ? '#fafafa' : '#ffffff';
        ctx.fillRect(0, y, canvasWidth, rowHeight);
        ctx.strokeStyle = '#e4e4e7'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y + rowHeight); ctx.lineTo(canvasWidth, y + rowHeight); ctx.stroke();

        const cell = (t: string, x: number, w: number, c: string, a: 'left' | 'center' = 'center') => {
          ctx.fillStyle = c; ctx.textAlign = a; ctx.textBaseline = 'middle';
          ctx.fillText(t, a === 'left' ? x + 10 : x + w / 2, y + rowHeight / 2);
        };
        const twoLine = (l1: string, l2: string, x: number, w: number, c1: string, c2: string) => {
          const mid = y + rowHeight / 2;
          ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillStyle = c1; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(l1, x + w / 2, mid - 7);
          ctx.fillStyle = c2; ctx.fillText(l2, x + w / 2, mid + 7);
        };

        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        xPos = padding;
        cell(row.centerName, xPos, colWidths[0], '#18181b', 'left'); xPos += colWidths[0];
        cell(String(row.score), xPos, colWidths[1], row.score >= 80 ? '#16a34a' : row.score >= 50 ? '#ca8a04' : '#dc2626'); xPos += colWidths[1];
        twoLine(`综合: ${row.compositeScope.toFixed(1)}`, `组长: ${row.leaderScope.toFixed(1)}`, xPos, colWidths[2], '#333', '#71717a'); xPos += colWidths[2];
        twoLine(`综合: ${(row.compOverTarget > 0 ? '+' : '') + row.compOverTarget.toFixed(1)}`, `组长: ${(row.leadOverTarget > 0 ? '+' : '') + row.leadOverTarget.toFixed(1)}`, xPos, colWidths[3], row.compOverTarget > 0 ? '#dc2626' : '#16a34a', row.leadOverTarget > 0 ? '#dc2626' : '#16a34a'); xPos += colWidths[3];
        // 非操占比
        const nonOpPct = row.nonOpRatio ?? 0;
        const nonOpThreshold = nonOpThresholds[row.centerName] ?? 10;
        const nonOpWarn = nonOpPct > nonOpThreshold;
        ctx.font = nonOpWarn ? 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif' : '11px -apple-system, BlinkMacSystemFont, sans-serif';
        cell(`${nonOpPct.toFixed(2)}%`, xPos, colWidths[4], nonOpWarn ? '#dc2626' : '#16a34a'); xPos += colWidths[4];
        [row.jobAbnormal, row.salaryCoverage, row.att15Rate, String(row.att7Count), row.workHoursHighRate, String(row.workHoursLowCount)].forEach((v, vi) => {
          const n = parseFloat(v); const warn = vi <= 2 ? n > 3 : vi === 3 ? n > 0 : vi === 4 ? n > 10 : n > 0;
          ctx.font = warn ? 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif' : '11px -apple-system, BlinkMacSystemFont, sans-serif';
          cell(v, xPos, colWidths[5 + vi], warn ? '#dc2626' : '#16a34a');
          xPos += colWidths[5 + vi];
        });
      });

      ctx.fillStyle = '#a1a1aa'; ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(`由 GPT 数据通报系统自动生成 · ${report.generatedAt}`, canvasWidth - padding, canvasHeight - 10);

      canvas.toBlob(async (blob) => {
        if (!blob) { setImgStatus('error'); setImgMsg('生成失败'); return; }
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setImgStatus('done'); setImgMsg('已复制到剪贴板');
        } catch {
          const url = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = url; a.download = `GPT总览表_${report.dateStr}.png`; a.click();
          setImgStatus('done'); setImgMsg('已触发下载');
        }
      }, 'image/png');
    } catch {
      setImgStatus('error'); setImgMsg('生成失败，请重试');
    }
    imgTimerRef.current = setTimeout(() => setImgStatus('idle'), 3000);
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(textContent); } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `GPT数据通报_${report?.dateStr || 'report'}.txt`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white w-[95%] max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center"><FileText size={20} /></div>
            <div>
              <h2 className="text-lg font-black tracking-tight">GPT 数据通报</h2>
              <p className="text-[11px] text-slate-400">{report.reportDate} · 全区均分 <span className="text-white font-bold">{report.overallScore}</span> 分</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all", copied ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700")}>
              {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制文字'}
            </button>
            <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-[11px] font-bold rounded-lg hover:bg-red-700 transition-all">
              <Download size={13} />下载 TXT
            </button>
            <button onClick={handleGenerateOverviewImage} disabled={imgStatus === 'generating'}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all",
                imgStatus === 'generating' ? "bg-slate-600 text-slate-300" : imgStatus === 'done' ? "bg-emerald-600 text-white" : imgStatus === 'error' ? "bg-red-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
              )}>
              <Image size={13} />{imgStatus === 'generating' ? '生成中...' : imgStatus === 'done' ? imgMsg : imgStatus === 'error' ? imgMsg : '复制图片'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-1"><X size={18} /></button>
          </div>
        </div>

        {/* 统计条 */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-3 md:grid-cols-6 gap-3 shrink-0">
          {dimKeys.map(k => (
            <div key={k} className="flex items-center gap-1.5">
              <span className={cn("font-mono font-bold text-sm", totals[k] > 0 ? "text-red-600" : "text-slate-400")}>{totals[k]}</span>
              <span className="text-[10px] text-slate-500 font-medium">{DIM_LABELS[k]}{DIM_UNITS[k]}</span>
            </div>
          ))}
        </div>

        {/* 报告正文 */}
        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {/* 执行摘要 */}
          <div className="p-4 bg-slate-900 text-white rounded-xl">
            <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">执行摘要</h3>
            <p className="text-sm leading-relaxed text-slate-200">{report.summary}</p>
          </div>

          {/* 各省区详情 */}
          {report.provinces.map(prov => (
            <div key={prov.province}>
              <button
                onClick={() => setExpandedProvince(expandedProvince === prov.province ? null : prov.province)}
                className="w-full flex items-center gap-3 py-2.5 border-b-2 border-slate-100 hover:bg-slate-50 rounded-lg px-2 transition-colors"
              >
                <span className="text-lg font-black italic text-slate-400">#{prov.ranking}</span>
                <span className="text-sm font-black">{prov.province}</span>
                <span className="text-[11px] text-slate-400">负责人：{prov.responsible}</span>
                <span className={cn("ml-auto px-2.5 py-0.5 rounded font-mono font-bold text-xs",
                  prov.totalScore >= 80 ? 'bg-emerald-100 text-emerald-700' :
                  prov.totalScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                )}>{prov.totalScore}分</span>
                <span className="text-[10px] text-slate-300 ml-1">{expandedProvince === prov.province ? '▼' : '▶'}</span>
              </button>

              <div className={cn("space-y-2 mt-2 pl-6", expandedProvince === prov.province ? '' : 'hidden')}>
                {prov.centers.map(center => {
                  const hasIssue = dimKeys.some(k => (center as any)[k] > 0);
                  return (
                    <div key={center.centerName} className={cn("p-3 rounded-lg border",
                      hasIssue ? 'border-red-200 bg-red-50/20' : 'border-slate-100 bg-slate-50/30'
                    )}>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black">{center.centerName}</span>
                          <span className="text-[10px] text-slate-400">({center.responsible})</span>
                          {hasIssue && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                        </div>
                        <span className={cn("px-2 py-0.5 rounded font-mono font-bold text-[11px]",
                          center.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          center.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        )}>{center.score}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {dimKeys.map(k => {
                          const val = (center as any)[k] || 0;
                          const rateMap: Record<string, string> = {
                            salaryCount: center.salaryCoverage || '',
                            att15Count: center.att15Rate || '',
                            workHoursHighCount: center.workHoursHighRate || '',
                          };
                          const extra = rateMap[k] ? `（${rateMap[k]}）` : '';
                          return (
                            <div key={k} className={cn("px-2 py-1.5 rounded text-[11px] leading-tight",
                              val > 0 ? 'bg-red-100/60 text-red-700 font-bold' : 'bg-slate-100 text-slate-500'
                            )}>
                              <span className="text-[9px] uppercase tracking-wide opacity-60 block">{DIM_LABELS[k]}</span>
                              <span className="font-mono font-bold">{val > 0 ? `${val}${DIM_UNITS[k]}${extra}` : `0${DIM_UNITS[k]}`}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div className="px-6 py-2.5 bg-slate-100 border-t border-slate-200 text-[10px] text-slate-400 text-right shrink-0">
          由 GPT 数据通报系统自动生成 · {report.generatedAt}
        </div>
      </div>
    </div>
  );
}
