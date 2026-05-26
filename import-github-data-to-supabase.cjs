// 导入 GitHub 备份数据到 Supabase
// 用法：node import-github-data-to-supabase.js

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iglqganwgltuvhzdwtos.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const BACKUP_DIR = path.join(__dirname, 'backup', 'github-collaboration-data');

// 文件名 -> 表名 + 转换函数
const FILE_CONFIG = {
  'leave_plans.json': {
    table: 'leave_plans',
    transform: (data) => {
      const rows = [];
      for (const center of Object.keys(data)) {
        for (const date of Object.keys(data[center])) {
          for (const name of Object.keys(data[center][date])) {
            const item = data[center][date][name];
            rows.push({
              center,
              date,
              name,
              start_date: item.start || null,
              end_date: item.end || null,
              set_date: item.setDate || null,
            });
          }
        }
      }
      return rows;
    }
  },
  'absence_reasons.json': {
    table: 'absence_reasons',
    transform: (data) => {
      const rows = [];
      for (const center of Object.keys(data)) {
        for (const date of Object.keys(data[center])) {
          for (const name of Object.keys(data[center][date])) {
            const item = data[center][date][name];
            rows.push({
              center,
              date,
              name,
              reason: item.reason || '',
              record_date: item.date || null,
            });
          }
        }
      }
      return rows;
    }
  },
  'center_meta.json': {
    table: 'center_meta',
    transform: (data) => {
      const rows = [];
      for (const center of Object.keys(data)) {
        const item = data[center];
        rows.push({
          center,
          attendance_manager: item['考勤负责人'] || '',
          updated_at: item.updatedAt || null,
        });
      }
      return rows;
    }
  },
  'group_leaders.json': {
    table: 'group_leaders',
    transform: (data) => {
      const rows = [];
      for (const key of Object.keys(data)) {
        const [center, groupName] = key.split('|||');
        rows.push({
          center,
          group_name: groupName,
          leader_name: data[key] || '',
        });
      }
      return rows;
    }
  }
};

async function importFile(fileName) {
  const config = FILE_CONFIG[fileName];
  if (!config) {
    console.log(`[导入] 跳过未知文件: ${fileName}`);
    return;
  }

  const filePath = path.join(BACKUP_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`[导入] 文件不存在: ${filePath}`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  // 跳过 GitHub 404 错误页面
  if (fileContent.startsWith('404') || fileContent.startsWith('<')) {
    console.log(`[导入] ${fileName}: 文件内容无效（404/HTML），跳过`);
    return;
  }

  let data;
  try {
    data = JSON.parse(fileContent);
  } catch (e) {
    console.error(`[导入] ${fileName}: JSON 解析失败:`, e.message);
    return;
  }
  const rows = config.transform(data);

  if (rows.length === 0) {
    console.log(`[导入] ${fileName}: 无数据，跳过`);
    return;
  }

  console.log(`[导入] ${fileName}: 转换得到 ${rows.length} 行，开始插入 ${config.table}...`);

  // 先删除旧数据
  const deleteResp = await fetch(
    `${SUPABASE_URL}/rest/v1/${config.table}?id=neq.0`,
    {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal',
      },
    }
  );

  if (!deleteResp.ok) {
    const errText = await deleteResp.text();
    console.error(`[导入] ${fileName}: 删除旧数据失败 ${deleteResp.status}: ${errText}`);
    return;
  }

  console.log(`[导入] ${fileName}: 旧数据已清除，开始插入 ${rows.length} 行...`);

  // 分批插入（每批 100 行）
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    
    const insertResp = await fetch(
      `${SUPABASE_URL}/rest/v1/${config.table}`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(batch),
      }
    );

    if (!insertResp.ok) {
      const errText = await insertResp.text();
      console.error(`[导入] ${fileName}: 插入失败 ${insertResp.status}: ${errText}`);
      console.error(`[导入] 失败批次数据:`, JSON.stringify(batch.slice(0, 2)));
      return;
    }

    console.log(`[导入] ${fileName}: 已插入 ${i + batch.length}/${rows.length}`);
  }

  console.log(`[导入] ✅ ${fileName}: 完成！共插入 ${rows.length} 行`);
}

async function main() {
  console.log('=== 开始导入 GitHub 备份数据到 Supabase ===');
  console.log('备份目录:', BACKUP_DIR);

  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json'));
  console.log('发现文件:', files);

  for (const file of files) {
    await importFile(file);
    console.log(''); // 空行分隔
  }

  console.log('=== 导入完成 ===');
}

main().catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
