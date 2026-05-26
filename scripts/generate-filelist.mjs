#!/usr/bin/env node

/**
 * 生成 public/database/filelist.json
 * 使用 git log 获取文件的最后修改时间（而非 checkout 时间）
 * 同时计算文件 MD5 hash，作为增量更新的备用判断依据
 * 解决 GitHub Actions checkout 重置文件 mtime 导致增量更新失效的问题
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const DATABASE_DIR = 'public/database';

/**
 * 获取文件的最后 git commit 时间
 * 如果 git log 失败，返回 null（由调用方处理 fallback）
 */
function getGitMtime(filepath) {
  try {
    // git log -1 --format=%cI: 获取最后一次 commit 的 ISO 8601 时间
    const result = execSync(`git log -1 --format=%cI -- "${filepath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });
    const isoTime = result.trim();
    if (isoTime) {
      const date = new Date(isoTime);
      return date.toISOString();
    }
  } catch (error) {
    console.error(`[警告] git log 失败: ${filepath}`);
    console.error(`  错误:`, error.message);
    if (error.stderr) {
      console.error(`  stderr:`, error.stderr.toString());
    }
  }
  return null;
}

/**
 * 计算文件 MD5 hash
 * 用于增量更新判断（不受 mtime 影响，只与文件内容有关）
 */
function getFileHash(filepath) {
  try {
    const content = readFileSync(filepath);
    return createHash('md5').update(content).digest('hex');
  } catch (error) {
    console.error(`[警告] 计算 hash 失败: ${filepath}`, error.message);
    return null;
  }
}

/**
 * 主函数：生成 filelist.json
 */
function generateFileList() {
  const dbDir = join(process.cwd(), DATABASE_DIR);

  // 只处理 .xlsx 和 .csv 文件（排除 filelist.json 本身）
  const files = readdirSync(dbDir).filter(
    (f) => (f.endsWith('.xlsx') || f.endsWith('.csv')) && f !== 'filelist.json'
  );

  const fileList = {
    generated_at: new Date().toISOString(),
    files: {},
  };

  let gitLogSuccess = 0;
  let gitLogFail = 0;

  for (const file of files) {
    const filepath = join(DATABASE_DIR, file);
    const fullPath = join(process.cwd(), filepath);
    const stats = statSync(fullPath);

    // 尝试获取 git commit 时间
    const mtime = getGitMtime(filepath);
    if (mtime) {
      gitLogSuccess++;
    } else {
      gitLogFail++;
    }

    // 计算文件 hash（备用判断依据）
    const hash = getFileHash(fullPath);

    fileList.files[file] = {
      mtime: mtime || stats.mtime.toISOString(),
      size: stats.size,
      hash: hash,
    };
  }

  // 写入 filelist.json
  const outputPath = join(dbDir, 'filelist.json');
  writeFileSync(outputPath, JSON.stringify(fileList, null, 2));

  console.log(`✅ 生成 filelist.json：共 ${files.length} 个文件`);
  console.log(`   git log 成功: ${gitLogSuccess}, 失败: ${gitLogFail}`);
  console.log(`   generated_at: ${fileList.generated_at}`);
}

generateFileList();
