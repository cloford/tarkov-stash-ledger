import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdtemp,readFile,rm,writeFile,mkdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import cacheModule from "../electron/map-image-cache.cjs";

const {createMapCacheProtocolHandler,createMapImageCache,registerMapCacheScheme}=cacheModule;
const source="https://example.com/maps/customs.png";
const image=Buffer.from("not-a-real-png-but-useful-for-ipc-contract-tests");
const sha256=createHash("sha256").update(image).digest("hex");
const largeImage=Buffer.alloc(2*1024*1024,0x5a),largeSha256=createHash("sha256").update(largeImage).digest("hex");
const temporaryDirectories=[];

async function temporaryUserData(){const directory=await mkdtemp(path.join(os.tmpdir(),"tarkov-map-cache-"));temporaryDirectories.push(directory);return directory}
test.after(async()=>Promise.all(temporaryDirectories.map(directory=>rm(directory,{recursive:true,force:true}))));

test("保存画像の本体をIPCへ載せず専用URLとSHA-256だけを返す",async()=>{
  const userData=await temporaryUserData(),now=new Date("2026-09-04T00:00:00.000Z"),cache=createMapImageCache({getUserDataPath:()=>userData,now:()=>now,fetchImpl:async()=>new Response(largeImage,{headers:{"content-type":"image/png"}})});
  const result=await cache(source,"customs/extraction",true);
  assert.deepEqual(result,{url:`stash-map://cache/customs_extraction?v=${largeSha256}`,cached:true,updatedAt:now.toISOString(),sha256:largeSha256});
  assert.ok(Buffer.byteLength(JSON.stringify(result))<512,"IPC応答サイズが画像サイズに比例しない");
  assert.equal(JSON.stringify(result).includes("base64"),false);
  assert.deepEqual(await readFile(path.join(userData,"offline-maps","customs_extraction.bin")),largeImage);
  const meta=JSON.parse(await readFile(path.join(userData,"offline-maps","customs_extraction.json"),"utf8"));
  assert.deepEqual(meta,{source,mime:"image/png",updatedAt:now.toISOString(),sha256:largeSha256,bytes:largeImage.length});
});

test("保存済み画像はネットワークなしで再利用し、更新失敗時も維持する",async()=>{
  const userData=await temporaryUserData(),successful=createMapImageCache({getUserDataPath:()=>userData,fetchImpl:async()=>new Response(image,{headers:{"content-type":"image/png"}})}),saved=await successful(source,"customs",true);
  const offline=createMapImageCache({getUserDataPath:()=>userData,fetchImpl:async()=>{throw Error("offline")}});
  assert.deepEqual(await offline(source,"customs",false),saved);
  assert.deepEqual(await offline(source,"customs",true),{...saved,error:"offline"});
  assert.deepEqual(await offline("https://example.com/maps/woods.png","woods",true),{url:"https://example.com/maps/woods.png",cached:false,error:"offline"});
});

test("専用プロトコルは検証済みキャッシュだけを正しいMIMEで配信する",async()=>{
  const userData=await temporaryUserData(),directory=path.join(userData,"offline-maps");
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,"customs.bin"),image);
  await writeFile(path.join(directory,"customs.json"),JSON.stringify({source,mime:"image/png",updatedAt:"2026-09-04T00:00:00.000Z",sha256}));
  const handle=createMapCacheProtocolHandler({getUserDataPath:()=>userData}),response=await handle({method:"GET",url:`stash-map://cache/customs?v=${sha256}`});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("content-type"),"image/png");
  assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()),image);
  assert.equal((await handle({method:"GET",url:`stash-map://cache/customs/../../secret?v=${sha256}`})).status,404);
  assert.equal((await handle({method:"GET",url:`stash-map://cache/customs?v=${"0".repeat(64)}`})).status,404);
  assert.equal((await handle({method:"POST",url:`stash-map://cache/customs?v=${sha256}`})).status,405);
});

test("Electronへ標準・secureな専用schemeをready前登録できる",()=>{
  let schemes;
  registerMapCacheScheme({registerSchemesAsPrivileged:value=>{schemes=value}});
  assert.deepEqual(schemes,[{scheme:"stash-map",privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
});
