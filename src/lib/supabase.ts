import { createClient } from "@supabase/supabase-js";

const projectUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigured = Boolean(projectUrl && publishableKey);

export const supabase = supabaseConfigured && projectUrl && publishableKey
  ? createClient(projectUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Supabase handles the OAuth callback and PKCE code exchange so real
        // Discord sign-ins restore the authenticated SweetCord session.
        detectSessionInUrl: true
      }
    })
  : null;
