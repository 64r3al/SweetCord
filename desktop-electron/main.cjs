"use strict";

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  session,
  shell
} = require("electron");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const DISCORD_START_URL = "https://discord.com/app";
const DISCORD_HOSTS = ["discord.com", "discord.gg", "discordapp.com", "discordapp.net"];
const OAUTH_HOSTS = [
  "accounts.google.com",
  "appleid.apple.com",
  "github.com",
  "id.twitch.tv",
  "login.live.com",
  "login.microsoftonline.com",
  "steamcommunity.com",
  "accounts.spotify.com",
  "epicgames.com",
  "xbox.com"
];
const ALLOWED_PERMISSION_NAMES = new Set(["media", "notifications", "fullscreen"]);

let mainWindow = null;
let networkErrorPromptOpen = false;

app.setAppUserModelId("app.sweetcord.desktop");

function hostMatches(hostname, candidates) {
  const normalized = String(hostname || "").toLowerCase();
  return candidates.some((domain) => normalized === domain || normalized.endsWith("." + domain));
}

function isDiscordHost(hostname) {
  return hostMatches(hostname, DISCORD_HOSTS);
}

function isTrustedWebUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    return isDiscordHost(url.hostname) || hostMatches(url.hostname, OAUTH_HOSTS);
  } catch {
    return false;
  }
}

function parseUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

async function openExternalIfSafe(rawUrl) {
  const url = parseUrl(rawUrl);
  if (!url || !["https:", "http:", "mailto:"].includes(url.protocol)) return;
  try {
    await shell.openExternal(url.toString());
  } catch {
    // Keep link-handler failures from crashing the main Discord window.
  }
}

function attachNavigationPolicy(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedWebUrl(url)) return { action: "allow" };
    void openExternalIfSafe(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (isTrustedWebUrl(url)) return;
    event.preventDefault();
    void openExternalIfSafe(url);
  });

  window.webContents.on("will-redirect", (event, url) => {
    if (isTrustedWebUrl(url)) return;
    event.preventDefault();
  });

  window.webContents.on("did-create-window", (childWindow) => {
    childWindow.setMenuBarVisibility(false);
    attachNavigationPolicy(childWindow);
  });
}

const LEAN_STYLE_ID = "sweetcord-lean-mode-style";
const LEAN_STYLES = [
  /* Navigation destinations that primarily promote optional purchases/discovery. */
  '#app-mount a[href="/store"],',
  '#app-mount a[href^="/store/"],',
  '#app-mount a[href="/shop"],',
  '#app-mount a[href^="/shop/"],',
  '#app-mount a[href="/quests"],',
  '#app-mount a[href^="/quests/"],',
  '#app-mount a[href="/quest-home"],',
  '#app-mount a[href^="/quest-home/"],',
  '#app-mount a[href="/nitro"],',
  '#app-mount a[href^="/nitro/"],',
  '#app-mount a[href="/discovery"],',
  '#app-mount a[href^="/discovery/"],',
  '#app-mount a[href="/guild-discovery"],',
  '#app-mount a[href^="/guild-discovery/"],',
  '#app-mount [data-list-item-id*="shop" i],',
  '#app-mount [data-list-item-id*="quest" i],',
  '#app-mount [data-list-item-id*="nitro" i],',
  '#app-mount [data-list-item-id*="store" i],',
  '#app-mount [role="listitem"]:has(> a[href="/store"]),',
  '#app-mount [role="listitem"]:has(> a[href="/shop"]),',
  '#app-mount [role="listitem"]:has(> a[href="/quests"]),',
  '#app-mount [role="listitem"]:has(> a[href="/quest-home"]),',
  '#app-mount [role="listitem"]:has(> a[href="/nitro"]),',
  '#app-mount [role="listitem"]:has(> a[href="/discovery"]),',
  '#app-mount [role="listitem"]:has(> a[href="/guild-discovery"])',
  '{ display: none !important; }',
  /* Reduce visual work without turning off hardware acceleration or video. */
  'html.sweetcord-lean-mode #app-mount *,',
  'html.sweetcord-lean-mode #app-mount *::before,',
  'html.sweetcord-lean-mode #app-mount *::after',
  '{ scroll-behavior: auto !important; transition-duration: 80ms !important; transition-delay: 0ms !important; }',
  'html.sweetcord-lean-mode #app-mount [class*="promo" i],',
  'html.sweetcord-lean-mode #app-mount [class*="nitroUpsell" i],',
  'html.sweetcord-lean-mode #app-mount [class*="premiumPromo" i],',
  'html.sweetcord-lean-mode #app-mount [class*="questHome" i],',
  'html.sweetcord-lean-mode #app-mount [class*="shopUpsell" i]',
  '{ display: none !important; }',
  'html.sweetcord-lean-mode #app-mount [class*="backdrop" i],',
  'html.sweetcord-lean-mode #app-mount [class*="blur" i]',
  '{ -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }'
].join("\n");

let leanModeEnabled = true;

function getPreferencesPath() {
  return path.join(app.getPath("userData"), "sweetcord-preferences.json");
}

function loadPreferences() {
  try {
    const file = getPreferencesPath();
    if (!existsSync(file)) return { leanMode: true };
    const raw = JSON.parse(readFileSync(file, "utf8"));
    return { leanMode: raw && typeof raw.leanMode === "boolean" ? raw.leanMode : true };
  } catch {
    return { leanMode: true };
  }
}

function savePreferences() {
  try {
    writeFileSync(getPreferencesPath(), JSON.stringify({ leanMode: leanModeEnabled }, null, 2), { mode: 0o600 });
  } catch {
    // The application remains usable if saving this optional preference fails.
  }
}

function applyLeanMode(window) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
  const enabled = leanModeEnabled;
  const styleId = LEAN_STYLE_ID;
  const css = LEAN_STYLES;
  const script = "(() => {"
    + "const id = " + JSON.stringify(styleId) + ";"
    + "let style = document.getElementById(id);"
    + "if (" + String(enabled) + ") {"
    + "if (!style) { style = document.createElement('style'); style.id = id; (document.head || document.documentElement).appendChild(style); }"
    + "style.textContent = " + JSON.stringify(css) + ";"
    + "document.documentElement.classList.add('sweetcord-lean-mode');"
    + "} else { if (style) style.remove(); document.documentElement.classList.remove('sweetcord-lean-mode'); }"
    + "})();";
  window.webContents.executeJavaScript(script, true).catch(() => {
    // During redirects or early document teardown the next page load will reapply it.
  });
}

function installLeanModeHooks(window) {
  const apply = () => applyLeanMode(window);
  window.webContents.on("dom-ready", apply);
  window.webContents.on("did-finish-load", apply);
  window.webContents.on("did-navigate-in-page", apply);
}

function setLeanMode(enabled) {
  leanModeEnabled = Boolean(enabled);
  savePreferences();
  makeMenu();
  applyLeanMode(mainWindow);
}

function makeMenu() {
  const viewMenu = [
    { role: "reload", label: "Reload Discord" },
    { role: "forceReload", label: "Force reload Discord" },
    { type: "separator" },
    { role: "zoomIn", label: "Zoom in" },
    { role: "zoomOut", label: "Zoom out" },
    { role: "resetZoom", label: "Reset zoom" }
  ];

  if (!app.isPackaged) {
    viewMenu.push({ type: "separator" }, { role: "toggleDevTools", label: "Developer tools" });
  }

  const template = [
    {
      label: "SweetCord",
      submenu: [
        {
          label: "Open Discord",
          accelerator: "CmdOrCtrl+Shift+D",
          click: () => mainWindow?.loadURL(DISCORD_START_URL)
        },
        {
          label: "Sign out of Discord…",
          accelerator: "CmdOrCtrl+Shift+L",
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showMessageBox(mainWindow, {
              type: "warning",
              title: "Sign out of Discord",
              message: "Open Discord's sign-out page in SweetCord?",
              detail: "This uses Discord's own sign-out flow. SweetCord does not read or export your account token.",
              buttons: ["Cancel", "Sign out"],
              defaultId: 1,
              cancelId: 0,
              noLink: true
            });
            if (result.response === 1) {
              await mainWindow.loadURL("https://discord.com/logout");
            }
          }
        },
        { type: "separator" },
        { role: "quit", label: "Exit SweetCord" }
      ]
    },
    { label: "View", submenu: viewMenu },
    {
      label: "Performance",
      submenu: [
        {
          type: "checkbox",
          label: "Lean interface (hide promos, reduce effects)",
          checked: leanModeEnabled,
          click: (item) => setLeanMode(item.checked)
        },
        {
          label: "Reload to apply interface changes",
          click: () => mainWindow?.reload()
        }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Open Discord website",
          click: () => void openExternalIfSafe("https://discord.com")
        },
        {
          label: "SweetCord source code",
          click: () => void openExternalIfSafe("https://github.com/64r3al/SweetCord")
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function getBrowserUserAgent() {
  const chromeMajor = String(process.versions.chrome || "0").split(".")[0] || "0";
  const browserVersion = `AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`;
  const platform = process.platform;

  if (platform === "darwin") {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${browserVersion}`;
  }
  if (platform === "linux") {
    return `Mozilla/5.0 (X11; Linux x86_64) ${browserVersion}`;
  }
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${browserVersion}`;
}

function installDiscordPermissions(discordSession) {
  const isDiscordOrigin = (origin) => {
    const parsed = parseUrl(origin);
    return Boolean(parsed && parsed.protocol === "https:" && isDiscordHost(parsed.hostname));
  };

  discordSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details && details.securityOrigin;
    const allowed = ALLOWED_PERMISSION_NAMES.has(permission) && isDiscordOrigin(origin);
    callback(allowed);
  });

  discordSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    return ALLOWED_PERMISSION_NAMES.has(permission) && isDiscordOrigin(requestingOrigin);
  });
}

function createMainWindow(discordSession) {
  const window = new BrowserWindow({
    title: "SweetCord",
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 520,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#111318",
    webPreferences: {
      session: discordSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      spellcheck: true,
      backgroundThrottling: true
    }
  });

  mainWindow = window;
  window.setMenuBarVisibility(false);

  // Use Electron's Chromium major version but a normal browser UA, matching
  // the compatibility approach used by existing Discord web-app wrappers.
  const browserUserAgent = getBrowserUserAgent();
  discordSession.setUserAgent(browserUserAgent);
  window.webContents.setUserAgent(browserUserAgent);

  window.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle("SweetCord");
  });

  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });

  attachNavigationPolicy(window);
  installLeanModeHooks(window);

  window.webContents.on("did-fail-load", async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || networkErrorPromptOpen || window.isDestroyed()) return;
    networkErrorPromptOpen = true;
    try {
      const result = await dialog.showMessageBox(window, {
        type: "error",
        title: "Couldn't connect to Discord",
        message: "SweetCord couldn't load Discord.",
        detail: "Check your internet connection, then retry. SweetCord uses Discord's own web app for sign-in, messages, servers, and calls.",
        buttons: ["Retry", "Close"],
        defaultId: 0,
        cancelId: 1,
        noLink: true
      });
      if (result.response === 0 && !window.isDestroyed()) {
        await window.loadURL(DISCORD_START_URL);
      } else if (!window.isDestroyed()) {
        window.close();
      }
    } finally {
      networkErrorPromptOpen = false;
    }
  });

  void window.loadURL(DISCORD_START_URL);
  return window;
}

app.whenReady().then(() => {
  leanModeEnabled = loadPreferences().leanMode;

  // Discord's website owns authentication and session data. The persistent
  // partition keeps its normal web session between launches; no token field
  // or token-export API is added by SweetCord.
  const discordSession = session.fromPartition("persist:sweetcord-discord");
  installDiscordPermissions(discordSession);
  makeMenu();
  createMainWindow(discordSession);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(discordSession);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
