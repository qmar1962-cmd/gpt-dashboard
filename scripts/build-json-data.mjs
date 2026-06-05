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

// ── 花名册清洗 ─────────────────────────────────────

/** 去除字符串中的零宽字符（‌ ‍ 等） */
function stripZeroWidth(str) {
  return str.replace(/[​‌‍‎‏﻿]/g, '').trim();
}

/** 清洗花名册数据：去零宽字符，只保留有用列 */
function cleanRosterData(rows, keepKeys) {
  return rows.map(row => {
    const cleaned = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = stripZeroWidth(String(key));
      // 检查清洗后的列名是否匹配保留关键词
      const matched = keepKeys.find(k => cleanKey.includes(k));
      if (matched) {
        cleaned[cleanKey] = value;
      }
    }
    return cleaned;
  });
}

// ── 主函数 ─────────────────────────────────────────

/**
 * 主函数：构建 JSON 数据文件
 */
function buildJsonData() {
  console.log('[构建 JSON 数据] 开始...');
  console.log(`  源目录: ${DATABASE_DIR}`);
  console.log(`  输出目录: ${JSON_DIR}`);

  // 1. 读取所有 .xlsx 和 .xls 文件
  const files = readdirSync(DATABASE_DIR).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));

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
  //    但花名册只保留最新一份，删掉旧的
  const fileList = {
    generated_at: new Date().toISOString(),
    files: {}
  };
  if (existsSync(JSON_DIR)) {
    const existingJsons = readdirSync(JSON_DIR).filter(f => f.endsWith('.json') && f !== 'filelist.json');
    // 找出哪些是旧花名册（本次会重新生成）
    const rosterFiles = files.filter(f => f.toLowerCase().startsWith('roster')).map(f => f.replace('.xlsx', '.json'));
    for (const jf of existingJsons) {
      // 跳过旧的 roster 文件（与本次生成的不同日期的），只保留本次生成的
      if (jf.toLowerCase().startsWith('roster') && !rosterFiles.includes(jf)) {
        console.log(`  🗑️ 清理旧花名册: ${jf}`);
        continue;
      }
      const jpath = join(JSON_DIR, jf);
      try {
        const stats = statSync(jpath);
        const hash = createHash('md5').update(readFileSync(jpath)).digest('hex');
        fileList.files[jf] = { mtime: stats.mtime.toISOString(), size: stats.size, hash: hash };
      } catch (e) { /* skip corrupted files */ }
    }
    console.log(`[构建 JSON 数据] 保留已有 ${Object.keys(fileList.files).length} 个 JSON 文件`);
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

      let data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: true });

      // ── 花名册清洗：去零宽字符 + 只保留有用列 ──
      const isRoster = file.toLowerCase().startsWith('roster');
      if (isRoster && data.length > 0) {
        const KEEP_KEYS = ['工号', '员工ID', '编号', '姓名', '岗位名称', '岗位',
          '部门', '所在单位', '五级单位', '六级单位', '七级单位', '九级单位',
          '入职日期', '员工类别', '数据日期'];
        data = cleanRosterData(data, KEEP_KEYS);
        console.log(`  🧹 花名册清洗：${data.length} 行，保留 ${Object.keys(data[0] || {}).length} 列`);
      }

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

  // 特殊处理：staffing_detail.xls → staffing_detail.json（中心 → 非操编制/在岗人数 + 部门/岗位明细）
  const staffingFile = files.find(f => f.startsWith('staffing_detail'));
  if (staffingFile) {
    try {
      const filepath = join(DATABASE_DIR, staffingFile);
      const workbook = XLSX.read(readFileSync(filepath), { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: true });

      // 岗位名归一化：经理→主管、负责人→主管，去掉（代理）等后缀
      function normalizePosition(pos) {
        return pos
          .replace(/经理/g, '主管')
          .replace(/负责人/g, '主管')
          .replace(/（代理）/g, '')
          .replace(/（兼.*?）/g, '')
          .trim();
      }

      // 岗位排序优先级：主管/经理排前面，专员排后面
      function getPositionOrder(pos) {
        if (/主管|经理|负责人/.test(pos)) return 0;
        if (/专员/.test(pos)) return 2;
        return 1; // 其他岗位
      }

      // 只保留转运中心和区域
      function isValidCenter(name) {
        return name.endsWith('转运中心') || name.endsWith('区域');
      }

      // 获取转运中心名称（区域→转运中心）
      function getTransferCenter(name) {
        if (name.endsWith('区域')) {
          return name.replace('区域', '转运中心');
        }
        return name;
      }

      // 按中心汇总：区分操作/非操，含部门和岗位明细
      const centerMap = {};
      const regionData = {}; // 暂存区域数据

      rows.forEach(r => {
        let center = String(r['单位名称'] || '').trim();
        if (!center) return;
        if (!isValidCenter(center)) return; // 只保留转运中心和区域

        const orgPath = String(r['组织路径'] || '');
        const parts = orgPath.split('>');
        const isOp = orgPath.includes('>中心操作>'); // 判断操作部门
        if (isOp) return; // 操作部门不显示

        const dept = parts[parts.length - 1] || '未知'; // 取组织路径最后一个字段作为部门
        const headcount = parseInt(r['在职人数']) || 0;
        const fixedStaff = parseInt(r['固定编制']) || 0;
        const tempStaff = parseInt(r['临时编制']) || 0;
        const position = String(r['岗位名称'] || '').trim();
        const normalizedPos = normalizePosition(position);

        // 如果是区域，暂存数据
        if (center.endsWith('区域')) {
          const transferCenter = getTransferCenter(center);
          if (!regionData[transferCenter]) {
            regionData[transferCenter] = { departments: {}, positions: {} };
          }
          // 部门明细
          if (!regionData[transferCenter].departments[dept]) {
            regionData[transferCenter].departments[dept] = { 固定编制: 0, 临时编制: 0, 在职人数: 0 };
          }
          regionData[transferCenter].departments[dept].固定编制 += fixedStaff;
          regionData[transferCenter].departments[dept].临时编制 += tempStaff;
          regionData[transferCenter].departments[dept].在职人数 += headcount;
          // 岗位明细
          if (!regionData[transferCenter].positions[dept]) {
            regionData[transferCenter].positions[dept] = {};
          }
          if (!regionData[transferCenter].positions[dept][normalizedPos]) {
            regionData[transferCenter].positions[dept][normalizedPos] = { 固定编制: 0, 临时编制: 0, 在职人数: 0 };
          }
          regionData[transferCenter].positions[dept][normalizedPos].固定编制 += fixedStaff;
          regionData[transferCenter].positions[dept][normalizedPos].临时编制 += tempStaff;
          regionData[transferCenter].positions[dept][normalizedPos].在职人数 += headcount;
          return;
        }

        // 转运中心数据
        if (!centerMap[center]) {
          centerMap[center] = { 非操在岗: 0, 非操固定编制: 0, 非操临时编制: 0, departments: {}, positions: {} };
        }
        centerMap[center].非操在岗 += headcount;
        centerMap[center].非操固定编制 += fixedStaff;
        centerMap[center].非操临时编制 += tempStaff;

        // 部门明细
        if (!centerMap[center].departments[dept]) {
          centerMap[center].departments[dept] = { 固定编制: 0, 临时编制: 0, 在职人数: 0 };
        }
        centerMap[center].departments[dept].固定编制 += fixedStaff;
        centerMap[center].departments[dept].临时编制 += tempStaff;
        centerMap[center].departments[dept].在职人数 += headcount;

        // 岗位明细（按部门嵌套）
        if (!centerMap[center].positions[dept]) {
          centerMap[center].positions[dept] = {};
        }
        if (!centerMap[center].positions[dept][normalizedPos]) {
          centerMap[center].positions[dept][normalizedPos] = { 固定编制: 0, 临时编制: 0, 在职人数: 0 };
        }
        centerMap[center].positions[dept][normalizedPos].固定编制 += fixedStaff;
        centerMap[center].positions[dept][normalizedPos].临时编制 += tempStaff;
        centerMap[center].positions[dept][normalizedPos].在职人数 += headcount;
      });

      // 合并区域数据到转运中心（区域有数据才替换，没有数据保留中心的）
      for (const [transferCenter, regionInfo] of Object.entries(regionData)) {
        if (!centerMap[transferCenter]) continue;
        const centerInfo = centerMap[transferCenter];

        // 检查并合并部门数据
        for (const [dept, deptData] of Object.entries(regionInfo.departments)) {
          // 区域财务组 → 中心财务，区域人资组 → 中心人资
          let centerDept = dept.replace('区域', '中心').replace('组', '');
          // 只有区域有数据（在职人数>0 或 固定编制>0）才替换
          if (deptData.在职人数 > 0 || deptData.固定编制 > 0) {
            centerInfo.departments[centerDept] = deptData;
            // 同时更新岗位数据
            if (regionInfo.positions[dept]) {
              centerInfo.positions[centerDept] = regionInfo.positions[dept];
            }
          }
        }
      }

      // 岗位排序：同一部门内主管/经理排前面，专员排后面
      for (const center of Object.keys(centerMap)) {
        const sortedPositions = {};
        for (const dept of Object.keys(centerMap[center].positions)) {
          const positions = centerMap[center].positions[dept];
          const sorted = Object.entries(positions).sort((a, b) => {
            const orderA = getPositionOrder(a[0]);
            const orderB = getPositionOrder(b[0]);
            if (orderA !== orderB) return orderA - orderB;
            return a[0].localeCompare(b[0]); // 同优先级按字母排序
          });
          sortedPositions[dept] = Object.fromEntries(sorted);
        }
        centerMap[center].positions = sortedPositions;
      }

      const outPath = join(JSON_DIR, 'staffing_detail.json');
      writeFileSync(outPath, JSON.stringify(centerMap, null, 2));
      console.log(`  ✅ ${staffingFile} -> staffing_detail.json (${Object.keys(centerMap).length} 中心)`);
      successCount++;
    } catch (error) {
      console.error(`[构建 JSON 数据] 错误：处理 ${staffingFile} 失败:`, error.message);
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
