"use strict";

const PERFORMANCE_PROFILES = Object.freeze({
  EXTREME_LITE: "extreme-lite",
  BALANCED: "balanced",
  CUSTOM: "custom"
});
const VALID_PROFILES = new Set(Object.values(PERFORMANCE_PROFILES));
const BOOLEAN_DEFAULTS = Object.freeze({
  leanMode: true,
  reduceMotion: true,
  hideProfileDecorations: true,
  staticAnimatedAvatars: true,
  textOnlyMode: true
});
const DEFAULT_PREFERENCES = Object.freeze({
  performanceProfile: PERFORMANCE_PROFILES.EXTREME_LITE,
  ...BOOLEAN_DEFAULTS
});

function normalizePreferences(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const result = { ...DEFAULT_PREFERENCES };
  for (const [key, fallback] of Object.entries(BOOLEAN_DEFAULTS)) {
    result[key] = typeof source[key] === "boolean" ? source[key] : fallback;
  }

  if (typeof source.performanceProfile === "string" && VALID_PROFILES.has(source.performanceProfile)) {
    result.performanceProfile = source.performanceProfile;
  } else if (Object.hasOwn(source, "textOnlyMode") && source.textOnlyMode === false) {
    // Preserve an older installation's explicit choice to show images.
    result.performanceProfile = PERFORMANCE_PROFILES.CUSTOM;
  } else {
    result.performanceProfile = PERFORMANCE_PROFILES.EXTREME_LITE;
  }
  return result;
}

function resolvePerformanceSettings(raw) {
  const preferences = normalizePreferences(raw);
  if (preferences.performanceProfile === PERFORMANCE_PROFILES.EXTREME_LITE) {
    return { ...BOOLEAN_DEFAULTS };
  }
  if (preferences.performanceProfile === PERFORMANCE_PROFILES.BALANCED) {
    return {
      leanMode: true,
      reduceMotion: true,
      hideProfileDecorations: true,
      staticAnimatedAvatars: true,
      textOnlyMode: false
    };
  }
  return {
    leanMode: preferences.leanMode,
    reduceMotion: preferences.reduceMotion,
    hideProfileDecorations: preferences.hideProfileDecorations,
    staticAnimatedAvatars: preferences.staticAnimatedAvatars,
    textOnlyMode: preferences.textOnlyMode
  };
}

function settingsForProfile(profile) {
  if (!VALID_PROFILES.has(profile)) return null;
  if (profile === PERFORMANCE_PROFILES.EXTREME_LITE) {
    return { ...BOOLEAN_DEFAULTS };
  }
  if (profile === PERFORMANCE_PROFILES.BALANCED) {
    return {
      leanMode: true,
      reduceMotion: true,
      hideProfileDecorations: true,
      staticAnimatedAvatars: true,
      textOnlyMode: false
    };
  }
  return null;
}

module.exports = {
  PERFORMANCE_PROFILES,
  BOOLEAN_DEFAULTS,
  DEFAULT_PREFERENCES,
  normalizePreferences,
  resolvePerformanceSettings,
  settingsForProfile
};
