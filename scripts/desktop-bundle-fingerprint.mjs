import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const INPUT_PATHS = ["app", "desktop", "public", "vite.desktop.config.ts", "package.json"];

async function collectFiles(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  const stat = await import("node:fs/promises").then(({ stat }) => stat(absolutePath));
  if (stat.isFile()) return [relativePath];
  const entries = await readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const child = path.join(relativePath, entry.name);
    if (child === path.join("desktop", "build-input-fingerprint.ts")) continue;
    if (entry.isDirectory()) files.push(...await collectFiles(root, child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

export async function getDesktopBuildFingerprint(root = process.cwd()) {
  const files = (await Promise.all(INPUT_PATHS.map(input => collectFiles(root, input))))
    .flat()
    .sort((left, right) => left.localeCompare(right));
  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(file.replaceAll(path.sep, "/"));
    digest.update("\0");
    digest.update(await readFile(path.join(root, file)));
    digest.update("\0");
  }
  return { algorithm: "sha256", digest: digest.digest("hex"), fileCount: files.length };
}
