import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] 缺少环境变量 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (url, options) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8秒超时
      const signal = controller.signal;
      // 合并已有 signal
      if (options?.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }
      return fetch(url, { ...options, signal }).finally(() => clearTimeout(timeout));
    },
  },
});
