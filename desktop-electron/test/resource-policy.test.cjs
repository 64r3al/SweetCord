"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldBlockHeavyResource } = require("../resource-policy.cjs");

const options = {
  enabled: true,
  mainWebContentsId: 12,
  currentUrl: "https://discord.com/channels/@me"
};

test("text-only mode blocks image requests from the main Discord window", () => {
  assert.equal(shouldBlockHeavyResource({ webContentsId: 12, resourceType: "image" }, options), true);
});

test("text-only mode blocks media requests from the main Discord window", () => {
  assert.equal(shouldBlockHeavyResource({ webContentsId: 12, resourceType: "media" }, options), true);
});

test("text-only mode leaves scripts, XHR, and other essential request types alone", () => {
  for (const resourceType of ["script", "stylesheet", "xhr", "fetch", "font", "mainFrame"]) {
    assert.equal(shouldBlockHeavyResource({ webContentsId: 12, resourceType }, options), false, resourceType);
  }
});

test("text-only mode does not block resources from sign-in popups or other WebContents", () => {
  assert.equal(shouldBlockHeavyResource({ webContentsId: 99, resourceType: "image" }, options), false);
});

test("text-only mode does not block images on OAuth or non-Discord pages", () => {
  assert.equal(shouldBlockHeavyResource(
    { webContentsId: 12, resourceType: "image" },
    { ...options, currentUrl: "https://accounts.google.com/" }
  ), false);
  assert.equal(shouldBlockHeavyResource(
    { webContentsId: 12, resourceType: "image" },
    { ...options, currentUrl: "https://discord.com/login" }
  ), false);
});

test("turning text-only mode off allows image and media requests again", () => {
  assert.equal(shouldBlockHeavyResource(
    { webContentsId: 12, resourceType: "image" },
    { ...options, enabled: false }
  ), false);
});

test("missing request metadata fails open", () => {
  assert.equal(shouldBlockHeavyResource({}, options), false);
  assert.equal(shouldBlockHeavyResource({ webContentsId: 12, resourceType: "image" }, {
    enabled: true,
    mainWebContentsId: 12
  }), false);
});
