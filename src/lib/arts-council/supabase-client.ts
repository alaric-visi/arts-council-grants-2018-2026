import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if credentials are valid and present
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Supabase client for Arts Council explorer.
 * Falls back to null if no configuration is present in local environment.
 */
export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
