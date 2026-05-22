/**
 * 详情报告弹窗 — 展示自动生成的文字报告
 */
import { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Download, FileText, Image } from 'lucide-react';
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
  const overviewTableRef = useRef<HTMLDivElement>(null);

  // 打开弹窗时重新生成报告（基于 params）
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

  // 用纯 Canvas API 生成总览表图片（精致报告风）
  const handleGenerateOverviewImage = async () => {
    if (!report || imgGenerating) return;
    setImgGenerating(true);
    try {
      const rows = report.overviewTable || [];
      const headers = ['中心', '得分', '管幅(综)', '管幅(组)', '超目标(综)', '超目标(组)', '效能异常', '绩效异常', '连续出勤', '长期未出勤'];

      // Canvas 尺寸
      const colWidths = [90, 60, 72, 72, 82, 82, 72, 72, 72, 72];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const rowHeight = 34;
      const headerHeight = 42;
      const titleHeight = 64;
      const footerHeight = 32;
      const tableHeight = headerHeight + rows.length * rowHeight;
      const canvasWidth = tableWidth + 48;
      const canvasHeight = titleHeight + tableHeight + footerHeight + 24;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * 2;
      canvas.height = canvasHeight * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);

      // 背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 标题
      ctx.fillStyle = '#18181b';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`GPT 数据总览 — ${report.reportDate}`, 24, 40);

      // 表头背景（两行）
      const headerHeight1 = 36; // 第一行高度
      const headerHeight2 = 28; // 第二行高度
      const headerHeight = headerHeight1 + headerHeight2;
      
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(24, titleHeight, tableWidth, headerHeight);
      
      // 第一行表头文字：综合 | 组长
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText('综合', 24 + colWidths[2] / 2, titleHeight + headerHeight1 / 2);
      ctx.fillText('组长', 24 + colWidths[2] + colWidths[3] + colWidths[4] / 2, titleHeight + headerHeight1 / 2);
      
      // 第二行表头文字：管幅 | 超目标 | 管幅 | 超目标
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('管幅', 24 + colWidths[2] / 2, titleHeight + headerHeight1 + headerHeight2 / 2);
      ctx.fillText('超目标', 24 + colWidths[2] + colWidths[3] / 2, titleHeight + headerHeight1 + headerHeight2 / 2);
      ctx.fillText('管幅', 24 + colWidths[2] + colWidths[3] + colWidths[4] / 2, titleHeight + headerHeight1 + headerHeight2 / 2);
      ctx.fillText('超目标', 24 + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] / 2, titleHeight + headerHeight1 + headerHeight2 / 2);
      
      // 其他表头（单行）：中心、得分、效能异常、绩效异常、连续出勤、长期未出勤
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('中心', 24 + 10, titleHeight + headerHeight / 2);
      ctx.textAlign = 'center';
      ctx.fillText('得分', 24 + colWidths[0] + colWidths[1] / 2, titleHeight + headerHeight / 2);
      ctx.fillText('效能异常', 24 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] / 2, titleHeight + headerHeight / 2);
      ctx.fillText('绩效异常', 24 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7] / 2, titleHeight + headerHeight / 2);
      ctx.fillText('连续出勤', 24 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7] + colWidths[8] / 2, titleHeight + headerHeight / 2);
      ctx.fillText('长期未出勤', 24 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7] + colWidths[8] + colWidths[9] / 2, titleHeight + headerHeight / 2);
      
      // 表头底边线
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, titleHeight + headerHeight);
      ctx.lineTo(24 + tableWidth, titleHeight + headerHeight);
      ctx.stroke();

      // 数据行
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const y = titleHeight + headerHeight + r * rowHeight;

        // 行背景（斑马纹）
        if (r % 2 === 0) {
          ctx.fillStyle = '#fafafa';
          ctx.fillRect(24, y, tableWidth, rowHeight);
        }

        // 底边线
        ctx.strokeStyle = '#e4e4e7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24, y + rowHeight);
        ctx.lineTo(24 + tableWidth, y + rowHeight);
        ctx.stroke();

        // 得分背景色
        const scoreBg = row.score >= 80 ? '#f0fdf4' : row.score >= 50 ? '#fefce8' : '#fef2f2';
        ctx.fillStyle = scoreBg;
        const scoreXStart = 24 + colWidths[0];
        ctx.fillRect(scoreXStart, y, colWidths[1], rowHeight);

        // 数据
        const cells = [
          row.centerName,
          String(row.score),
          row.compositeScope.toFixed(1),
          row.leaderScope.toFixed(1),
          (row.compOverTarget > 0 ? '+' : '') + row.compOverTarget.toFixed(1),
          (row.leadOverTarget > 0 ? '+' : '') + row.leadOverTarget.toFixed(1),
          String(row.jobAbnormal),
          String(row.salaryCount),
          String(row.att15Count),
          String(row.att7Count),
        ];

        const colors = [
          '#18181b',
          row.score >= 80 ? '#16a34a' : row.score >= 50 ? '#ca8a04' : '#dc2626',
          '#18181b',
          '#18181b',
          row.compOverTarget > 0 ? '#dc2626' : '#16a34a',
          row.leadOverTarget > 0 ? '#dc2626' : '#16a34a',
          row.jobAbnormal > 0 ? '#dc2626' : '#16a34a',
          row.salaryCount > 0 ? '#dc2626' : '#16a34a',
          row.att15Count > 0 ? '#d97706' : '#16a34a',
          row.att7Count > 0 ? '#d97706' : '#16a34a',
        ];

        xPos = 24;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        for (let i = 0; i < cells.length; i++) {
          ctx.fillStyle = colors[i];
          ctx.textAlign = i === 0 ? 'left' : 'right';
          const textX = i === 0 ? xPos + 10 : xPos + colWidths[i] - 10;
          ctx.textBaseline = 'middle';
          ctx.fillText(cells[i], textX, y + rowHeight / 2);
          xPos += colWidths[i];
        }
      }

      // 底部时间戳
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`由 GPT 数据通报系统自动生成 · ${report.generatedAt}`, canvasWidth - 24, canvasHeight - 12);

      // 复制到剪贴板
      canvas.toBlob(async (blob) => {
        if (!blob) {
          alert('生成图片失败，请重试');
          return;
        }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          alert('图片已复制到剪贴板，可直接粘贴到微信');
        } catch (err) {
          console.error('复制图片失败:', err);
          // 降级方案：下载
          const url = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = url;
          a.download = `GPT总览表_${report.dateStr}.png`;
          a.click();
          alert('复制失败，已改为下载图片');
        }
      }, 'image/png');
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
              {imgGenerating ? '生成中...' : '复制图片'}
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
