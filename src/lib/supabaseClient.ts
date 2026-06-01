import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] 缺少环境变量，协作功能不可用');
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: (url, options) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const signal = controller.signal;
        if (options?.signal) {
          options.signal.addEventListener('abort', () => controller.abort());
        }
        return fetch(url, { ...options, signal }).finally(() => clearTimeout(timeout));
      },
    },
  });
}

export const supabase = supabaseUrl ? createSupabaseClient() : null;
