import { access, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDesktopBuildFingerprint } from "./desktop-bundle-fingerprint.mjs";

const root = process.cwd();
const desktopDist = path.join(root, "desktop-dist");
await access(desktopDist);

const fingerprint = await getDesktopBuildFingerprint(root);
const generatedFingerprint = await (await import("node:fs/promises")).readFile(path.join(root, "desktop", "build-input-fingerprint.ts"), "utf8");
if (!generatedFingerprint.includes(fingerprint.digest)) {
  throw new Error("デスクトップ用の入力指紋が最新ではありません。Vite ビルド前に prepare-desktop-build を実行してください。");
}
const manifest = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  input: fingerprint,
};
await writeFile(path.join(desktopDist, "desktop-build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`デスクトップ入力 ${fingerprint.fileCount} 件を記録しました (${fingerprint.digest.slice(0, 12)})`);
