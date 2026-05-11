import { watch } from "chokidar";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function run(label, cmd) {
  console.log(`[watch] ${label}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: root, shell: true, env: process.env });
  } catch {
    // stderr already printed
  }
}

function syncExtension() {
  console.log("[watch] Sync extension/ …");
  try {
    execSync("node scripts/sync-extension.mjs", {
      stdio: "inherit",
      cwd: root,
      shell: true,
      env: process.env,
    });
  } catch {
    // sync-extension prints errors
  }
}

function debounce(fn, ms) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

const buildTs = debounce(() => {
  run("TypeScript", "npx tsc -p tsconfig.json");
  syncExtension();
}, 200);

const buildSass = debounce(() => {
  run("Sass", "npx sass src/style:assets/style --no-source-map --no-error-css");
  syncExtension();
}, 200);

const debouncedSyncAll = debounce(() => syncExtension(), 150);

console.log("[watch] Initial build…\n");
run("TypeScript", "npx tsc -p tsconfig.json");
run("Sass", "npx sass src/style:assets/style --no-source-map --no-error-css");
syncExtension();

watch(["src/script/**/*.ts", "src/style/**/*.{scss,sass}", "index.html", "manifest.json"], {
  cwd: root,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
}).on("all", (event, filePath) => {
  if (!filePath || event === "error") return;
  const norm = filePath.replace(/\\/g, "/");

  if (norm === "manifest.json" || norm.endsWith("/manifest.json")) {
    debouncedSyncAll();
    return;
  }
  if (norm === "index.html" || norm.endsWith("/index.html")) {
    debouncedSyncAll();
    return;
  }
  if (/\.(scss|sass)$/i.test(norm)) {
    buildSass();
    return;
  }
  if (/\.ts$/i.test(norm)) {
    buildTs();
  }
});

console.log("\n[watch] Ready — extension/ stays in sync with manifest, HTML, TS, and Sass.\n");
