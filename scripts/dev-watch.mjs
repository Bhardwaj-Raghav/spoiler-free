import { watch } from "chokidar";
import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

const indexSrc = resolve(root, "index.html");
const indexDest = resolve(root, "extension/index.html");

function run(label, cmd) {
  console.log(`[watch] ${label}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: root, shell: true, env: process.env });
  } catch {
    // stderr already printed
  }
}

function debounce(fn, ms) {
  let t;
  return () => {
    clearTimeout(t);
    t = setTimeout(fn, ms);
  };
}

function syncIndexToExtension() {
  mkdirSync(resolve(root, "extension"), { recursive: true });
  copyFileSync(indexSrc, indexDest);
  console.log("[watch] index.html → extension/index.html");
}

const buildTs = debounce(() => run("TypeScript", "npx tsc -p tsconfig.json"), 200);
const buildSass = debounce(() => run("Sass", "npx sass src/style:assets/style --source-map"), 200);
const debouncedIndex = debounce(() => syncIndexToExtension(), 100);

console.log("[watch] Initial build…\n");
run("TypeScript", "npx tsc -p tsconfig.json");
run("Sass", "npx sass src/style:assets/style --source-map");
syncIndexToExtension();

watch(["src/script/**/*.ts", "src/style/**/*.{scss,sass}", "index.html"], {
  cwd: root,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
}).on("all", (event, filePath) => {
  if (!filePath || event === "error") return;
  const norm = filePath.replace(/\\/g, "/");

  if (norm === "index.html" || norm.endsWith("/index.html")) {
    debouncedIndex();
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

console.log("\n[watch] Ready — change .ts, .scss, or index.html  (Ctrl+C to stop)\n");
