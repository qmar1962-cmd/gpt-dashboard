/**
 * 详情报告弹窗 — 展示自动生成的文字报告
 */
import { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Download, FileText, Image } from 'lucide-react';
import html2canvas from 'html2canvas';
import { generateReport, renderReportAsText, type FullReport } from '../lib/reportGenerator';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  params: {
    filteredData: any[];
    rawData?: any[];
    salaryData?: any[];
    attendanceData?: any[];
    attendance15Data?: any[];
    attendance7Data?: any[];
  };
}

export default function ReportModal({ isOpen, onClose, params }: ReportModalProps) {
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<FullReport | null>(null);
  const [textContent, setTextContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imgGenerating, setImgGenerating] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const overviewTableRef = useRef<HTMLDivElement>(null);

  // 打开弹窗时重新生成报告（基于 params）
  useEffect(() => {
    if (!isOpen) return;
    try {
      setError(null);
      const rep = generateReport(params);
      const text = isCompactMode ? renderReportAsTextCompact(rep) : renderReportAsText(rep);
      setReport(rep);
      setTextContent(text);
    } catch (e: any) {
      console.error('[ReportModal] 报告生成失败:', e);
      setError(e?.message || '报告生成失败，请检查数据');
      setReport(null);
      setTextContent('');
    }
  }, [isOpen, params, isCompactMode]);

  if (!isOpen) return null;

  // 错误状态 UI
  if (error || !report) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className="bg-white w-[90%] max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={20} />
              <h2 className="text-base font-black">报告生成失败</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="p-6 text-center">
            <p className="text-red-600 font-medium mb-2">生成详情报告时出错</p>
            <p className="text-sm text-zinc-500">{error || '未知错误，请检查数据是否完整'}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-zinc-900 text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 生成总览表图片
  const generateOverviewTableHTML = (report: FullReport): string => {
    const rows = report.overviewTable || [];
    let html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; background: #ffffff;">
        <h2 style="font-size: 18px; font-weight: 900; margin: 0 0 16px 0; color: #18181b;">GPT 数据总览 — ${report.reportDate}</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f4f4f5; border-bottom: 2px solid #d4d4d8;">
              <th style="padding: 8px 12px; text-align: left; font-weight: 800; color: #52525b;">中心</th>
              <th style="padding: 8px 12px; text-align: right; font-weight: 800; color: #52525b;">得分</th>
              <th style="padding: 8px 12px; text-align: center; font-weight: 800; color: #52525b;" colspan="2">管幅（综/组）</th>
              <th style="padding: 8px 12px; text-align: center; font-weight: 800; color: #52525b;" colspan="2">超目标（综/组）</th>
              <th style="padding: 8px 12px; text-align: right; font-weight: 800; color: #52525b;">效能异常</th>
              <th style="padding: 8px 12px; text-align: right; font-weight: 800; color: #52525b;">绩效异常</th>
              <th style="padding: 8px 12px; text-align: right; font-weight: 800; color: #52525b;">连续出勤</th>
              <th style="padding: 8px 12px; text-align: right; font-weight: 800; color: #52525b;">长期未出勤</th>
            </tr>
          </thead>
          <tbody>
    `;
    for (const row of rows) {
      const scoreColor = row.score >= 80 ? '#16a34a' : row.score >= 50 ? '#ca8a04' : '#dc2626';
      const scoreBg = row.score >= 80 ? '#f0fdf4' : row.score >= 50 ? '#fefce8' : '#fef2f2';
      html += `
            <tr style="border-bottom: 1px solid #e4e4e7;">
              <td style="padding: 8px 12px; font-weight: 700; color: #18181b;">${row.centerName}</td>
              <td style="padding: 8px 12px; text-align: right; font-weight: 900; font-family: monospace; color: ${scoreColor}; background: ${scoreBg};">${row.score}</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace;">${row.compositeScope.toFixed(1)}</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace;">${row.leaderScope.toFixed(1)}</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: ${row.compOverTarget > 0 ? '#dc2626' : '#16a34a'};">${row.compOverTarget > 0 ? '+' : ''}${row.compOverTarget.toFixed(1)}</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: ${row.leadOverTarget > 0 ? '#dc2626' : '#16a34a'};">${row.leadOverTarget > 0 ? '+' : ''}${row.leadOverTarget.toFixed(1)}</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: ${row.jobAbnormal > 0 ? '#dc2626' : '#16a34a'};">${row.jobAbnormal}</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: ${row.salaryCount > 0 ? '#dc2626' : '#16a34a'};">${row.salaryCount}</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: ${row.att15Count > 0 ? '#d97706' : '#16a34a'};">${row.att15Count}</td>
              <td style="padding: 8px 12px; text-align: right; font-family: monospace; color: ${row.att7Count > 0 ? '#d97706' : '#16a34a'};">${row.att7Count}</td>
            </tr>
      `;
    }
    html += `
          </tbody>
        </table>
        <div style="margin-top: 12px; font-size: 11px; color: #a1a1aa; text-align: right;">由 GPT 数据通报系统自动生成 · ${report.generatedAt}</div>
      </div>
    `;
    return html;
  };

  const handleGenerateOverviewImage = async () => {
    if (!report || imgGenerating) return;
    setImgGenerating(true);
    try {
      const tableHTML = generateOverviewTableHTML(report);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = tableHTML;
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      tempDiv.style.top = '0';
      document.body.appendChild(tempDiv);
      
      const canvas = await html2canvas(tempDiv, {
        backgroundColor: '#ffffff',
        scale: 2,
        onclone: (clonedDoc) => {
          // 替换所有 oklch 颜色为 rgb（html2canvas 不支持 oklch）
          const allEls = clonedDoc.querySelectorAll('*');
          allEls.forEach(el => {
            const style = (el as HTMLElement).style;
            if (style.color && style.color.includes('oklch')) style.color = '#18181b';
            if (style.backgroundColor && style.backgroundColor.includes('oklch')) style.backgroundColor = '#ffffff';
            if (style.borderColor && style.borderColor.includes('oklch')) style.borderColor = '#d4d4d8';
          });
        }
      });
      
      document.body.removeChild(tempDiv);
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `GPT总览表_${report.dateStr}.png`;
      a.click();
    } catch (e) {
      console.error('生成总览图失败:', e);
      alert('生成总览图失败，请重试');
    } finally {
      setImgGenerating(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GPT数据通报_${report?.dateStr || 'report'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 统计各维度异常数
  let totalJob = 0, totalSalary = 0, totalAtt15 = 0, totalAtt7 = 0;
  report.provinces.forEach(p => p.centers.forEach(c => {
    totalJob += c.jobAbnormalCount;
    totalSalary += c.salaryCount;
    totalAtt15 += c.att15Count;
    totalAtt7 += c.att7Count;
  }));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white w-[90%] max-w-4xl max-h-[85vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="bg-black text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-red-500" />
            <div>
              <h2 className="text-lg font-black tracking-tight">GPT 数据通报 — 详情报告</h2>
              <p className="text-[10px] text-zinc-400 font-mono">{report.reportDate} · 全区均分 {report.overallScore} 分</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* 统计条 */}
        <div className="px-6 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center gap-6 shrink-0">
          {[
            { label: '效能异常', value: totalJob, unit: '个' },
            { label: '绩效异常', value: totalSalary, unit: '人' },
            { label: '连续出勤', value: totalAtt15, unit: '人' },
            { label: '长期未出勤', value: totalAtt7, unit: '人' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <span className={`font-mono font-bold text-sm ${s.value > 0 ? 'text-red-600' : 'text-zinc-400'}`}>{s.value}</span>
              <span className="text-[10px] text-zinc-500">{s.label}{s.unit}</span>
            </div>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-[11px] font-black uppercase tracking-wide rounded hover:bg-zinc-800 transition-colors"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '已复制' : '复制'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-[11px] font-black uppercase tracking-wide rounded hover:bg-red-700 transition-colors"
            >
              <Download size={13} />
              下载
            </button>
            <button
              onClick={handleGenerateOverviewImage}
              disabled={imgGenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-[11px] font-black uppercase tracking-wide rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Image size={13} />
              {imgGenerating ? '生成中...' : '总览图'}
            </button>
            <button
              onClick={() => setIsCompactMode(!isCompactMode)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-[11px] font-black uppercase tracking-wide rounded hover:bg-green-700 transition-colors"
            >
              {isCompactMode ? '完整版' : '微信版'}
            </button>
          </div>
        </div>

        {/* 报告正文 */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {/* 执行摘要 */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-700 mb-2">📋 执行摘要</h3>
            <p className="text-sm leading-relaxed text-zinc-700">{report.summary}</p>
          </div>

          {/* 各省区详情 */}
          {report.provinces.map(prov => (
            <div key={prov.province} className="mb-6 last:mb-0">
              <div className="flex items-center gap-3 mb-3 pb-2 border-b-2 border-zinc-100">
                <span className="text-xl font-black italic">#{prov.ranking}</span>
                <span className="text-base font-black">{prov.province}</span>
                <span className="text-xs text-zinc-400">负责人：{prov.responsible}</span>
                <span className={`ml-auto px-2.5 py-0.5 rounded font-mono font-bold text-sm ${prov.totalScore >= 80 ? 'bg-emerald-100 text-emerald-700' : prov.totalScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {prov.totalScore}分
                </span>
              </div>

              <div className="space-y-3 pl-4">
                {prov.centers.map(center => {
                  const hasJobOrSalaryIssue = center.jobAbnormalCount > 0 || center.salaryCount > 0;
                  const hasAttWarning = center.att15Count > 0 || center.att7Count > 0;
                  const hasIssue = hasJobOrSalaryIssue || hasAttWarning;
                  const borderClass = hasJobOrSalaryIssue
                    ? 'border-red-200 bg-red-50/30'
                    : hasAttWarning
                      ? 'border-amber-200 bg-amber-50/30'
                      : 'border-zinc-200 bg-zinc-50/50';
                  return (
                    <div key={center.centerName} className={`p-3 rounded-lg border ${borderClass}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black">{center.centerName}</span>
                          <span className="text-[10px] text-zinc-400">({center.responsible})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-sm ${center.score >= 80 ? 'bg-emerald-100 text-emerald-700' : center.score >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {center.score}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* 效能异常 */}
                        <div className={`p-2 rounded ${center.jobAbnormalCount > 0 ? 'bg-red-50' : 'bg-zinc-50'}`}>
                          <span className="text-zinc-500">效能异常</span>
                          <div className="font-mono font-bold">{
                            center.jobAbnormalCount > 0
                              ? <span className="text-red-600">{center.jobAbnormalCount} 个 <span className="text-[10px] text-zinc-400">(前一天 {center.jobPrevCount})</span></span>
                              : <span className="text-zinc-500">0 <span className="text-[10px] text-zinc-400">(前一天 {center.jobPrevCount})</span></span>
                          }</div>
                        </div>

                        {/* 绩效异常 */}
                        <div className={`p-2 rounded ${center.salaryCount > 0 ? 'bg-red-50' : 'bg-zinc-50'}`}>
                          <span className="text-zinc-500">绩效异常</span>
                          <div className="font-mono font-bold">{
                            center.salaryCount > 0
                              ? <span className="text-red-600">{center.salaryCount} 人 <span className="text-[10px] text-zinc-400">({center.salaryCoverage})</span></span>
                              : <span className="text-zinc-500">0 <span className="text-[10px] text-zinc-400">({center.salaryCoverage})</span></span>
                          }</div>
                        </div>

                        {/* 连续出勤 */}
                        <div className={`p-2 rounded ${center.att15Count > 0 ? 'bg-amber-50' : 'bg-zinc-50'}`}>
                          <span className="text-zinc-500">连续出勤</span>
                          <div className="font-mono font-bold">{
                            center.att15Count > 0
                              ? <span className="text-amber-600">{center.att15Count} 人 <span className="text-[10px] text-zinc-400">({center.att15Rate})</span></span>
                              : <span className="text-zinc-500">0 <span className="text-[10px] text-zinc-400">({center.att15Rate})</span></span>
                          }</div>
                        </div>

                        {/* 长期未出勤 */}
                        <div className={`p-2 rounded ${center.att7Count > 0 ? 'bg-amber-50' : 'bg-zinc-50'}`}>
                          <span className="text-zinc-500">长期未出勤</span>
                          <div className="font-mono font-bold">{
                            center.att7Count > 0
                              ? <span className="text-amber-600">{center.att7Count} 人</span>
                              : <span className="text-zinc-500">0 人</span>
                          }</div>
                        </div>
                      </div>

                      {/* 明细展开 - 仅保留效能异常明细 */}
                      {hasIssue && center.jobAbnormalCount > 0 && (
                        <div className="mt-2 pt-2 border-t border-red-100">
                          <p className="text-[10px] text-red-500 font-black uppercase mb-1">效能异常明细</p>
                          <div className="space-y-1">
                            {center.jobDetails?.slice(0, 5).map((d, i) => (
                              <div key={i} className="text-xs text-zinc-600 pl-2 border-l-2 border-red-300">
                                {d.jobName}：偏离 +{d.deviation}%（实际 {d.actualValue} / 目标 {d.targetValue}）
                              </div>
                            ))}
                            {center.jobDetails && center.jobDetails.length > 5 && (
                              <div className="text-[10px] text-zinc-400">... 等 {center.jobDetails.length} 条</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 底部 */}
        <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-200 text-[10px] text-zinc-400 text-right shrink-0">
          由 GPT 数据通报系统自动生成 · {report.generatedAt}
        </div>
      </div>
    </div>
  );
}
