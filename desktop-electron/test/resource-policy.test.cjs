"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { shouldBlockHeavyResource, isLikelyVisualMediaAsset } = require("../resource-policy.cjs");
const options = { enabled: true, mainWebContentsId: 12, currentUrl: "https://discord.com/channels/@me" };

test("Ultra-Lite blocks images from the main Discord window", () => {
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/avatars/1/a.png"},options),true);
});
test("Ultra-Lite blocks clearly identified visual media", () => {
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url:"https://cdn.discordapp.com/clip.mp4?q=1"},options),true);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url:"https://cdn.discordapp.com/clip.webm"},options),true);
});
test("ambiguous media and audio assets are allowed to protect voice calls", () => {
  for (const url of ["https://cdn.discordapp.com/voice.ogg","https://media.discordapp.net/track","https://discord.com/api/voice"]) {
    assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url},options),false,url);
  }
  assert.equal(isLikelyVisualMediaAsset("https://cdn.discordapp.com/voice.ogg"),false);
  assert.equal(isLikelyVisualMediaAsset("https://cdn.discordapp.com/clip.mp4?token=x"),true);
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
test("disabling Ultra-Lite allows images and video again", () => {
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image",url:"https://cdn.discordapp.com/image.png"},{...options,enabled:false}),false);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media",url:"https://cdn.discordapp.com/clip.mp4"},{...options,enabled:false}),false);
});
test("malformed metadata fails open", () => {
  assert.equal(shouldBlockHeavyResource({},options),false);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"image"},{enabled:true,mainWebContentsId:12}),false);
  assert.equal(shouldBlockHeavyResource({webContentsId:12,resourceType:"media"},options),false);
});
