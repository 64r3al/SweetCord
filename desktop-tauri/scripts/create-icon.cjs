"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const iconDirectory = path.join(projectRoot, "src-tauri", "icons");
const cliPath = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri"
);

const sourceSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">\n'
  + '  <rect width="256" height="256" rx="56" fill="#111318"/>\n'
  + '  <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="20">\n'
  + '    <rect x="34" y="36" width="126" height="126" rx="38" stroke="#8f6cff"/>\n'
  + '    <rect x="96" y="94" width="126" height="126" rx="38" stroke="#49beff"/>\n'
  + '    <path d="M104 130 L158 128" stroke="#f0f2ff" stroke-width="16"/>\n'
  + '  </g>\n'
  + '</svg>\n';

function validateWindowsIcon(buffer) {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    throw new Error("Tauri generated an invalid Windows ICO header.");
  }
  const count = buffer.readUInt16LE(4);
  const expected = new Set([16, 24, 32, 48, 64, 256]);
  const found = new Set();
  if (count < expected.size || buffer.length < 6 + count * 16) {
    throw new Error("Windows ICO is missing required icon entries.");
  }

  for (let i = 0; i < count; i += 1) {
    const entry = 6 + i * 16;
    const width = buffer.readUInt8(entry) || 256;
    const height = buffer.readUInt8(entry + 1) || 256;
    const size = buffer.readUInt32LE(entry + 8);
    const offset = buffer.readUInt32LE(entry + 12);
    if (width !== height || size === 0 || offset < 6 + count * 16 || offset + size > buffer.length) {
      throw new Error("Windows ICO contains an invalid image entry.");
    }
    found.add(width);
  }

  const missing = [...expected].filter((size) => !found.has(size));
  if (missing.length > 0) {
    throw new Error("Windows ICO is missing these sizes: " + missing.join(", ") + ".");
  }
}

if (!fs.existsSync(cliPath)) {
  throw new Error("Tauri CLI is missing. Run npm install in desktop-tauri first.");
}

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sweetcord-icon-"));
const sourcePath = path.join(tempDirectory, "sweetcord-icon.svg");
try {
  fs.writeFileSync(sourcePath, sourceSvg, "utf8");
  const result = spawnSync(
    cliPath,
    ["icon", sourcePath, "--output", iconDirectory],
    {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: "inherit",
      shell: process.platform === "win32"
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error("Tauri icon generation failed with exit status " + result.status + ".");
  }

  const iconPath = path.join(iconDirectory, "icon.ico");
  if (!fs.existsSync(iconPath)) throw new Error("Tauri did not generate icons/icon.ico.");
  validateWindowsIcon(fs.readFileSync(iconPath));
  console.log("Generated and validated the multi-size SweetCord icon set.");
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
