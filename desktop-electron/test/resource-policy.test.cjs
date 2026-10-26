"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  shouldBlockHeavyResource,
  shouldBlockHeavyResponse,
  getResponseContentType,
  isLikelyVisualMediaAsset,
  isLikelyAnimatedVisualAsset
} = require("../resource-policy.cjs");
const options = { enabled: true, profile: "extreme-lite", mainWebContentsId: 12, currentUrl: "https://discord.com/channels/@me" };

test("Extreme Lite blocks images from the main Discord window", () => {
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/avatars/1/a.png"},options),true);
});
test("Extreme Lite blocks clearly identified visual media", () => {
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url:"https://cdn.discordapp.com/clip.mp4?q=1"},options),true);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url:"https://cdn.discordapp.com/clip.webm"},options),true);
});
test("Balanced preserves still images while blocking recognizable animation and video", () => {
  const balanced = {...options, enabled: false, profile: "balanced"};
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/avatars/1/a.png"},balanced),false);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/attachments/1/2/reaction.gif?size=128"},balanced),true);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/animation.apng"},balanced),true);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url:"https://cdn.discordapp.com/clip.mp4"},balanced),true);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url:"https://media.discordapp.net/track"},balanced),false);
});
test("ambiguous media and audio assets are allowed to protect voice calls", () => {
  for (const url of ["https://cdn.discordapp.com/voice.ogg","https://media.discordapp.net/track","https://discord.com/api/voice"]) {
    assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url},options),false,url);
  }
  assert.equal(isLikelyVisualMediaAsset("https://cdn.discordapp.com/voice.ogg"),false);
  assert.equal(isLikelyVisualMediaAsset("https://cdn.discordapp.com/clip.mp4?token=x"),true);
  assert.equal(isLikelyAnimatedVisualAsset("https://cdn.discordapp.com/clip.gif?token=x"),true);
  assert.equal(isLikelyAnimatedVisualAsset("https://cdn.discordapp.com/still.png"),false);
});
test("scripts, API calls, stylesheets and fonts are not blocked", () => {
  for(const resourceType of ["script","stylesheet","xhr","fetch","font","mainFrame","other"]) {
    assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType,url:"https://cdn.discordapp.com/image.png"},options),false,resourceType);
  }
});
test("auth popups and login/recovery routes are exempt", () => {
  assert.equal(shouldBlockHeavyResource({webContentsId:99,resourceType:"image",url:"https://cdn.discordapp.com/image.png"},options),false);
  for(const currentUrl of ["https://accounts.google.com/","https://discord.com/login","https://discord.com/logout"]) {
    assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/image.png"},{...options,currentUrl}),false);
  }
});
test("disabling Custom mode allows images and video again", () => {
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/image.png"},{...options,profile:"custom",enabled:false}),false);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url:"https://cdn.discordapp.com/clip.mp4"},{...options,profile:"custom",enabled:false}),false);
});
test("legacy callers without a profile retain Extreme Lite behavior when enabled", () => {
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/image.png"},{enabled:true,mainWebContentsId:12,currentUrl:"https://discord.com/channels/@me"}),true);
});
test("malformed metadata fails open", () => {
  assert.equal(shouldBlockHeavyResource({},options),false);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image"},{enabled:true,mainWebContentsId:12}),false);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media"},options),false);
});


test("MIME fallback blocks extensionless video responses in Extreme Lite and Balanced", () => {
  const extensionlessVideo = {
    webContentsId: 12,
    resourceType: "media",
    url: "https://cdn.discordapp.com/attachments/1/2/clip",
    responseHeaders: { "Content-Type": ["video/mp4; codecs=avc1"] }
  };
  assert.equal(shouldBlockHeavyResponse(extensionlessVideo, options), true);
  assert.equal(shouldBlockHeavyResponse(extensionlessVideo, { ...options, profile: "balanced", enabled: false }), true);
});

test("MIME fallback preserves audio, including extensionless audio streams", () => {
  for (const contentType of ["audio/ogg", "audio/webm", "application/octet-stream"]) {
    assert.equal(shouldBlockHeavyResponse({
      webContentsId: 12,
      resourceType: "media",
      url: "https://cdn.discordapp.com/stream",
      responseHeaders: { "content-type": [contentType] }
    }, options), false, contentType);
  }
});

test("Balanced MIME filtering blocks known animated images but allows still images", () => {
  const balanced = { ...options, profile: "balanced", enabled: false };
  assert.equal(shouldBlockHeavyResponse({
    webContentsId: 12,
    resourceType: "image",
    responseHeaders: { "Content-Type": ["image/gif"] }
  }, balanced), true);
  assert.equal(shouldBlockHeavyResponse({
    webContentsId: 12,
    resourceType: "image",
    responseHeaders: { "Content-Type": ["image/png"] }
  }, balanced), false);
});

test("MIME filtering respects window scope, auth routes and malformed headers", () => {
  const video = { webContentsId: 12, resourceType: "media", responseHeaders: { "Content-Type": ["video/mp4"] } };
  assert.equal(shouldBlockHeavyResponse({ ...video, webContentsId: 99 }, options), false);
  assert.equal(shouldBlockHeavyResponse(video, { ...options, currentUrl: "https://discord.com/login" }), false);
  assert.equal(shouldBlockHeavyResponse({ ...video, responseHeaders: {} }, options), false);
  assert.equal(getResponseContentType({ "CONTENT-TYPE": [" Video/MP4 ; codecs=x"] }), "video/mp4");
});
