export type DiscordProfile = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

const STATE_KEY = "sweetcord.oauth.state";
const OAUTH_SCOPES = "identify";

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomUrlSafeString(byteLength = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64Url(bytes);
}

export function getDiscordAvatarUrl(profile: DiscordProfile): string | null {
  if (!profile.avatar) return null;
  const extension = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(profile.id)}/${encodeURIComponent(profile.avatar)}.${extension}?size=128`;
}

export async function startDiscordOAuth(): Promise<void> {
  const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID?.trim();
  const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI?.trim();

  if (!clientId || !redirectUri) {
    throw new Error("Discord OAuth is not configured yet. Set VITE_DISCORD_CLIENT_ID and VITE_DISCORD_REDIRECT_URI in .env.local.");
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure browser cryptography is unavailable. Run SweetCord on localhost or HTTPS.");
  }

  // The general Discord OAuth2 authorization-code docs document state but do not
  // document PKCE for this flow. Keep state validation and perform the code
  // exchange server-side with the confidential client secret.
  const state = randomUrlSafeString();
  sessionStorage.setItem(STATE_KEY, state);

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES,
    state
  }).toString();

  window.location.assign(authorizeUrl.toString());
}

/**
 * Completes the browser callback. The desktop/frontend never exchanges a
 * Discord code itself and never stores a Discord access token. A trusted
 * backend endpoint must validate/exchange the code and return only the
 * minimum profile fields needed by the UI.
 */
export async function completeDiscordOAuth(): Promise<DiscordProfile | null> {
  const params = new URLSearchParams(window.location.search);
  const providerError = params.get("error");
  const code = params.get("code");
  const returnedState = params.get("state");
  if (!code && !providerError) return null;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    throw new Error("Sign-in validation failed (state mismatch). Please try again.");
  }
  if (providerError) {
    throw new Error(providerError === "access_denied"
      ? "Discord sign-in was cancelled."
      : `Discord sign-in failed: ${providerError}`);
  }
  if (!code) return null;

  const configuredEndpoint = import.meta.env.VITE_DISCORD_EXCHANGE_ENDPOINT?.trim();
  const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI?.trim();
  const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const isLocalHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const localEndpoint = new URL("/api/discord-oauth-exchange", window.location.origin).toString();
  // Without a remote endpoint, local development uses a Vite-server-only test route.
  // It is not present in production builds and only verifies identity for UI testing.
  const exchangeEndpoint = configuredEndpoint || (
    isLocalHost && window.location.port === "5173" ? localEndpoint : ""
  );
  const isLocalTestEndpoint = isLocalHost &&
    window.location.port === "5173" &&
    exchangeEndpoint === localEndpoint;

  if (!exchangeEndpoint || !redirectUri) {
    throw new Error("Discord sign-in is not configured. Set VITE_DISCORD_CLIENT_ID and VITE_DISCORD_REDIRECT_URI in .env.local.");
  }
  if (!isLocalTestEndpoint && !supabasePublishableKey) {
    throw new Error("The remote Discord sign-in endpoint needs VITE_SUPABASE_PUBLISHABLE_KEY in .env.local.");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (supabasePublishableKey) headers.apikey = supabasePublishableKey;

  const response = await fetch(exchangeEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ code, redirectUri })
  });

  if (!response.ok) {
    throw new Error(response.status === 401 || response.status === 403
      ? "Discord sign-in could not be verified by the backend."
      : "The sign-in service is unavailable. Please try again.");
  }

  const result: { profile?: DiscordProfile } = await response.json();
  if (!result.profile?.id || !result.profile.username) {
    throw new Error("The sign-in service returned an invalid profile.");
  }

  return result.profile;
}
