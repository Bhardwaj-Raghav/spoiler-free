/**
 * Copies manifest + popup + compiled assets into extension/ for Chrome "Load unpacked".
 * Stamps ?v=<manifest version> on CSS/JS in index.html so Chrome does not serve stale assets.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Cache-bust chrome-extension:// asset caching (same version string as manifest). */
function stampIndexHtml(html, version) {
  return html
    .replace(
      /\.\/assets\/style\/style\.css(\?[^"'\s>]*)?/g,
      `./assets/style/style.css?v=${version}`
    )
    .replace(
      /\.\/assets\/scripts\/script\.js(\?[^"'\s>]*)?/g,
      `./assets/scripts/script.js?v=${version}`
    );
}

export function syncExtensionDir() {
  const manifestSrc = join(root, "manifest.json");
  const indexSrc = join(root, "index.html");
  const assetsSrc = join(root, "assets");
  const dest = join(root, "extension");

  if (!existsSync(manifestSrc)) {
    console.error("[sync-extension] Missing manifest.json at project root.");
    process.exit(1);
  }
  if (!existsSync(indexSrc)) {
    console.error("[sync-extension] Missing index.html.");
    process.exit(1);
  }
  if (!existsSync(assetsSrc)) {
    console.error(
      "[sync-extension] Missing assets/ — run npm run build:scripts && npm run build:styles first."
    );
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestSrc, "utf8"));
  const version = String(manifest.version ?? "0.0.0");

  mkdirSync(dest, { recursive: true });
  cpSync(manifestSrc, join(dest, "manifest.json"));

  let html = readFileSync(indexSrc, "utf8");
  html = stampIndexHtml(html, version);
  writeFileSync(join(dest, "index.html"), html, "utf8");

  const assetsDest = join(dest, "assets");
  if (existsSync(assetsDest)) {
    rmSync(assetsDest, { recursive: true, force: true });
  }
  cpSync(assetsSrc, assetsDest, { recursive: true });

  console.log(`[sync-extension] extension/ updated (stamped index.html ?v=${version}, assets/).`);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  syncExtensionDir();
}
