/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DISCORD_CLIENT_ID: string;
  readonly VITE_DISCORD_REDIRECT_URI: string;
  readonly VITE_DISCORD_EXCHANGE_ENDPOINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
