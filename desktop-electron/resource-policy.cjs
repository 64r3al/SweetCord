"use strict";

const VISUAL_MEDIA_EXTENSIONS = new Set([
  ".gif", ".gifv", ".mp4", ".m4v", ".mov", ".webm", ".ogv", ".avi", ".mkv", ".3gp", ".m3u8", ".mpd"
]);
const DISCORD_HOSTS = ["discord.com", "discord.gg", "discordapp.com", "discordapp.net"];
const AUTH_PATH = /^\/(login|register|oauth2|verify|email-verification|reset-password|logout)(\/|$)/i;

function hostMatches(hostname, candidates) {
  const normalized = String(hostname || "").toLowerCase();
  return candidates.some((domain) => normalized === domain || normalized.endsWith("." + domain));
}

function isLikelyVisualMediaAsset(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl) return false;
  try {
    const pathname = new URL(rawUrl).pathname.toLowerCase();
    const dot = pathname.lastIndexOf(".");
    return dot >= 0 && VISUAL_MEDIA_EXTENSIONS.has(pathname.slice(dot));
  } catch {
    return false;
  }
}

/**
 * Block images and clearly identifiable video/GIF assets in the main Discord window.
 * Generic media URLs fail open because they can be audio-call related.
 */
function shouldBlockHeavyResource(details, options = {}) {
  if (options.enabled !== true || !Number.isInteger(options.mainWebContentsId)) return false;
  if (!details || details.webContentsId !== options.mainWebContentsId) return false;
  const type = String(details.resourceType || "").toLowerCase();
  if (type !== "image" && !(type === "media" && isLikelyVisualMediaAsset(details.url))) return false;

  try {
    const activeUrl = new URL(options.currentUrl);
    if (activeUrl.protocol !== "https:" || !hostMatches(activeUrl.hostname, DISCORD_HOSTS)) return false;
    if (AUTH_PATH.test(activeUrl.pathname)) return false;
  } catch {
    return false;
  }
  return true;
}

module.exports = { shouldBlockHeavyResource, isLikelyVisualMediaAsset };
