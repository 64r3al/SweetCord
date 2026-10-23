import { createClient } from "@supabase/supabase-js";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigured = Boolean(projectUrl && publishableKey);

export const supabase = supabaseConfigured && projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // SweetCord owns a separate Discord identity-preview callback.
        // Do not let Supabase consume that callback's query parameters.
        detectSessionInUrl: false
      }
    })
  : null;
