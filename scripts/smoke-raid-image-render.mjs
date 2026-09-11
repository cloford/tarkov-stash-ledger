import {build} from "vite";
import react from "@vitejs/plugin-react";
import {mkdtempSync, mkdirSync} from "node:fs";
import {rm} from "node:fs/promises";
import {spawn} from "node:child_process";
import path from "node:path";
import os from "node:os";
import electronPath from "electron";
import {fileURLToPath} from "node:url";

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),".."),fixtureRoot=path.join(projectRoot,"tests/fixtures");
const temporary=mkdtempSync(path.join(os.tmpdir(),"tarkov-image-render-")),outDir=path.join(temporary,"render"),userData=path.join(temporary,"user-data");
if(path.dirname(path.resolve(temporary))!==path.resolve(os.tmpdir())||!path.basename(temporary).startsWith("tarkov-image-render-"))throw new Error("一時ディレクトリの削除対象が不正です");
let timer;
try {
  mkdirSync(userData);
  await build({configFile:false,root:fixtureRoot,base:"./",publicDir:false,plugins:[react()],build:{outDir,emptyOutDir:true,rollupOptions:{input:path.join(fixtureRoot,"raid-image-render.html")}}});
  const child=spawn(electronPath,[path.join(fixtureRoot,"raid-image-render.cjs"),path.join(outDir,"raid-image-render.html"),userData],{cwd:projectRoot,env:{...process.env,ELECTRON_DISABLE_SECURITY_WARNINGS:"true"},stdio:"inherit"});
  timer=setTimeout(()=>child.kill(),60000);
  const code=await new Promise((resolve,reject)=>{child.once("error",reject);child.once("exit",resolve);});
  if(code!==0)throw new Error(`Electron画像描画テスト失敗: ${code}`);
} finally {
  clearTimeout(timer);
  // この実行で作成した一意の一時ディレクトリだけを削除する。
  await rm(temporary,{recursive:true,force:true,maxRetries:5,retryDelay:200});
}
