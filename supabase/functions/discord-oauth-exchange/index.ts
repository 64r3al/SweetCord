const jsonHeaders = (allowedOrigin: string) => ({
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "content-type",
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

Deno.serve(async (request: Request) => {
  const configuredOrigin = Deno.env.get("SWEETCORD_ALLOWED_ORIGIN");
  const configuredRedirectUri = Deno.env.get("SWEETCORD_ALLOWED_REDIRECT_URI");
  const clientId = Deno.env.get("DISCORD_CLIENT_ID");
  const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET");
  const origin = request.headers.get("origin") ?? "";

  if (!configuredOrigin || !configuredRedirectUri || !clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: "Authentication service is not configured." }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  if (origin !== configuredOrigin) {
    return new Response(JSON.stringify({ error: "Origin not allowed." }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: jsonHeaders(configuredOrigin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." }, configuredOrigin);
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    return jsonResponse(415, { error: "Expected JSON." }, configuredOrigin);
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

  try {
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: configuredRedirectUri
    });

    const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });

    const tokenPayload: { access_token?: unknown; token_type?: unknown } = await tokenResponse.json();
    if (!tokenResponse.ok || typeof tokenPayload.access_token !== "string" ||
        tokenPayload.token_type !== "Bearer") {
      return jsonResponse(401, { error: "Discord could not verify this sign-in. Please try again." }, configuredOrigin);
    }

    // Keep the provider token strictly on the server; return only basic profile fields.
    const profileResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenPayload.access_token}` }
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
    // Do not log authorization codes, tokens, secrets, or upstream response bodies.
    return jsonResponse(502, { error: "The sign-in service is temporarily unavailable." }, configuredOrigin);
  }
});
