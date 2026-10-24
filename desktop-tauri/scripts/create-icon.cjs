"use strict";

const fs = require("node:fs");
const path = require("node:path");

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABDklEQVR42mMUFJb4zzCAgIlhgMGoAwbcASyEFBR6PCdoSP8OSdqEADGWk6KOJAeQaii5jmCipmHk6GNEL4iwGYIvjklVT3IuIGQYJQmQqFxACFitfs5wEl0sGTVUjoVK0qYcsFr9nGJ1TLS2nJB6kh1w685zki3H5wiy0sACQ1T+9BzcCRPdUqvVz1HSBMWJkIGBgSFzCpoDVFATIL4QI6ouQPZRwnn8oUFxNuzfIYlRuCDz0bMcevCjhwZZBRG5hUv/DkkGNRVJyh1AjiPIdTQTNQylpDhmIdVw9GKW0rqA4iYZoUKJkDwjOf0CcktCbBUTEzUMoUQfE7V8Qq56itIAsY7Ap45xtG844h0AANm3YTlgESVxAAAAAElFTkSuQmCC";
const iconPath = path.join(__dirname, "..", "src-tauri", "icons", "icon.ico");
const png = Buffer.from(pngBase64, "base64");

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
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(32, 6);
  header.writeUInt8(32, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(pngBytes.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, pngBytes]);
}

validatePng(png);
const iconBytes = buildIco(png);
if (
  iconBytes.readUInt16LE(0) !== 0 ||
  iconBytes.readUInt16LE(2) !== 1 ||
  iconBytes.readUInt16LE(4) !== 1 ||
  iconBytes.readUInt16LE(10) !== 1 ||
  iconBytes.readUInt16LE(12) !== 32 ||
  iconBytes.readUInt32LE(14) !== png.length ||
  iconBytes.readUInt32LE(18) !== 22 ||
  !iconBytes.subarray(22).equals(png)
) {
  throw new Error("Generated SweetCord icon has an invalid ICO directory entry.");
}

fs.mkdirSync(path.dirname(iconPath), { recursive: true });
fs.writeFileSync(iconPath, iconBytes);
console.log("Generated validated 32x32 SweetCord ICO: " + iconPath + " (" + iconBytes.length + " bytes).");
