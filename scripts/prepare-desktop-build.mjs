import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getDesktopBuildFingerprint } from "./desktop-bundle-fingerprint.mjs";

const root = process.cwd();
const fingerprint = await getDesktopBuildFingerprint(root);
await writeFile(
  path.join(root, "desktop", "build-input-fingerprint.ts"),
  `// このファイルはデスクトップビルドの直前に自動更新されます。\nexport const desktopBuildInputFingerprint = "${fingerprint.digest}";\n`,
);
console.log(`デスクトップ入力 ${fingerprint.fileCount} 件を準備しました (${fingerprint.digest.slice(0, 12)})`);
