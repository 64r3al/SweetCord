export type HandlerDependencies = {
  getEnv?: (name: string) => string | undefined;
  fetcher?: typeof fetch;
};

const defaultEnv = (name: string) => Deno.env.get(name);
const defaultFetch: typeof fetch = (...args) => fetch(...args);

const jsonHeaders = (allowedOrigin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Vary": "Origin",
  "X-Content-Type-Options": "nosniff"
});

function jsonResponse(status: number, body: Record<string, unknown>, allowedOrigin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders(allowedOrigin)
  });
}

export function createHandler(deps: HandlerDependencies = {}) {
  const getEnv = deps.getEnv ?? defaultEnv;
  const fetcher = deps.fetcher ?? defaultFetch;

  return async (request: Request): Promise<Response> => {
    const configuredOrigin = getEnv("SWEETCORD_ALLOWED_ORIGIN");
    const configuredRedirectUri = getEnv("SWEETCORD_ALLOWED_REDIRECT_URI");
    const clientId = getEnv("DISCORD_CLIENT_ID");
    const clientSecret = getEnv("DISCORD_CLIENT_SECRET");
    const origin = request.headers.get("origin") ?? "";

    if (!configuredOrigin || !configuredRedirectUri || !clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: "Authentication service is not configured." }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    if (request.method === "OPTIONS") {
      if (origin !== configuredOrigin) {
        return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
      }
      return new Response(null, { status: 204, headers: jsonHeaders(configuredOrigin) });
    }

    if (origin !== configuredOrigin) {
      return jsonResponse(403, { error: "Origin not allowed." }, configuredOrigin);
    }
    if (request.method !== "POST") {
      return jsonResponse(405, { error: "Method not allowed." }, configuredOrigin);
    }
    if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
      return jsonResponse(415, { error: "Expected JSON." }, configuredOrigin);
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 8192) {
      return jsonResponse(413, { error: "Request is too large." }, configuredOrigin);
    }

    let body: { code?: unknown; redirectUri?: unknown };
    try {
      body = await request.json();
    } catch {
      return jsonResponse(400, { error: "Invalid request." }, configuredOrigin);
    }

    const code = typeof body.code === "string" ? body.code : "";
    const redirectUri = typeof body.redirectUri === "string" ? body.redirectUri : "";

    if (!code || code.length > 2048 || redirectUri !== configuredRedirectUri) {
      return jsonResponse(400, { error: "Invalid authorization request." }, configuredOrigin);
    }

    let accessToken: string | null = null;
    try {
      const form = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: configuredRedirectUri
      });

      const tokenResponse = await fetcher("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
        signal: AbortSignal.timeout(8000)
      });

      const tokenPayload: { access_token?: unknown; token_type?: unknown } = await tokenResponse.json();
      if (!tokenResponse.ok || typeof tokenPayload.access_token !== "string" ||
          typeof tokenPayload.token_type !== "string" || tokenPayload.token_type.toLowerCase() !== "bearer") {
        return jsonResponse(401, { error: "Discord could not verify this sign-in. Please try again." }, configuredOrigin);
      }

      accessToken = tokenPayload.access_token;
      const profileResponse = await fetcher("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(8000)
      });
      const user: {
        id?: unknown;
        username?: unknown;
        global_name?: unknown;
        avatar?: unknown;
      } = await profileResponse.json();

      if (!profileResponse.ok || typeof user.id !== "string" || typeof user.username !== "string") {
        return jsonResponse(401, { error: "Unable to retrieve the authorized profile." }, configuredOrigin);
      }

      return jsonResponse(200, {
        profile: {
          id: user.id,
          username: user.username,
          global_name: typeof user.global_name === "string" ? user.global_name : null,
          avatar: typeof user.avatar === "string" ? user.avatar : null
        }
      }, configuredOrigin);
    } catch {
      // Do not log authorization codes, provider tokens, secrets, or upstream response bodies.
      return jsonResponse(502, { error: "The sign-in service is temporarily unavailable." }, configuredOrigin);
    } finally {
      // This first milestone only verifies profile identity; no provider session is retained.
      // Always make a best-effort attempt to revoke the temporary access token.
      if (accessToken) {
        try {
          await fetcher("https://discord.com/api/v10/oauth2/token/revoke", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              token: accessToken,
              token_type_hint: "access_token"
            }),
            signal: AbortSignal.timeout(5000)
          });
        } catch {
          // Revocation failures are intentionally not logged or returned to the client.
        }
      }
    }
  };
}
