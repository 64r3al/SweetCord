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
  const source = buildLeanModeScript({ ...defaults, staticAnimatedAvatars: false });
  assert.match(source, /"staticAnimatedAvatars":false/);
  assert.match(source, /"textOnlyMode":true/);
  assert.match(source, /data-sweetcord-original-src/);
  assert.match(source, /data-sweetcord-static-src/);
  assert.match(source, /data-sweetcord-static-failed-src/);
});


test("text-only mode hides high-cost media and exits before avatar observer setup", () => {
  const source = buildLeanModeScript(defaults);
  assert.match(source, /#app-mount img/);
  assert.ok(source.includes("gif"));
  assert.ok(source.includes("sticker"));
  assert.ok(source.includes("embed"));
  assert.ok(source.indexOf("if (cfg.textOnlyMode)") < source.indexOf("const avatarSelector"));
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
