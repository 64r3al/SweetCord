"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PERFORMANCE_PROFILES,
  DEFAULT_PREFERENCES,
  normalizePreferences,
  resolvePerformanceSettings,
  settingsForProfile
} = require("../performance-policy.cjs");

test("new installations default to Extreme Lite", () => {
  assert.equal(DEFAULT_PREFERENCES.performanceProfile, PERFORMANCE_PROFILES.EXTREME_LITE);
  assert.equal(resolvePerformanceSettings({}).textOnlyMode, true);
  assert.equal(resolvePerformanceSettings({}).reduceMotion, true);
});

test("Balanced keeps static imagery while retaining lightweight UI defaults", () => {
  const settings = resolvePerformanceSettings({ performanceProfile: "balanced" });
  assert.equal(settings.textOnlyMode, false);
  assert.equal(settings.reduceMotion, true);
  assert.equal(settings.hideProfileDecorations, true);
  assert.equal(settings.staticAnimatedAvatars, true);
});

test("Custom reflects each saved Boolean preference", () => {
  const settings = resolvePerformanceSettings({
    performanceProfile: "custom",
    textOnlyMode: false,
    reduceMotion: false,
    hideProfileDecorations: true,
    staticAnimatedAvatars: false,
    leanMode: false
  });
  assert.deepEqual(settings, {
    leanMode: false,
    reduceMotion: false,
    hideProfileDecorations: true,
    staticAnimatedAvatars: false,
    textOnlyMode: false
  });
});

test("unknown profile names normalize safely and do not override an explicit legacy text setting", () => {
  assert.equal(normalizePreferences({ performanceProfile: "unknown" }).performanceProfile, "extreme-lite");
  assert.equal(normalizePreferences({ textOnlyMode: false }).performanceProfile, "custom");
  assert.equal(resolvePerformanceSettings({ textOnlyMode: false }).textOnlyMode, false);
});

test("selecting a preset returns explicit values; Custom intentionally preserves current settings", () => {
  assert.equal(settingsForProfile("extreme-lite").textOnlyMode, true);
  assert.equal(settingsForProfile("balanced").textOnlyMode, false);
  assert.equal(settingsForProfile("custom"), null);
  assert.equal(settingsForProfile("unknown"), null);
});
