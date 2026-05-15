import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Download, FileSpreadsheet, FileText, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import * as xlsx from 'xlsx';

interface DataDownloaderProps {
  data: any[];
  fileName?: string;
}

export default function DataDownloader({ data, fileName = '导出数据' }: DataDownloaderProps) {
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!data || data.length === 0) {
      alert('没有可导出的数据');
      return;
    }

    setIsExporting(true);
    setExportFormat(format);

    try {
      const worksheet = xlsx.utils.json_to_sheet(data);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Data');

      let fileBlob: Blob;
      let fileExtension: string;

      if (format === 'xlsx') {
        const wbout = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
        fileBlob = new Blob([wbout], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        fileExtension = 'xlsx';
      } else {
        const csvOutput = xlsx.utils.sheet_to_csv(worksheet);
        fileBlob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
        fileExtension = 'csv';
      }

      // 使用 file-saver 保存文件
      const fileSaver = await import('file-saver');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      fileSaver.default.saveAs(
        fileBlob, 
        `${fileName}_${timestamp}.${fileExtension}`
      );

      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleExport('xlsx')}
        disabled={isExporting || data.length === 0}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all",
          isExporting && exportFormat === 'xlsx'
            ? "bg-zinc-300 cursor-not-allowed"
            : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg"
        )}
      >
        {isExporting && exportFormat === 'xlsx' ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : exportSuccess ? (
          <Check size={16} />
        ) : (
          <FileSpreadsheet size={16} />
        )}
        Excel
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => handleExport('csv')}
        disabled={isExporting || data.length === 0}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all",
          isExporting && exportFormat === 'csv'
            ? "bg-zinc-300 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
        )}
      >
        {isExporting && exportFormat === 'csv' ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : exportSuccess ? (
          <Check size={16} />
        ) : (
          <FileText size={16} />
        )}
        CSV
      </motion.button>
    </div>
  );
}
