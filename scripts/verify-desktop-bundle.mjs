import { createHash } from "node:crypto";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { getDesktopBuildFingerprint } from "./desktop-bundle-fingerprint.mjs";

const require = createRequire(import.meta.url);
const asar = require("@electron/asar");
const root = process.cwd();
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const outputDirectory = process.env.DESKTOP_OUTPUT_DIR || packageJson.build?.directories?.output;
if (!outputDirectory) throw new Error("Electron 出力先を特定できません。");

const desktopDist = path.join(root, "desktop-dist");
const manifestPath = path.join(desktopDist, "desktop-build-manifest.json");
const archivePath = path.join(path.resolve(root, outputDirectory), "win-unpacked", "resources", "app.asar");
await Promise.all([access(manifestPath), access(archivePath)]);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const current = await getDesktopBuildFingerprint(root);
if (manifest.schemaVersion !== 1 || manifest.input?.digest !== current.digest) {
  throw new Error("Vite ビルド後に入力ファイルが変わっています。desktop:build を最初から実行してください。");
}
const generatedFingerprint = await readFile(path.join(root, "desktop", "build-input-fingerprint.ts"), "utf8");
if (!generatedFingerprint.includes(current.digest)) {
  throw new Error("デスクトップ用の入力指紋が最新ではありません。Vite ビルド前に指紋生成を実行してください。");
}

async function filesIn(directory, relative = "") {
  const entries = await readdir(path.join(directory, relative), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(directory, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

const hash = value => createHash("sha256").update(value).digest("hex");
const archiveFiles = new Map(asar.listPackage(archivePath)
  .filter(file => !file.endsWith("\\"))
  .map(file => [file.replace(/^\\+/, "").replaceAll("\\", "/"), file.replace(/^\\+/, "")]));
const mismatches = [];
let renderedFingerprintFound = false;
const desktopFiles = await filesIn(desktopDist);
for (const relativeFile of desktopFiles) {
  const packageFile = `desktop-dist/${relativeFile.replaceAll(path.sep, "/")}`;
  const archiveFile = archiveFiles.get(packageFile);
  if (!archiveFile) {
    mismatches.push(`${packageFile}: app.asar にありません`);
    continue;
  }
  const [source, bundled] = await Promise.all([
    readFile(path.join(desktopDist, relativeFile)),
    Promise.resolve(asar.extractFile(archivePath, archiveFile)),
  ]);
  if (relativeFile.endsWith(".js") && source.includes(current.digest)) renderedFingerprintFound = true;
  if (hash(source) !== hash(bundled)) mismatches.push(`${packageFile}: 内容が一致しません`);
}

if (!renderedFingerprintFound) mismatches.push("desktop-dist: 最新の入力指紋がレンダラー成果物にありません");

if (mismatches.length) {
  throw new Error(`配布成果物が desktop-dist と一致しません。\n${mismatches.slice(0, 10).join("\n")}`);
}
console.log(`app.asar を検証しました（desktop-dist ${desktopFiles.length} ファイル、入力 ${current.fileCount} 件）。`);
