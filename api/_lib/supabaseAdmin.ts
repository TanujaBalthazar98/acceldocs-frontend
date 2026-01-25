import { createClient } from "@supabase/supabase-js";

type SupabaseAdminClient = ReturnType<typeof createClient>;

const getEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing ${key}`);
  }
  return value;
};

export const getSupabaseAdmin = (): SupabaseAdminClient => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing SUPABASE_URL");
  }

  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
