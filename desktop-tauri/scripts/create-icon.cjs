"use strict";

// Creates a small SweetCord-branded ICO before Tauri's Windows resource compiler runs.
// Binary icon files are generated locally so source edits remain reviewable as text.
const fs = require("node:fs");
const path = require("node:path");

const iconBase64 = "AAABAAEAICAAAAAAIADVAAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAgAAAAIAgGAAAAc3p69AAAAJxJREFUeJztl8ENgCAQBA9iBfq0BQqgE0qgJkqwEwqgE0qgH32YS04ixAeePna/EHZu78OaeVl3+lBT66D4ONTI5fQMgI192YYC8Ls1iJErKD4ON66VXbhAWE1zojNZuV7buasiS6Q3PUum8I8EAAAAAAAAAAAAAAAA4HKi7IKaqfya/yMBIr0U6mJi6nL6VjXj4brV7A5klFrltAmgpQNVtzajV+diEQAAAABJRU5ErkJggg==";
const iconPath = path.join(__dirname, "..", "src-tauri", "icons", "icon.ico");
const iconBytes = Buffer.from(iconBase64, "base64");

if (iconBytes.length < 64 || iconBytes.readUInt16LE(0) !== 0 || iconBytes.readUInt16LE(2) !== 1) {
  throw new Error("Generated SweetCord icon is not a valid ICO file.");
}

fs.mkdirSync(path.dirname(iconPath), { recursive: true });
fs.writeFileSync(iconPath, iconBytes);
console.log(`Generated SweetCord icon: ${iconPath} (${iconBytes.length} bytes)`);
