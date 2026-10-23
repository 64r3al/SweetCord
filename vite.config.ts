import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function localDiscordOAuthTestPlugin(env: Record<string, string>): Plugin {
  return {
    name: "sweetcord-local-discord-oauth-test",
    apply: "serve",
    configureServer(server) {
      // This endpoint exists only on the local Vite development server.
      // The Discord client secret is read server-side and is never sent to the browser.
      server.middlewares.use("/api/discord-oauth-exchange", async (req, res) => {
        const allowedOrigin = env.SWEETCORD_ALLOWED_ORIGIN?.trim() || "http://127.0.0.1:5173";
        const origin = req.headers.origin ?? "";

        const send = (status: number, body: Record<string, unknown>) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          if (origin === allowedOrigin) {
            res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
            res.setHeader("Vary", "Origin");
          }
          res.end(JSON.stringify(body));
        };

        if (origin !== allowedOrigin) {
          send(403, { error: "Origin not allowed." });
          return;
        }

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
          res.setHeader("Access-Control-Allow-Headers", "content-type");
          res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("Vary", "Origin");
          res.end();
          return;
        }

        if (req.method !== "POST") {
          send(405, { error: "Method not allowed." });
          return;
        }

        if (!(req.headers["content-type"] ?? "").toLowerCase().includes("application/json")) {
          send(415, { error: "Expected JSON." });
          return;
        }

        const contentLength = Number(req.headers["content-length"] ?? "0");
        if (Number.isFinite(contentLength) && contentLength > 8192) {
          send(413, { error: "Request is too large." });
          return;
        }

        const clientId = env.VITE_DISCORD_CLIENT_ID?.trim() || env.DISCORD_CLIENT_ID?.trim();
        const clientSecret = env.DISCORD_CLIENT_SECRET?.trim();
        const allowedRedirectUri = env.VITE_DISCORD_REDIRECT_URI?.trim();

        if (!clientId || !clientSecret || !allowedRedirectUri) {
          send(500, { error: "Local Discord OAuth test is not configured. Check .env.local." });
          return;
        }

        let chunks: Uint8Array[] = [];
        let byteCount = 0;
        let tooLarge = false;
        try {
          await new Promise<void>((resolve, reject) => {
            req.on("data", (chunk: Uint8Array) => {
              byteCount += chunk.byteLength;
              if (byteCount > 8192) {
                tooLarge = true;
                return;
              }
              chunks.push(new Uint8Array(chunk));
            });
            req.on("end", resolve);
            req.on("error", reject);
          });
        } catch {
          send(400, { error: "Invalid request." });
          return;
        }

        if (tooLarge) {
          send(413, { error: "Request is too large." });
          return;
        }

        const bodyLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
        const bodyBytes = new Uint8Array(bodyLength);
        let offset = 0;
        for (const chunk of chunks) {
          bodyBytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
        chunks = [];

        let payload: { code?: unknown; redirectUri?: unknown };
        try {
          payload = JSON.parse(new TextDecoder().decode(bodyBytes)) as { code?: unknown; redirectUri?: unknown };
        } catch {
          send(400, { error: "Invalid request." });
          return;
        }

        const code = typeof payload.code === "string" ? payload.code : "";
        const redirectUri = typeof payload.redirectUri === "string" ? payload.redirectUri : "";
        if (!code || code.length > 2048 || redirectUri !== allowedRedirectUri) {
          send(400, { error: "Invalid authorization request." });
          return;
        }

        let accessToken: string | null = null;
        try {
          const tokenResponse = await fetch("https://discord.com/api/v10/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: "authorization_code",
              code,
              redirect_uri: allowedRedirectUri
            }),
            signal: AbortSignal.timeout(8000)
          });

          const tokenPayload = await tokenResponse.json() as { access_token?: unknown; token_type?: unknown };
          if (!tokenResponse.ok || typeof tokenPayload.access_token !== "string" ||
              typeof tokenPayload.token_type !== "string" || tokenPayload.token_type.toLowerCase() !== "bearer") {
            send(401, { error: "Discord could not verify this sign-in. Check the OAuth app settings and try again." });
            return;
          }

          accessToken = tokenPayload.access_token;
          const profileResponse = await fetch("https://discord.com/api/v10/users/@me", {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(8000)
          });
          const user = await profileResponse.json() as {
            id?: unknown;
            username?: unknown;
            global_name?: unknown;
            avatar?: unknown;
          };

          if (!profileResponse.ok || typeof user.id !== "string" || typeof user.username !== "string") {
            send(401, { error: "Unable to retrieve the authorized Discord profile." });
            return;
          }

          send(200, {
            profile: {
              id: user.id,
              username: user.username,
              global_name: typeof user.global_name === "string" ? user.global_name : null,
              avatar: typeof user.avatar === "string" ? user.avatar : null
            }
          });
        } catch {
          // Do not log OAuth codes, provider tokens, secrets, or upstream response bodies.
          send(502, { error: "Discord sign-in is temporarily unavailable." });
        } finally {
          // This is a short-lived identity check only. Revoke the temporary access token
          // rather than persisting it or exposing it to the browser.
          if (accessToken) {
            try {
              await fetch("https://discord.com/api/v10/oauth2/token/revoke", {
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
              // Best-effort revocation; never log secrets if the endpoint is unavailable.
            }
          }
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // loadEnv is read by the Node-side config only. DISCORD_CLIENT_SECRET has no VITE_ prefix,
  // so the secret is not exposed to the browser bundle.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), localDiscordOAuthTestPlugin(env)],
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true
    }
  };
});
