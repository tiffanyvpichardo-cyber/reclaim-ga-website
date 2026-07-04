import { createClient } from "@supabase/supabase-js";

// The URL and anon key are SAFE to ship in the client bundle. The anon key is
// public by design; your data is protected by Row Level Security + login (see
// schema.sql). This is different from the secret service keys, which never go
// in the browser.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null;
