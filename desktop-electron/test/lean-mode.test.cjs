"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildLeanModeScript } = require("../lean-mode.cjs");

const defaults = {
  leanMode: true,
  reduceMotion: true,
  hideProfileDecorations: true,
  staticAnimatedAvatars: true,
  textOnlyMode: true
};

test("generated browser injection is valid JavaScript", () => {
  const source = buildLeanModeScript(defaults);
  assert.doesNotThrow(() => new Function(source));
});

test("all performance preferences are represented in the generated injection", () => {
  const source = buildLeanModeScript(defaults);
  assert.match(source, /sweetcord-lean-mode/);
  assert.match(source, /sweetcord-reduced-motion/);
  assert.match(source, /sweetcord-trim-profile-decorations/);
  assert.match(source, /sweetcord-text-only-mode/);
  assert.match(source, /staticAnimatedAvatars/);
  assert.match(source, /"textOnlyMode":true/);
});

test("avatar processing is batched and avoids repeat full-document scans", () => {
  const source = buildLeanModeScript(defaults);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /previousStaticState !== cfg\.staticAnimatedAvatars/);
  assert.match(source, /attributeFilter: \["src"\]/);
  assert.match(source, /getElementById\("app-mount"\) \|\| document/);
  assert.match(source, /isCoveredByQueuedNode/);
});

test("overlapping queued DOM subtrees are processed only from outermost nodes", () => {
  const source = buildLeanModeScript(defaults);
  assert.match(source, /coveredByQueuedAncestor/);
  assert.match(source, /pendingNodes\.has\(parent\)/);
});
test("disabling static avatars generates a reversible configuration", () => {
  const source = buildLeanModeScript({ ...defaults, staticAnimatedAvatars: false, textOnlyMode: false });
  assert.match(source, /"staticAnimatedAvatars":false/);
  assert.match(source, /"textOnlyMode":false/);
  assert.match(source, /data-sweetcord-original-src/);
  assert.match(source, /data-sweetcord-static-src/);
  assert.match(source, /data-sweetcord-static-failed-src/);
});


test("Ultra-Lite hides visual media and leaves voice UI available", () => {
  const source = buildLeanModeScript(defaults);
  assert.match(source, /#app-mount img/);
  assert.ok(source.includes("gif"));
  assert.ok(source.includes("sticker"));
  assert.ok(source.includes("embed"));
  assert.ok(source.includes("sweetcord-voice-only-mode"));
  assert.ok(!source.includes("text-only-mode #app-mount audio"));
  assert.ok(!source.includes('text-only-mode #app-mount [class*="voice" i]'));
  assert.ok(source.indexOf("if (cfg.textOnlyMode)") < source.indexOf("const avatarSelector"));
});

test("Ultra-Lite includes a dynamic navigation-pruning policy", () => {
  const source = buildLeanModeScript(defaults);
  assert.match(source, /chromeRoutePrefixes/);
  assert.match(source, /data-sweetcord-hidden/);
  assert.match(source, /__sweetCordChromePruneObserverInstalled/);
  assert.ok(source.includes("/quests"));
  assert.ok(source.includes("/shop"));
});

test("lightweight style includes additional profile decoration selectors", () => {
  const source = buildLeanModeScript(defaults);
  assert.match(source, /profileBadge/);
  assert.match(source, /userProfileBadge/);
  assert.match(source, /badgeContainer/);
});

test("video and screen-share controls are hidden even with image mode off", () => {
  const source = buildLeanModeScript({ ...defaults, textOnlyMode: false });
  assert.ok(source.includes("sweetcord-voice-only-mode #app-mount video"));
  assert.ok(source.includes("screenShare"));
});

test("missing preferences safely default to disabled values", () => {
  const source = buildLeanModeScript({});
  assert.doesNotThrow(() => new Function(source));
  assert.match(source, /"leanMode":false/);
  assert.match(source, /"reduceMotion":false/);
  assert.match(source, /"hideProfileDecorations":false/);
  assert.match(source, /"staticAnimatedAvatars":false/);
  assert.match(source, /"textOnlyMode":false/);
});
