// 协作数据 API 入口文件
// 当前使用 Supabase 版本（已完成 GitHub API → Supabase 迁移）
// GitHub 版本保留在 collaborationApi.github.ts（用于回滚）

// 重新导出 Supabase 版本的所有函数
export {
  loadCollaborationData,
  saveCollaborationData,
  clearCollaborationCache,
  getCollaborationSha
} from './collaborationApi.supabase';
