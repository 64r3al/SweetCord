export type DiscordProfile = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

const STATE_KEY = "sweetcord.oauth.state";
const VERIFIER_KEY = "sweetcord.oauth.pkce_verifier";
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

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
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

  const state = randomUrlSafeString();
  const verifier = randomUrlSafeString(48);
  const challenge = await createCodeChallenge(verifier);

  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const authorizeUrl = new URL("https://discord.com/oauth2/authorize");
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: OAUTH_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256"
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
  if (providerError) {
    throw new Error(providerError === "access_denied"
      ? "Discord sign-in was cancelled."
      : `Discord sign-in failed: ${providerError}`);
  }

  const code = params.get("code");
  const returnedState = params.get("state");
  if (!code) return null;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);

  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);

  if (!returnedState || !expectedState || returnedState !== expectedState) {
    throw new Error("Sign-in validation failed (state mismatch). Please try again.");
  }
  if (!verifier) {
    throw new Error("The sign-in session expired. Please try again.");
  }

  const apiBase = import.meta.env.VITE_AUTH_API_BASE_URL?.trim();
  const redirectUri = import.meta.env.VITE_DISCORD_REDIRECT_URI?.trim();
  if (!apiBase || !redirectUri) {
    throw new Error("Discord authorization returned successfully, but the trusted code-exchange backend is not configured yet.");
  }

  const response = await fetch(new URL("/auth/discord/exchange", apiBase), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ code, codeVerifier: verifier, redirectUri })
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
