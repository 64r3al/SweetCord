import { createHandler } from "./handler.ts";

const env: Record<string, string> = {
  SWEETCORD_ALLOWED_ORIGIN: "http://127.0.0.1:5173",
  SWEETCORD_ALLOWED_REDIRECT_URI: "http://127.0.0.1:5173/",
  DISCORD_CLIENT_ID: "test-client-id",
  DISCORD_CLIENT_SECRET: "test-client-secret"
};

function makeRequest(
  url: string,
  init: RequestInit = {},
  origin = env.SWEETCORD_ALLOWED_ORIGIN
): Request {
  const headers = new Headers(init.headers);
  headers.set("Origin", origin);
  return new Request(url, { ...init, headers });
}

Deno.test("returns CORS headers on an allowed preflight", async () => {
  const handler = createHandler({ getEnv: (name) => env[name] });
  const response = await handler(makeRequest("https://function.test", { method: "OPTIONS" }));
  if (response.status !== 204) throw new Error(`Expected 204, got ${response.status}`);
  if (response.headers.get("Access-Control-Allow-Origin") !== env.SWEETCORD_ALLOWED_ORIGIN) {
    throw new Error("Expected exact allowed origin in CORS response");
  }
});

Deno.test("rejects an unexpected origin before exchange", async () => {
  let called = false;
  const handler = createHandler({
    getEnv: (name) => env[name],
    fetcher: async () => {
      called = true;
      return new Response("{}");
    }
  });
  const response = await handler(makeRequest(
    "https://function.test",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    "https://attacker.test"
  ));
  if (response.status !== 403) throw new Error(`Expected 403, got ${response.status}`);
  if (called) throw new Error("Upstream Discord should not be called for a disallowed origin");
});

Deno.test("rejects redirect URI mismatch before exchange", async () => {
  let called = false;
  const handler = createHandler({
    getEnv: (name) => env[name],
    fetcher: async () => {
      called = true;
      return new Response("{}");
    }
  });
  const response = await handler(makeRequest("https://function.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "sample-code", redirectUri: "http://evil.test/callback" })
  }));
  if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
  if (called) throw new Error("Upstream Discord should not be called for a redirect URI mismatch");
});

Deno.test("exchanges code, returns only profile, and revokes temporary provider token", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const handler = createHandler({
    getEnv: (name) => env[name],
    fetcher: async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/oauth2/token") && !url.endsWith("/oauth2/token/revoke")) {
        return Response.json({ access_token: "temporary-provider-token", token_type: "Bearer" });
      }
      if (url.endsWith("/users/@me")) {
        const authorization = new Headers(init?.headers).get("Authorization");
        if (authorization !== "Bearer temporary-provider-token") {
          throw new Error("Expected temporary bearer token for profile lookup");
        }
        return Response.json({
          id: "123456789",
          username: "test_user",
          global_name: "Test User",
          avatar: "avatar_hash"
        });
      }
      if (url.endsWith("/oauth2/token/revoke")) return new Response(null, { status: 200 });
      throw new Error(`Unexpected URL: ${url}`);
    }
  });

  const response = await handler(makeRequest("https://function.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "one-time-code", redirectUri: env.SWEETCORD_ALLOWED_REDIRECT_URI })
  }));
  const data = await response.json();
  if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
  if (data.profile?.id !== "123456789" || data.profile?.username !== "test_user") {
    throw new Error("Expected verified Discord profile");
  }
  if (JSON.stringify(data).includes("temporary-provider-token")) {
    throw new Error("Provider token must never be returned to the client");
  }
  if (!calls.some((call) => call.url.endsWith("/oauth2/token/revoke"))) {
    throw new Error("Expected temporary provider token revocation attempt");
  }
});

Deno.test("returns a generic error and never echoes upstream body on token failure", async () => {
  const handler = createHandler({
    getEnv: (name) => env[name],
    fetcher: async (input) => {
      if (String(input).endsWith("/oauth2/token/revoke")) return new Response(null, { status: 200 });
      return new Response(JSON.stringify({ error: "invalid_grant", secret: "do-not-echo" }), { status: 400 });
    }
  });
  const response = await handler(makeRequest("https://function.test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "expired-code", redirectUri: env.SWEETCORD_ALLOWED_REDIRECT_URI })
  }));
  const data = await response.text();
  if (response.status !== 401) throw new Error(`Expected 401, got ${response.status}`);
  if (data.includes("do-not-echo") || data.includes("invalid_grant")) {
    throw new Error("Upstream error details must not be exposed");
  }
});

Deno.test("rejects missing configuration without exposing environment details", async () => {
  const handler = createHandler({ getEnv: () => undefined });
  const response = await handler(makeRequest("https://function.test", { method: "POST" }));
  const data = await response.text();
  if (response.status !== 500) throw new Error(`Expected 500, got ${response.status}`);
  if (data.includes("DISCORD_CLIENT_SECRET")) throw new Error("Response must not name missing secret variables");
});
