"use strict";

const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  session,
  shell
} = require("electron");
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
