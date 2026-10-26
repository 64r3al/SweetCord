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
const { buildLeanModeScript } = require("./lean-mode.cjs");
const { shouldBlockHeavyResource, shouldBlockHeavyResponse } = require("./resource-policy.cjs");
const { isPermissionRequestAllowed, isPermissionCheckAllowed } = require("./permission-policy.cjs");
const {
  DEFAULT_PREFERENCES,
  BOOLEAN_DEFAULTS,
  normalizePreferences,
  resolvePerformanceSettings,
  settingsForProfile
} = require("./performance-policy.cjs");
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

let preferences = { ...DEFAULT_PREFERENCES };
let performanceProfile = DEFAULT_PREFERENCES.performanceProfile;
let leanModeEnabled = DEFAULT_PREFERENCES.leanMode;
let reduceMotionEnabled = DEFAULT_PREFERENCES.reduceMotion;
let hideProfileDecorationsEnabled = DEFAULT_PREFERENCES.hideProfileDecorations;
let staticAnimatedAvatarsEnabled = DEFAULT_PREFERENCES.staticAnimatedAvatars;
let textOnlyModeEnabled = DEFAULT_PREFERENCES.textOnlyMode;

function syncPreferenceState() {
  preferences = normalizePreferences(preferences);
  performanceProfile = preferences.performanceProfile;
  const effective = resolvePerformanceSettings(preferences);
  leanModeEnabled = effective.leanMode;
  reduceMotionEnabled = effective.reduceMotion;
  hideProfileDecorationsEnabled = effective.hideProfileDecorations;
  staticAnimatedAvatarsEnabled = effective.staticAnimatedAvatars;
  textOnlyModeEnabled = effective.textOnlyMode;
}

function getPreferencesPath() {
  return path.join(app.getPath("userData"), "sweetcord-preferences.json");
}

function loadPreferences() {
  try {
    const file = getPreferencesPath();
    if (!existsSync(file)) return { ...DEFAULT_PREFERENCES };
    return normalizePreferences(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences() {
  try {
    writeFileSync(getPreferencesPath(), JSON.stringify(preferences, null, 2), { mode: 0o600 });
  } catch {
    // The app stays usable when optional local settings cannot be saved.
  }
}

function applyLeanMode(window) {
  if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;

  const settings = {
    leanMode: leanModeEnabled,
    reduceMotion: reduceMotionEnabled,
    hideProfileDecorations: hideProfileDecorationsEnabled,
    staticAnimatedAvatars: staticAnimatedAvatarsEnabled,
    textOnlyMode: textOnlyModeEnabled
  };
  const script = buildLeanModeScript(settings);

  window.webContents.executeJavaScript(script, true).catch(() => {
    // Navigation may destroy the document during injection; the next load applies it again.
  });
}

function installLeanModeHooks(window) {
  // Apply once per loaded document. Discord SPA route changes keep the document alive,
  // and the MutationObserver handles new UI; preference changes call applyLeanMode directly.
  window.webContents.on("dom-ready", () => applyLeanMode(window));
}

function setPreference(name, enabled) {
  const key = String(name);
  if (!Object.prototype.hasOwnProperty.call(BOOLEAN_DEFAULTS, key)) return;

  // Start from the currently active profile, so the first manual adjustment
  // creates a Custom profile with no surprise changes to other settings.
  const current = resolvePerformanceSettings(preferences);
  preferences = normalizePreferences({
    ...preferences,
    ...current,
    [key]: Boolean(enabled),
    performanceProfile: "custom"
  });
  syncPreferenceState();
  savePreferences();
  makeMenu();
  applyLeanMode(mainWindow);

  // Resource filtering is installed at the session level. Reload after changing
  // this flag so already-cached images and video are reconciled with the policy.
  if (key === "textOnlyMode" && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.reload();
  }
}

function setPerformanceProfile(profile) {
  if (!["extreme-lite", "balanced", "custom"].includes(profile)) return;

  const selectedSettings = profile === "custom"
    ? resolvePerformanceSettings(preferences)
    : settingsForProfile(profile);
  if (!selectedSettings) return;

  preferences = normalizePreferences({
    ...preferences,
    ...selectedSettings,
    performanceProfile: profile
  });
  syncPreferenceState();
  savePreferences();
  makeMenu();
  applyLeanMode(mainWindow);

  // Image/video interception happens before content reaches the DOM; a reload is
  // needed when switching a whole profile, but not for ordinary CSS preferences.
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload();
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
          type: "radio",
          label: "Extreme Lite — block all images + recognized video",
          checked: performanceProfile === "extreme-lite",
          click: () => setPerformanceProfile("extreme-lite")
        },
        {
          type: "radio",
          label: "Balanced — allow still images, block obvious GIF/video",
          checked: performanceProfile === "balanced",
          click: () => setPerformanceProfile("balanced")
        },
        {
          type: "radio",
          label: "Custom — use individual settings",
          checked: performanceProfile === "custom",
          click: () => setPerformanceProfile("custom")
        },
        { type: "separator" },
        {
          type: "checkbox",
          label: "Block all images + recognized video (Custom setting)",
          checked: textOnlyModeEnabled,
          click: (item) => setPreference("textOnlyMode", item.checked)
        },
        { type: "separator" },
        {
          type: "checkbox",
          label: "Hide optional promos and navigation",
          accelerator: "CmdOrCtrl+Shift+M",
          checked: leanModeEnabled,
          click: (item) => setPreference("leanMode", item.checked)
        },
        {
          type: "checkbox",
          label: "Disable UI animations and transitions",
          checked: reduceMotionEnabled,
          click: (item) => setPreference("reduceMotion", item.checked)
        },
        {
          type: "checkbox",
          label: "Hide profile banners and decorations",
          checked: hideProfileDecorationsEnabled,
          click: (item) => setPreference("hideProfileDecorations", item.checked)
        },
        {
          type: "checkbox",
          label: "Use still profile avatars",
          checked: staticAnimatedAvatarsEnabled,
          click: (item) => setPreference("staticAnimatedAvatars", item.checked)
        },
        {
          label: "Reload to apply interface changes",
          click: () => mainWindow?.reload()
        },
        { type: "separator" },
        {
          label: "Sample CPU + memory for 5 seconds",
          click: () => { void showMemorySnapshot(); }
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
  discordSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details && details.securityOrigin;
    callback(isPermissionRequestAllowed(permission, origin, details || {}));
  });

  discordSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return isPermissionCheckAllowed(permission, requestingOrigin, details || {});
  });
}

function installTextOnlyResourceBlocking(discordSession) {
  discordSession.webRequest.onBeforeRequest(
    { urls: ["<all_urls>"], types: ["image", "media"] },
    (details, callback) => {
      const cancel = shouldBlockHeavyResource(details, {
        enabled: textOnlyModeEnabled,
        profile: performanceProfile,
        mainWebContentsId: mainWindow?.webContents.id,
        currentUrl: mainWindow?.webContents.getURL()
      });
      callback({ cancel });
    }
  );
}

function installVisualMediaResponseBlocking(discordSession) {
  // URL extensions are not always present on Discord's CDN. Inspect the response
  // MIME type as a second line of defense; do not cancel audio/* responses.
  discordSession.webRequest.onHeadersReceived(
    { urls: ["<all_urls>"], types: ["image", "media"] },
    (details, callback) => {
      const cancel = shouldBlockHeavyResponse(details, {
        enabled: textOnlyModeEnabled,
        profile: performanceProfile,
        mainWebContentsId: mainWindow?.webContents.id,
        currentUrl: mainWindow?.webContents.getURL()
      });
      callback(cancel ? { cancel: true } : {});
    }
  );
}

async function showMemorySnapshot() {
  // app.getAppMetrics() measures CPU between consecutive calls. This five-second
  // sample runs only when the user opens the diagnostic from the menu.
  app.getAppMetrics();
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const metrics = app.getAppMetrics();
  const workingSetMiB = metrics.reduce((sum, metric) => {
    return sum + Number(metric.memory?.workingSetSize || 0) / 1024;
  }, 0);
  const privateMiB = metrics.reduce((sum, metric) => {
    return sum + Number(metric.memory?.privateBytes || 0) / (1024 * 1024);
  }, 0);
  const cpuPercent = metrics.reduce((sum, metric) => {
    return sum + Number(metric.cpu?.percentCPUUsage || 0);
  }, 0);
  const processLines = metrics.map((metric) => {
    const ws = Number(metric.memory?.workingSetSize || 0) / 1024;
    const cpu = Number(metric.cpu?.percentCPUUsage || 0);
    return `${metric.type || "process"} (PID ${metric.pid}): ${ws.toFixed(1)} MiB, ${cpu.toFixed(1)}% CPU`;
  }).join("\n");

  const options = {
    type: "info",
    title: "SweetCord resource snapshot (5 seconds)",
    message: `Working set: ${workingSetMiB.toFixed(1)} MiB · Private memory: ${privateMiB.toFixed(1)} MiB`,
    detail: `Summed process CPU over the sample: ${cpuPercent.toFixed(1)}% (can exceed 100% across cores)\nProcesses sampled: ${metrics.length}\n\n${processLines}\n\nThis is a short diagnostic sample, not a hard RAM cap. GPU utilization and GPU memory must be checked separately in Windows Task Manager.`,
    buttons: ["OK"],
    noLink: true
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    void dialog.showMessageBox(mainWindow, options);
  } else {
    void dialog.showMessageBox(options);
  }
}

function createMainWindow(discordSession) {
  const window = new BrowserWindow({
    title: "SweetCord",
    width: 1120,
    height: 720,
    minWidth: 760,
    minHeight: 500,
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
      spellcheck: false,
      devTools: !app.isPackaged,
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
  preferences = loadPreferences();
  syncPreferenceState();

  // Discord's website owns authentication and session data. The persistent
  // partition keeps its normal web session between launches; no token field
  // or token-export API is added by SweetCord.
  const discordSession = session.fromPartition("persist:sweetcord-discord");
  installDiscordPermissions(discordSession);
  installTextOnlyResourceBlocking(discordSession);
  installVisualMediaResponseBlocking(discordSession);
  makeMenu();
  createMainWindow(discordSession);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(discordSession);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
