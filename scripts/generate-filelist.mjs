#!/usr/bin/env node

/**
 * 生成 public/database/filelist.json
 * 使用 git log 获取文件的最后修改时间（而非 checkout 时间）
 * 解决 GitHub Actions checkout 重置文件 mtime 导致增量更新失效的问题
 */

import { execSync } from 'child_process';
import { readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATABASE_DIR = 'public/database';

/**
 * 获取文件的最后 git commit 时间
 * 如果文件尚未提交（新文件），返回当前时间
 */
function getGitMtime(filepath) {
  try {
    // git log -1 --format=%cI: 获取最后一次 commit 的 ISO 8601 时间
    // %cI = committer date in ISO 8601 (e.g. 2026-05-12T11:23:22+08:00)
    const result = execSync(`git log -1 --format=%cI -- "${filepath}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      cwd: process.cwd(),
    });
    const isoTime = result.trim();
    if (isoTime) {
      // 转换为 UTC 时间（与现有 filelist.json 格式一致：2026-05-12T03:23:22.000Z）
      const date = new Date(isoTime);
      return date.toISOString();
    }
  } catch {
    // git log 失败（文件未提交或不在 git 历史中）
  }

  // fallback：使用文件 stat 时间（新文件尚未 commit）
  try {
    const stats = statSync(filepath);
    return stats.mtime.toISOString();
  } catch {
    return new Date().toISOString();
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

  for (const file of files) {
    const filepath = join(DATABASE_DIR, file);
    const stats = statSync(filepath);
    const mtime = getGitMtime(filepath);

    fileList.files[file] = {
      mtime: mtime,
      size: stats.size,
    };
  }

  // 写入 filelist.json
  const outputPath = join(dbDir, 'filelist.json');
  writeFileSync(outputPath, JSON.stringify(fileList, null, 2));

  console.log(`✅ 生成 filelist.json：共 ${files.length} 个文件`);
  console.log(`   generated_at: ${fileList.generated_at}`);
}

generateFileList();
