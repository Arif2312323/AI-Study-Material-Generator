import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://brhlokvlmytntakjjskn.supabase.co",
  process.env.SUPABASE_KEY
  //   { auth: { autoRefreshToken: false, persistSession: false }}
);
