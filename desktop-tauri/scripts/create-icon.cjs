"use strict";

const fs = require("node:fs");
const path = require("node:path");

const embeddedIconBase64 = "AAABAAEAICAAAAAAIADVAAAAFgAAAIlQTkcNChoKAAAADUlIRFIAAAAgAAAAIAgGAAAAc3p69AAAAJxJREFUeJztl8ENgCAQBA9iBfq0BQqgE0qgJkqwEwqgE0qgH32YS04ixAeePna/EHZu78OaeVl3+lBT66D4ONTI5fQMgI192YYC8Ls1iJErKD4ON66VXbhAWE1zojNZuV7buasiS6Q3PUum8I8EAAAAAAAAAAAAAAAA4HKi7IKaqfya/yMBIr0U6mJi6nL6VjXj4brV7A5klFrltAmgpQNVtzajV+diEQAAAABJREFUeJgg==";
const iconPath = path.join(__dirname, "..", "src-tauri", "icons", "icon.ico");
const sourceBytes = Buffer.from(embeddedIconBase64, "base64");
const pngOffsetInSource = 22;
const png = sourceBytes.subarray(pngOffsetInSource);

function readUInt32BE(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function validatePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error("Embedded icon image is not a complete PNG.");
  }

  let offset = 8;
  let sawHeader = false;
  let sawEnd = false;
  while (offset + 12 <= buffer.length) {
    const length = readUInt32BE(buffer, offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > buffer.length) {
      throw new Error("Embedded PNG contains a truncated chunk: " + type);
    }
    if (type === "IHDR") {
      if (sawHeader || offset !== 8 || length !== 13) {
        throw new Error("Embedded PNG has an invalid IHDR chunk.");
      }
      const width = readUInt32BE(buffer, offset + 8);
      const height = readUInt32BE(buffer, offset + 12);
      if (width !== 32 || height !== 32) {
        throw new Error("Expected a 32x32 icon PNG, got " + width + "x" + height + ".");
      }
      sawHeader = true;
    }
    offset = end;
    if (type === "IEND") {
      if (length !== 0 || offset !== buffer.length) {
        throw new Error("Embedded PNG has invalid trailing data.");
      }
      sawEnd = true;
      break;
    }
  }
  if (!sawHeader || !sawEnd) {
    throw new Error("Embedded PNG is missing a valid IHDR or IEND chunk.");
  }
}

function buildIco(pngBytes) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon resource
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(32, 6); // width
  header.writeUInt8(32, 7); // height
  header.writeUInt8(0, 8); // palette colors: 0 = no palette
  header.writeUInt8(0, 9); // reserved
  header.writeUInt16LE(1, 10); // color planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(pngBytes.length, 14); // exact image data size
  header.writeUInt32LE(header.length, 18); // image starts immediately after header
  return Buffer.concat([header, pngBytes]);
}

validatePng(png);
const iconBytes = buildIco(png);
if (iconBytes.readUInt16LE(0) !== 0 || iconBytes.readUInt16LE(2) !== 1 || iconBytes.readUInt16LE(4) !== 1) {
  throw new Error("Generated SweetCord icon has an invalid ICO header.");
}
if (iconBytes.readUInt32LE(14) !== png.length || iconBytes.readUInt32LE(18) !== 22) {
  throw new Error("Generated SweetCord icon directory entry has invalid offsets.");
}
fs.mkdirSync(path.dirname(iconPath), { recursive: true });
fs.writeFileSync(iconPath, iconBytes);
console.log("Generated validated 32x32 SweetCord ICO: " + iconPath + " (" + iconBytes.length + " bytes).");
