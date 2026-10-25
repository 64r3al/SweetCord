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

module.exports = {
  shouldBlockHeavyResource,
  isLikelyVisualMediaAsset,
  isLikelyAnimatedVisualAsset
};
