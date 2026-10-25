"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {isDiscordHttpsOrigin,isPermissionRequestAllowed,isPermissionCheckAllowed}=require("../permission-policy.cjs");
const discord="https://discord.com";

test("only HTTPS Discord origins and genuine subdomains are trusted",()=>{
  assert.equal(isDiscordHttpsOrigin(discord),true);
  assert.equal(isDiscordHttpsOrigin("https://cdn.discord.com"),true);
  assert.equal(isDiscordHttpsOrigin("http://discord.com"),false);
  assert.equal(isDiscordHttpsOrigin("https://discord.com.evil.example"),false);
  assert.equal(isDiscordHttpsOrigin("https://evil-discord.com"),false);
});
test("microphone-only access is allowed from Discord",()=>{
  assert.equal(isPermissionRequestAllowed("media",discord,{mediaTypes:["audio"]}),true);
  assert.equal(isPermissionCheckAllowed("media",discord,{mediaType:"audio"}),true);
});
test("camera, screen capture and mixed or unknown requests are denied",()=>{
  assert.equal(isPermissionRequestAllowed("media",discord,{mediaTypes:["video"]}),false);
  assert.equal(isPermissionRequestAllowed("media",discord,{mediaTypes:["audio","video"]}),false);
  assert.equal(isPermissionCheckAllowed("media",discord,{mediaType:"video"}),false);
  assert.equal(isPermissionCheckAllowed("media",discord,{mediaType:"unknown"}),false);
  assert.equal(isPermissionCheckAllowed("media",discord,{}),false);
  assert.equal(isPermissionRequestAllowed("display-capture",discord,{}),false);
});
test("only supported non-media permissions are permitted",()=>{
  assert.equal(isPermissionRequestAllowed("notifications",discord,{}),true);
  assert.equal(isPermissionRequestAllowed("fullscreen",discord,{}),true);
  assert.equal(isPermissionRequestAllowed("notifications","https://evil.example",{}),false);
});
test("missing or malformed permission context fails closed",()=>{
  assert.equal(isPermissionRequestAllowed("media","",{mediaTypes:["audio"]}),false);
  assert.equal(isPermissionRequestAllowed("media","not a url",{mediaTypes:["audio"]}),false);
  assert.equal(isPermissionCheckAllowed("media",null,{mediaType:"audio"}),false);
});
