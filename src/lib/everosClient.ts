/**
 * EverOS 记忆层客户端 — 浏览器端
 * 用于记录和检索用户操作，实现跨会话上下文持久化
 */

const EVEROS_BASE = 'https://api.evermind.ai/v1';
const API_KEY = typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_EVEROS_API_KEY || '' : '';

interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  timestamp?: number;
  content: string;
}

interface AddMemoryParams {
  user_id: string;
  session_id?: string;
  messages: MemoryMessage[];
}

interface SearchParams {
  user_id: string;
  query: string;
  method?: 'semantic' | 'keyword' | 'hybrid';
  top_k?: number;
  memory_type?: string;
}

interface GetParams {
  filters: Record<string, string>;
  memory_type?: string;
  page?: number;
  page_size?: number;
}

function headers(): Record<string, string> {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/** 生成 session_id */
function genSessionId(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${Math.random().toString(36).slice(2, 8)}`;
}

// 当前会话 ID（页面生命周期内不变）
let _sessionId = '';

export function getSessionId(): string {
  if (!_sessionId) _sessionId = genSessionId();
  return _sessionId;
}

/** 通用请求 */
async function request(method: string, path: string, body?: any): Promise<any> {
  const url = `${EVEROS_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`EverOS ${method} ${path} ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── 公共 API ──

/** 新增记忆 */
export async function addMemory(params: AddMemoryParams): Promise<any> {
  return request('POST', '/memories/agent', {
    messages: params.messages,
    user_id: params.user_id,
    session_id: params.session_id || getSessionId(),
  });
}

/** 获取记忆列表 */
export async function getMemories(params: GetParams): Promise<any> {
  const qs = new URLSearchParams();
  Object.entries(params.filters).forEach(([k, v]) => qs.append(k, v));
  if (params.memory_type) qs.set('memory_type', params.memory_type);
  if (params.page) qs.set('page', String(params.page));
  if (params.page_size) qs.set('page_size', String(params.page_size));
  return request('GET', `/memories?${qs.toString()}`);
}

/** 搜索记忆 */
export async function searchMemories(params: SearchParams): Promise<any> {
  return request('POST', '/memories/search', params);
}

/** 删除记忆 */
export async function deleteMemory(memoryId: string): Promise<any> {
  return request('DELETE', `/memories/${memoryId}`);
}

/** 清空某类记忆 */
export async function flushMemories(userId: string, memoryType?: string): Promise<any> {
  const body: any = { user_id: userId };
  if (memoryType) body.memory_type = memoryType;
  return request('POST', '/memories/flush', body);
}

// ── 业务封装 ──

const DEFAULT_USER = 'liuyang';

/**
 * 记录一条操作日志
 */
export async function recordAction(
  action: string,
  detail: string,
  userId: string = DEFAULT_USER,
) {
  try {
    return await addMemory({
      user_id: userId,
      session_id: getSessionId(),
      messages: [{
        role: 'user',
        content: `[${action}] ${detail}`,
        timestamp: Date.now(),
      }],
    });
  } catch (e) {
    console.warn('[EverOS] 记录失败:', e);
    return null;
  }
}

/**
 * 搜索相关历史操作
 */
export async function recallContext(query: string, userId: string = DEFAULT_USER) {
  try {
    return await searchMemories({
      user_id: userId,
      query,
      method: 'hybrid',
      top_k: 5,
    });
  } catch (e) {
    console.warn('[EverOS] 搜索失败:', e);
    return null;
  }
}
