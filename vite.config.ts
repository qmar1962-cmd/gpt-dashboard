import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';

// Vite 插件：自动扫描 public/database/ 目录，生成 filelist.json
function databaseFileListPlugin() {
  const dbDir = path.resolve(__dirname, 'public/database');
  const outputPath = path.resolve(__dirname, 'public/database/filelist.json');

  return {
    name: 'database-file-list',
    // 构建时生成 filelist.json
    buildStart() {
      generateFileList();
    },
    // dev 模式下也生成 filelist.json
    configureServer(server: any) {
      generateFileList();
      // 监听 public/database/ 目录变化，自动更新 filelist.json
      const watchDir = dbDir;
      if (fs.existsSync(watchDir)) {
        fs.watch(watchDir, { persistent: false }, (eventType, filename) => {
          if (filename && /\.xlsx?$/i.test(filename)) {
            console.log(`[database-file-list] 检测到文件变化：${filename}，重新扫描...`);
            generateFileList();
          }
        });
      }
    },
  };

  function generateFileList() {
    if (!fs.existsSync(dbDir)) {
      console.warn('[database-file-list] public/database/ 目录不存在，跳过扫描');
      return;
    }
    const files = fs.readdirSync(dbDir).filter(f => /\.xlsx?$/i.test(f));
    
    // 生成带时间戳和文件大小的文件列表
    const fileListObj: { [key: string]: { mtime: string; size: number } } = {};
    for (const file of files) {
      const filePath = path.join(dbDir, file);
      const stat = fs.statSync(filePath);
      fileListObj[file] = {
        mtime: stat.mtime.toISOString(), // 文件修改时间
        size: stat.size, // 文件大小
      };
    }
    
    const output = {
      generated_at: new Date().toISOString(),
      files: fileListObj,
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`[database-file-list] 扫描到 ${files.length} 个文件，已写入 public/database/filelist.json`);
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: '/gpt-dashboard/', // GitHub Pages 子路径部署需要指定仓库名
    plugins: [react(), tailwindcss(), databaseFileListPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
