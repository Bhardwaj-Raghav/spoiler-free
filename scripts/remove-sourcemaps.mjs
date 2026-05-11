/**
 * Deletes *.map under assets/ so old maps are not shipped after switching off source maps.
 */
import { readdirSync, unlinkSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
    } else if (name.endsWith(".map")) {
      unlinkSync(p);
      console.log("[remove-sourcemaps] removed", p);
    }
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
walk(join(root, "style"));
walk(join(root, "scripts"));
