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
      const headers = ['中心', '得分', '管幅', '超目标', '效能异常', '绩效异常', '连续出勤', '长期未出勤'];

      // Canvas 尺寸（8列，管幅/超目标每列显示两行）
      const colWidths = [100, 70, 110, 110, 80, 80, 80, 100];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const rowHeight = 48;  // 增加行高以容纳两行文字
      const headerHeight = 42;
      const titleHeight = 80;  // 增加标题栏高度
      const footerHeight = 32;
      const tableHeight = headerHeight + rows.length * rowHeight;
      const padding = 4;  // 左右边距（很窄）
      const canvasWidth = tableWidth + padding * 2;
      const canvasHeight = titleHeight + tableHeight + footerHeight + 24;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth * 2;
      canvas.height = canvasHeight * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);

      // 背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // 顶部蓝色标题栏
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(0, 0, canvasWidth, titleHeight);
      
      // 标题文字（左对齐，偏上）
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('GPT 数据总览', padding, 18);
      
      // 副标题（在标题下方）
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`数据日期：${report.reportDate}`, padding, 48);
      
      // 右侧"全区均分"标签
      const scoreText = `全区均分 ${report.overallScore} 分`;
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      const scoreTextWidth = ctx.measureText(scoreText).width;
      const tagWidth = scoreTextWidth + 32;
      const tagHeight = 32;
      const tagX = canvasWidth - padding - tagWidth;
      const tagY = (titleHeight - tagHeight) / 2;
      
      // 标签背景
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(tagX, tagY, tagWidth, tagHeight);
      
      // 标签文字（居中）
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(scoreText, tagX + tagWidth / 2, tagY + tagHeight / 2);

      // 表头背景（全宽，与标题栏连成一体）
      ctx.fillStyle = '#1e3a5f';
      ctx.fillRect(0, titleHeight, canvasWidth, headerHeight);
      
      // 表头文字
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textBaseline = 'middle';
      let xPos = padding;
      for (let i = 0; i < headers.length; i++) {
        ctx.textAlign = i === 0 ? 'left' : 'center';
        const textX = i === 0 ? xPos + 10 : xPos + colWidths[i] / 2;
        ctx.fillText(headers[i], textX, titleHeight + headerHeight / 2);
        xPos += colWidths[i];
      }
      
      // 表头底边线（白色，全宽）
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, titleHeight + headerHeight);
      ctx.lineTo(canvasWidth, titleHeight + headerHeight);
      ctx.stroke();

      // 数据行
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const y = titleHeight + headerHeight + r * rowHeight;

        // 行背景（斑马纹，全宽）
        if (r % 2 === 0) {
          ctx.fillStyle = '#f0f7ff';
          ctx.fillRect(0, y, canvasWidth, rowHeight);
        }

        // 底边线（全宽）
        ctx.strokeStyle = '#e4e4e7';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y + rowHeight);
        ctx.lineTo(canvasWidth, y + rowHeight);
        ctx.stroke();

        // 得分背景色（浅色）
        const scoreBg = row.score >= 80 ? '#d1fae5' : row.score >= 50 ? '#fef3c7' : '#fecaca';
        ctx.fillStyle = scoreBg;
        const scoreXStart = padding + colWidths[0];
        ctx.fillRect(scoreXStart, y, colWidths[1], rowHeight);

        // 绘制单列文字（通用）
        const drawCell = (text: string, x: number, width: number, color: string, align: 'left' | 'center' = 'center') => {
          ctx.fillStyle = color;
          ctx.textAlign = align;
          ctx.textBaseline = 'middle';
          const textX = align === 'left' ? x + 10 : x + width / 2;
          ctx.fillText(text, textX, y + rowHeight / 2);
        };

        // 绘制双行文字（管幅/超目标用）
        const drawTwoLineCell = (line1: string, line2: string, x: number, width: number, color1: string, color2: string) => {
          const midY = y + rowHeight / 2;
          const lineHeight = 14;
          ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
          // 第一行
          ctx.fillStyle = color1;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(line1, x + width / 2, midY - lineHeight / 2 + 2);
          // 第二行
          ctx.fillStyle = color2;
          ctx.fillText(line2, x + width / 2, midY + lineHeight / 2 + 2);
        };

        xPos = padding;
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';

        // 0: 中心
        drawCell(row.centerName, xPos, colWidths[0], '#18181b', 'left');
        xPos += colWidths[0];

        // 1: 得分
        drawCell(String(row.score), xPos, colWidths[1], row.score >= 80 ? '#16a34a' : row.score >= 50 ? '#ca8a04' : '#dc2626');
        xPos += colWidths[1];

        // 2: 管幅（两行：综合 + 组长）
        const scopeColor1 = row.compositeScope > 0 ? '#18181b' : '#18181b';
        const scopeColor2 = row.leaderScope > 0 ? '#18181b' : '#18181b';
        drawTwoLineCell(
          `综合: ${row.compositeScope.toFixed(1)}`,
          `组长: ${row.leaderScope.toFixed(1)}`,
          xPos, colWidths[2], scopeColor1, scopeColor2
        );
        xPos += colWidths[2];

        // 3: 超目标（两行：综合 + 组长）
        const overColor1 = row.compOverTarget > 0 ? '#dc2626' : '#16a34a';
        const overColor2 = row.leadOverTarget > 0 ? '#dc2626' : '#16a34a';
        drawTwoLineCell(
          `综合: ${(row.compOverTarget > 0 ? '+' : '') + row.compOverTarget.toFixed(1)}`,
          `组长: ${(row.leadOverTarget > 0 ? '+' : '') + row.leadOverTarget.toFixed(1)}`,
          xPos, colWidths[3], overColor1, overColor2
        );
        xPos += colWidths[3];

        // 4: 效能异常
        ctx.font = row.jobAbnormal > 1 ? 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif' : '12px -apple-system, BlinkMacSystemFont, sans-serif';
        drawCell(String(row.jobAbnormal), xPos, colWidths[4], row.jobAbnormal > 1 ? '#dc2626' : '#16a34a');
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        xPos += colWidths[4];

        // 5: 绩效异常
        ctx.font = parseFloat(row.salaryCoverage) > 3 ? 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif' : '12px -apple-system, BlinkMacSystemFont, sans-serif';
        drawCell(row.salaryCoverage, xPos, colWidths[5], parseFloat(row.salaryCoverage) > 3 ? '#dc2626' : '#16a34a');
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        xPos += colWidths[5];

        // 6: 连续出勤
        ctx.font = parseFloat(row.att15Rate) > 3 ? 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif' : '12px -apple-system, BlinkMacSystemFont, sans-serif';
        drawCell(row.att15Rate, xPos, colWidths[6], parseFloat(row.att15Rate) > 3 ? '#dc2626' : '#16a34a');
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        xPos += colWidths[6];

        // 7: 长期未出勤
        ctx.font = parseFloat(row.att7Rate) > 3 ? 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif' : '12px -apple-system, BlinkMacSystemFont, sans-serif';
        drawCell(String(row.att7Count), xPos, colWidths[7], parseFloat(row.att7Rate) > 3 ? '#dc2626' : '#16a34a');
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      }

      // 底部时间戳
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`由 GPT 数据通报系统自动生成 · ${report.generatedAt}`, canvasWidth - padding, canvasHeight - 12);

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
