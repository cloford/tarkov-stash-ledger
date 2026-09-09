import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, cp } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const writeManifest = path.join(root, "scripts", "write-desktop-build-manifest.mjs");
const prepareBuild = path.join(root, "scripts", "prepare-desktop-build.mjs");
const verifyBundle = path.join(root, "scripts", "verify-desktop-bundle.mjs");

function run(script, cwd, env = {}) {
  return new Promise(resolve => execFile(process.execPath, [script], { cwd, env: { ...process.env, ...env } }, (error, stdout, stderr) => resolve({ error, stdout, stderr })));
}

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tarkov-desktop-bundle-"));
  await Promise.all([
    mkdir(path.join(directory, "app"), { recursive: true }),
    mkdir(path.join(directory, "desktop"), { recursive: true }),
    mkdir(path.join(directory, "public"), { recursive: true }),
    mkdir(path.join(directory, "desktop-dist", "assets"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(directory, "app", "page.tsx"), "export default function App() { return null; }\n"),
    writeFile(path.join(directory, "desktop", "main.tsx"), "export {};\n"),
    writeFile(path.join(directory, "public", "icon.svg"), "<svg/>\n"),
    writeFile(path.join(directory, "vite.desktop.config.ts"), "export default {};\n"),
    writeFile(path.join(directory, "package.json"), JSON.stringify({ build: { directories: { output: "bundle" } } })),
    writeFile(path.join(directory, "desktop-dist", "index.html"), "<main>renderer</main>\n"),
    writeFile(path.join(directory, "desktop-dist", "assets", "app.js"), "console.log('current renderer');\n"),
  ]);
  const prepareResult = await run(prepareBuild, directory);
  assert.equal(prepareResult.error, null, prepareResult.stderr);
  const manifestResult = await run(writeManifest, directory);
  assert.equal(manifestResult.error, null, manifestResult.stderr);
  const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(path.join(directory, "desktop-dist", "desktop-build-manifest.json"), "utf8"));
  await writeFile(path.join(directory, "desktop-dist", "assets", "app.js"), `console.log('${manifest.input.digest}');\n`);
  const stage = path.join(directory, "stage");
  await cp(path.join(directory, "desktop-dist"), path.join(stage, "desktop-dist"), { recursive: true });
  const archive = path.join(directory, "bundle", "win-unpacked", "resources", "app.asar");
  await mkdir(path.dirname(archive), { recursive: true });
  await asar.createPackage(stage, archive);
  return directory;
}

test("desktop-dist と app.asar が同一なら検証できる", async () => {
  const directory = await fixture();
  const result = await run(verifyBundle, directory);
  assert.equal(result.error, null, result.stderr);
  assert.match(result.stdout, /app\.asar を検証しました/);
});

test("Viteビルド後の入力変更と app.asar の差異を検出する", async () => {
  const directory = await fixture();
  await writeFile(path.join(directory, "app", "page.tsx"), "export default function App() { return <main>changed</main>; }\n");
  const staleInput = await run(verifyBundle, directory);
  assert.notEqual(staleInput.error, null);
  assert.match(staleInput.stderr, /Vite ビルド後に入力ファイルが変わっています/);

  await writeFile(path.join(directory, "app", "page.tsx"), "export default function App() { return null; }\n");
  await writeFile(path.join(directory, "desktop-dist", "assets", "app.js"), "console.log('stale renderer');\n");
  const mismatch = await run(verifyBundle, directory);
  assert.notEqual(mismatch.error, null);
  assert.match(mismatch.stderr, /配布成果物が desktop-dist と一致しません/);
});
