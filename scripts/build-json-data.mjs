#!/usr/bin/env node

/**
 * Excel 转 JSON 构建脚本
 * 读取 public/database/ 下的所有 .xlsx 文件，解析后生成 JSON 文件到 public/database/json/
 * 同时生成 public/database/json/filelist.json 用于浏览器增量更新
 *
 * 使用：npm run build:data
 */

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const DATABASE_DIR = join(ROOT_DIR, 'public', 'database');
const JSON_DIR = join(DATABASE_DIR, 'json');

/**
 * 主函数：构建 JSON 数据文件
 */
function buildJsonData() {
  console.log('[构建 JSON 数据] 开始...');
  console.log(`  源目录: ${DATABASE_DIR}`);
  console.log(`  输出目录: ${JSON_DIR}`);

  // 1. 读取所有 .xlsx 文件
  const files = readdirSync(DATABASE_DIR).filter(f => f.endsWith('.xlsx'));

  if (files.length === 0) {
    console.warn('[构建 JSON 数据] 警告：没有找到 .xlsx 文件');
    return;
  }

  console.log(`[构建 JSON 数据] 找到 ${files.length} 个 .xlsx 文件`);

  // 2. 创建 json/ 目录（如果不存在）
  if (!existsSync(JSON_DIR)) {
    mkdirSync(JSON_DIR, { recursive: true });
    console.log(`[构建 JSON 数据] 创建目录: ${JSON_DIR}`);
  }

  // 3. 先保留已有的历史 JSON 文件（防止 Excel 源文件缺失时丢失历史数据）
  const fileList = {
    generated_at: new Date().toISOString(),
    files: {}
  };
  if (existsSync(JSON_DIR)) {
    const existingJsons = readdirSync(JSON_DIR).filter(f => f.endsWith('.json') && f !== 'filelist.json');
    for (const jf of existingJsons) {
      const jpath = join(JSON_DIR, jf);
      try {
        const stats = statSync(jpath);
        const hash = createHash('md5').update(readFileSync(jpath)).digest('hex');
        fileList.files[jf] = { mtime: stats.mtime.toISOString(), size: stats.size, hash: hash };
      } catch (e) { /* skip corrupted files */ }
    }
    console.log(`[构建 JSON 数据] 保留已有 ${existingJsons.length} 个 JSON 文件`);
  }

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    try {
      const filepath = join(DATABASE_DIR, file);

      // 解析 Excel
      const workbook = XLSX.read(readFileSync(filepath), { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        console.warn(`[构建 JSON 数据] 警告：${file} 没有工作表`);
        failCount++;
        continue;
      }

      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: true });

      // 写入 JSON 文件
      const jsonFilename = file.replace('.xlsx', '.json');
      const jsonFilepath = join(JSON_DIR, jsonFilename);
      writeFileSync(jsonFilepath, JSON.stringify(data, null, 2));

      // 更新 filelist.json
      const stats = statSync(jsonFilepath);
      const hash = createHash('md5').update(readFileSync(jsonFilepath)).digest('hex');

      fileList.files[jsonFilename] = {
        mtime: stats.mtime.toISOString(),
        size: stats.size,
        hash: hash,
        source: file
      };

      console.log(`  ✅ ${file} -> ${jsonFilename} (${data.length} 行)`);
      successCount++;
    } catch (error) {
      console.error(`[构建 JSON 数据] 错误：处理 ${file} 失败:`, error.message);
      failCount++;
    }
  }

  // 特殊处理：outsourcing.xlsx → outsourcing.json（中心名称 → 行政外包人数映射）
  const outsourcingFile = files.find(f => f.startsWith('outsourcing'));
  if (outsourcingFile) {
    try {
      const filepath = join(DATABASE_DIR, outsourcingFile);
      const workbook = XLSX.read(readFileSync(filepath), { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: true });
      const outMap = {};
      rows.forEach(r => {
        const name = String(r['中心名称'] || '').replace('转运中心', '').trim();
        if (name) outMap[name] = parseInt(r['行政外包人数']) || 0;
      });
      const outPath = join(JSON_DIR, 'outsourcing.json');
      writeFileSync(outPath, JSON.stringify(outMap, null, 2));
      console.log(`  ✅ ${outsourcingFile} -> outsourcing.json (${Object.keys(outMap).length} 中心)`);
      successCount++;
    } catch (error) {
      console.error(`[构建 JSON 数据] 错误：处理 ${outsourcingFile} 失败:`, error.message);
      failCount++;
    }
  }

  // 4. 写入 filelist.json
  const filelistPath = join(JSON_DIR, 'filelist.json');
  writeFileSync(filelistPath, JSON.stringify(fileList, null, 2));

  console.log(`\n[构建 JSON 数据] 完成：`);
  console.log(`  转换: ${successCount} 个, 失败: ${failCount} 个, 总计: ${Object.keys(fileList.files).length} 个`);
  console.log(`  filelist.json: ${filelistPath}`);
}

buildJsonData();
