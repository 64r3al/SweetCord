"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAFPElEQVR42u3dsXFaTRSGYdDQAEMCoXpQQAUugBkFhG7DAQGB23BIwIwLUAUK3INCysCRZ8AWkgPYe9jveeJ//I92z753wQKPp7P5cQREerAEIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAAACAAgAIACAAACnJpbg3GZ96PLn2u4WNpd/jKez+dFhzyQKxAUg/dCLAZEBcPCFgMAAOPhCQGAAHHwhIDAADr4Q8P8eHH6srRuA4cRtwA3A4ceaC4BBxNoLgAHEHgiAwcNeCICBw54IgEHD3giAAcMeCYDBwl4JgIHCngkAIACeJNg7ATBAImARBAAQAE8OtwDK8bXgF/TykVcHkI+U+z6AIQe298+5W1vcAIKH88/P6VZAyRtA68FMfypZb2L/FsAwWgMKBaDl08jgD7MWXnoIgKeeNUEADLq1QQAaXg0NeI018jJAAAABcL21VggAIACeaNaMwAB4UyiPPRcAQABcZa0dAgAIACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAIACAAgAAAAgAIAAgAIABAnokl4JKX1e3+7OVquK8Gf332hacCwPmB3B+if9bUKAiAQ89fa5EUAwFw8LmwPgkhEAAHn+AQCICDT3AIBMDBJzgEfg/A4Sd4bd0ADCfBtwE3AIef4DUXAINI8NoLgAEkeA8EwOARvBcCYOAI3hMBMGgE740AGDCC90gADBbBeyUABorgPRMACCYAniQE750AGCCC91AAwEsAPDlI3EsfB+ZTX35e98/7+n00enxcOIACQIWB3T198h889bGep5/dHyoGy/2h1HcICEAxb2+eUi1jkH4r8B4A8SFo/USuFB0BgFHuvwwkADBABKrcAroOwGbt9TRuAm4AIAI1A7Dd+aeayYxAhZcB3d8AvAwALwHAS4HUALgFgBsAuAVUDECLNwLv4Rbgwyp5ht7zqBuAlwIQ/hJABPAyoGAAWv4+gAhA6A1ABKBoAFr/VuBmfRACovlCkJPbQOqvJf/41l/cudMAbHeLwZ7Kp//fIQd2/ev6f+a1v9fP4RcA7xFc2cuNDj/cxXsAnhj9sZcCAAiAJ4enPwJggBx+BAAQAE8ST38EwEA5/AiAwXL4EQAD5vAjAAbNniAABs5eIAAGzx4gAAbQ2iMABtGacwWTngbSt/s4+ITdAAyotSX8BuA24OAjAELg4CMAQuDgIwBC4OAjAB8NenoMHHomDsC5XqPgsCMAxQ/KcuXlCW35SjAQAEAAAAEABAAQAEAAAAEABAAQAEAAAAEABAAQAEAAAAEABAAQAEAAAAEABIAbWu594ai1EwBAAGp6ffbd/fZcAHCVtWYCAAgAnmjWSgAAAeheizeF3AJqrFGFN30FwIATvDYCYNAJXhMBCH0ZIALDrkWV3/kQAEQgeA3G09n86AgYympPJmvcxsQx470D0XsI3HrcAAxq2K3AWroB4GnJCW8CFucTgvZSAAAB8OTAHgqAAcLeCQAgAJ4k2DMBMFDYKwEwWNgjATBg2BsBMGjYEwEwcNgLATB42AMBMIBYewEwiFhz3wfQKx/hdfDdAAwo1tYNwG3AbcDBFwAhEAIHXwAQAgdfABCC4IMvAIhB6KEXAKKj4G9IBAAY+T0AEABAAAABAAQAEABAAAABAAQAEABAAAABAAQAEABAAAABAAQAEABAAAABAAQAEABAAAABAAQAEABAAAABAAQAEABAAAABAAQAEADgfb8BLRDiKYPzwoUAAAAASUVORK5CYII=";
const projectRoot = path.resolve(__dirname, "..");
const iconDirectory = path.join(projectRoot, "src-tauri", "icons");
const cliPath = path.join(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri"
);
const png = Buffer.from(pngBase64, "base64");

function readUInt32BE(buffer, offset) {
  return buffer.readUInt32BE(offset);
}

function validateSourcePng(buffer) {
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
      if (width !== 256 || height !== 256) {
        throw new Error("Expected a 256x256 icon source, got " + width + "x" + height + ".");
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

validateSourcePng(png);
if (!fs.existsSync(cliPath)) {
  throw new Error("Tauri CLI is missing. Run npm install in desktop-tauri first.");
}

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sweetcord-icon-"));
const sourcePath = path.join(tempDirectory, "app-icon.png");
try {
  fs.writeFileSync(sourcePath, png);
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
