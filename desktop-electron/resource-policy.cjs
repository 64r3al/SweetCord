"use strict";

const HEAVY_RESOURCE_TYPES = new Set(["image", "media"]);
const DISCORD_HOSTS = ["discord.com", "discord.gg", "discordapp.com", "discordapp.net"];

function hostMatches(hostname, candidates) {
  const normalized = String(hostname || "").toLowerCase();
  return candidates.some((domain) => normalized === domain || normalized.endsWith("." + domain));
}

/**
 * Decide whether a request is safe to cancel in the main Discord tab.
 *
 * Only image/media requests initiated by the main Discord WebContents are
 * blocked. Authentication popups and non-Discord pages are intentionally
 * excluded. Missing metadata fails open to avoid breaking unrelated requests.
 */
function shouldBlockHeavyResource(details, options = {}) {
  if (options.enabled !== true) return false;
  if (!Number.isInteger(options.mainWebContentsId)) return false;
  if (!details || details.webContentsId !== options.mainWebContentsId) return false;

  const resourceType = String(details.resourceType || "").toLowerCase();
  if (!HEAVY_RESOURCE_TYPES.has(resourceType)) return false;

  try {
    const activeUrl = new URL(options.currentUrl);
    if (activeUrl.protocol !== "https:" || !hostMatches(activeUrl.hostname, DISCORD_HOSTS)) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

module.exports = { shouldBlockHeavyResource };
