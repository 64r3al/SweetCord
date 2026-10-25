"use strict";

const DISCORD_HOSTS = ["discord.com", "discord.gg", "discordapp.com", "discordapp.net"];
const ALLOWED_NON_MEDIA_PERMISSIONS = new Set(["notifications", "fullscreen"]);

function isDiscordHttpsOrigin(rawOrigin) {
  if (typeof rawOrigin !== "string" || !rawOrigin) return false;
  try {
    const origin = new URL(rawOrigin);
    if (origin.protocol !== "https:") return false;
    const host = origin.hostname.toLowerCase();
    return DISCORD_HOSTS.some((domain) => host === domain || host.endsWith("." + domain));
  } catch {
    return false;
  }
}

function isPermissionRequestAllowed(permission, origin, details = {}) {
  if (!isDiscordHttpsOrigin(origin)) return false;
  if (permission === "media") {
    const mediaTypes = Array.isArray(details.mediaTypes)
      ? details.mediaTypes.map((type) => String(type).toLowerCase())
      : [];
    // Allow microphone-only capture. Mixed/unknown requests fail closed.
    return mediaTypes.length > 0 && mediaTypes.every((type) => type === "audio");
  }
  return ALLOWED_NON_MEDIA_PERMISSIONS.has(permission);
}

function isPermissionCheckAllowed(permission, origin, details = {}) {
  if (!isDiscordHttpsOrigin(origin)) return false;
  if (permission === "media") return details.mediaType === "audio";
  return ALLOWED_NON_MEDIA_PERMISSIONS.has(permission);
}

module.exports = { isDiscordHttpsOrigin, isPermissionRequestAllowed, isPermissionCheckAllowed };
