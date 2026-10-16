// Extension build: clean dist/, compile with tsc, copy the static files.
//
// Deliberately dependency-free — the whole toolchain is tsc. Run `pnpm build`
// and load the resulting dist/ unpacked from chrome://extensions.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const STATIC_FILES = ["manifest.json", "popup.html", "style.css"];
const STATIC_ASSETS = [["assets/icon.png", "dist/icon.png"]];

const tscBin = path.resolve("node_modules/typescript/bin/tsc");

if (!existsSync(tscBin)) {
  console.error("[1688 Scout] typescript is not installed — run `pnpm install` first");
  process.exit(1);
}

await rm("dist", { recursive: true, force: true });

const compiled = spawnSync(process.execPath, [tscBin], { stdio: "inherit" });

if (compiled.status !== 0) {
  console.error("[1688 Scout] tsc failed — dist/ was not written");
  process.exit(compiled.status ?? 1);
}

await mkdir("dist", { recursive: true });
await Promise.all([
  ...STATIC_FILES.map((file) => cp(file, path.join("dist", file))),
  ...STATIC_ASSETS.map(([from, to]) => cp(from, to)),
]);

console.log(
  `[1688 Scout] built dist/ (${STATIC_FILES.length + STATIC_ASSETS.length} static files)`,
);
