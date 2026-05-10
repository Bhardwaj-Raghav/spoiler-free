import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dest = resolve(root, "extension");

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}
mkdirSync(dest, { recursive: true });

const mustExist = (label, path) => {
  if (!existsSync(path)) {
    console.error(`[dist] Missing ${label}: ${path}\nRun "npm run build" first.`);
    process.exit(1);
  }
};

mustExist("manifest", resolve(root, "manifest.json"));
mustExist("popup HTML", resolve(root, "index.html"));
mustExist("compiled assets", resolve(root, "assets"));

cpSync(resolve(root, "manifest.json"), resolve(dest, "manifest.json"));
cpSync(resolve(root, "index.html"), resolve(dest, "index.html"));
cpSync(resolve(root, "assets"), resolve(dest, "assets"), { recursive: true });

console.log("[dist] Wrote Chrome Web Store bundle to extension/ — zip this folder to upload.");
