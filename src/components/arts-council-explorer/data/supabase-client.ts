import type { SupabaseClient } from "@supabase/supabase-js";

// Module-local declaration so this file type-checks without @types/node.
// It emits no code: at runtime `process` is whatever the bundler or Node provides.
declare const process: { env: Record<string, string | undefined> };

// Each env var is read with its full literal name, inside try/catch.
//
// Literal names: Vite and Next.js replace env vars at build time by matching
// the exact expression (`import.meta.env.VITE_X`, `process.env.NEXT_PUBLIC_X`).
// try/catch: under Vite there is no `process` (ReferenceError), and under
// webpack/Next `import.meta.env` is undefined (TypeError).
const readEnv = (...readers: Array<() => string | undefined>): string => {
  for (const read of readers) {
    try {
      const value = read();
      if (value) return value;
    } catch {
      // Not available in this environment; try the next reader.
    }
  }
  return "";
};

const supabaseUrl = readEnv(
  () => (import.meta as any).env.VITE_SUPABASE_URL,
  () => process.env.NEXT_PUBLIC_SUPABASE_URL
);

const supabaseAnonKey = readEnv(
  () => (import.meta as any).env.VITE_SUPABASE_ANON_KEY,
  () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export type SupabaseClientLike = SupabaseClient;

let client: Promise<SupabaseClient | null> | null = null;

/**
 * The Supabase client, or null when it isn't configured. The library is
 * loaded on first use, so static-only deployments never download it.
 */
export const loadSupabaseClient = (): Promise<SupabaseClient | null> => {
  if (!hasSupabaseConfig) return Promise.resolve(null);
  client ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(supabaseUrl, supabaseAnonKey));
  return client;
};
