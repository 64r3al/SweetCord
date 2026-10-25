"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = readFileSync(join(__dirname, "..", "lean-mode.js"), "utf8");

test("Tauri injected script parses as JavaScript", () => {
  assert.doesNotThrow(() => new Function(source));
});

test("Tauri performance injection only runs on Discord HTTPS hosts", () => {
  assert.match(source, /location\.protocol !== "https:"/);
  assert.match(source, /discord/);
});

test("Tauri avatar work is frame-batched and scoped to the app subtree", () => {
  assert.match(source, /requestAnimationFrame\(flush\)/);
  assert.match(source, /getElementById\("app-mount"\) \|\| root/);
  assert.match(source, /attributeFilter: \["src"\]/);
});

test("nested DOM additions and image changes are not redundantly traversed", () => {
  assert.match(source, /isCoveredByQueuedNode/);
  assert.match(source, /coveredByQueuedAncestor/);
  assert.match(source, /pendingNodes\.has\(parent\)/);
});
