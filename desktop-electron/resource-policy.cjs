"use strict";

const VISUAL_MEDIA_EXTENSIONS = new Set([
  ".gif", ".gifv", ".mp4", ".m4v", ".mov", ".webm", ".ogv", ".avi", ".mkv", ".3gp", ".m3u8", ".mpd"
]);
const ANIMATED_IMAGE_EXTENSIONS = new Set([".gif", ".gifv", ".apng"]);
const DISCORD_HOSTS = ["discord.com", "discord.gg", "discordapp.com", "discordapp.net"];
const AUTH_PATH = /^\/(login|register|oauth2|verify|email-verification|reset-password|logout)(\/|$)/i;

function hostMatches(hostname, candidates) {
  const normalized = String(hostname || "").toLowerCase();
  return candidates.some((domain) => normalized === domain || normalized.endsWith("." + domain));
}

function getPathExtension(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl) return "";
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    const dot = pathname.lastIndexOf(".");
    return dot >= 0 ? pathname.slice(dot) : "";
  } catch {
    return "";
  }
}

function isLikelyVisualMediaAsset(rawUrl) {
  return VISUAL_MEDIA_EXTENSIONS.has(getPathExtension(rawUrl));
}

function isLikelyAnimatedVisualAsset(rawUrl) {
  return ANIMATED_IMAGE_EXTENSIONS.has(getPathExtension(rawUrl));
}

/**
 * Extreme Lite blocks all images plus clearly identifiable video/GIF media.
 * Balanced keeps still images but blocks obvious animated-image/video assets.
 * Unknown or malformed media URLs fail open so audio-call traffic is not guessed at.
 */
function shouldBlockHeavyResource(details, options = {}) {
  if (!Number.isInteger(options.mainWebContentsId)) return false;
  if (!details || details.webContentsId !== options.mainWebContentsId) return false;

  const profile = options.profile || (options.enabled === true ? "extreme-lite" : "custom");
  if (profile !== "balanced" && options.enabled !== true) return false;

  const type = String(details.resourceType || "").toLowerCase();
  if (type !== "image" && type !== "media") return false;

  try {
    const activeUrl = new URL(options.currentUrl);
    if (activeUrl.protocol !== "https:" || !hostMatches(activeUrl.hostname, DISCORD_HOSTS)) return false;
    if (AUTH_PATH.test(activeUrl.pathname)) return false;
  } catch {
    return false;
  }

  if (type === "image") {
    if (profile === "balanced") return isLikelyAnimatedVisualAsset(details.url);
    return options.enabled === true;
  }

  return isLikelyVisualMediaAsset(details.url);
}

const ANIMATED_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/apng",
  "image/vnd.mozilla.apng",
  "image/x-apng"
]);
const VISUAL_MEDIA_MIME_TYPES = new Set([
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "application/dash+xml"
]);

function getResponseContentType(responseHeaders) {
  if (!responseHeaders || typeof responseHeaders !== "object") return "";
  const entry = Object.entries(responseHeaders).find(([name]) => name.toLowerCase() === "content-type");
  if (!entry) return "";
  const value = Array.isArray(entry[1]) ? entry[1][0] : entry[1];
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

/**
 * Header-level fallback for visual assets whose URLs do not expose a file extension.
 * It cancels video MIME responses before their response body is delivered, while
 * explicitly allowing audio MIME responses so microphone voice calls are not blocked.
 */
function shouldBlockHeavyResponse(details, options = {}) {
  if (!Number.isInteger(options.mainWebContentsId)) return false;
  if (!details || details.webContentsId !== options.mainWebContentsId) return false;

  const profile = options.profile || (options.enabled === true ? "extreme-lite" : "custom");
  if (profile !== "balanced" && options.enabled !== true) return false;

  const type = String(details.resourceType || "").toLowerCase();
  if (type !== "image" && type !== "media") return false;

  try {
    const activeUrl = new URL(options.currentUrl);
    if (activeUrl.protocol !== "https:" || !hostMatches(activeUrl.hostname, DISCORD_HOSTS)) return false;
    if (AUTH_PATH.test(activeUrl.pathname)) return false;
  } catch {
    return false;
  }

  const contentType = getResponseContentType(details.responseHeaders);
  if (!contentType) return false;

  if (type === "image") {
    if (profile === "balanced") return ANIMATED_IMAGE_MIME_TYPES.has(contentType);
    return options.enabled === true && contentType.startsWith("image/");
  }

  // Never cancel audio/* responses. Video and known HLS/DASH playlist types are visual.
  return contentType.startsWith("video/") || VISUAL_MEDIA_MIME_TYPES.has(contentType);
}

module.exports = {
  shouldBlockHeavyResource,
  shouldBlockHeavyResponse,
  getResponseContentType,
  isLikelyVisualMediaAsset,
  isLikelyAnimatedVisualAsset
};
