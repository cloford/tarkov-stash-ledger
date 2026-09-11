const crypto=require("node:crypto");
const fs=require("node:fs");
const path=require("node:path");
const {Readable}=require("node:stream");

const MAP_CACHE_SCHEME="stash-map";
const MAX_IMAGE_BYTES=50*1024*1024;
const SAFE_ID_PATTERN=/^[a-z0-9_-]{1,80}$/i;
const SHA256_PATTERN=/^[a-f0-9]{64}$/i;
const MIME_PATTERN=/^image\/(png|jpe?g|webp|svg\+xml)$/i;

const safeMapId=value=>String(value||"map").replace(/[^a-z0-9_-]/gi,"_").slice(0,80)||"map";
const digest=data=>crypto.createHash("sha256").update(data).digest("hex");
const cacheDirectory=userDataPath=>path.join(userDataPath,"offline-maps");
const cachePaths=(userDataPath,id)=>{const directory=cacheDirectory(userDataPath);return{directory,legacyImage:path.join(directory,`${id}.bin`),meta:path.join(directory,`${id}.json`)}};
const revisionPath=(directory,id,sha256)=>path.join(directory,`${id}-${sha256}.bin`);
const cacheUrl=(id,sha256)=>`${MAP_CACHE_SCHEME}://cache/${id}?v=${sha256}`;

function httpsSource(value){
  const source=String(value||"");
  try{return new URL(source).protocol==="https:"?source:null}catch{return null}
}

const metadataRecords=meta=>[meta,...(Array.isArray(meta?.history)?meta.history:[])].filter(record=>record&&typeof record==="object");
function verifiedRecord(userDataPath,id,record,{allowLegacy=false}={}){
  try{
    const files=cachePaths(userDataPath,id),sha256=String(record.sha256||"").toLowerCase(),mime=String(record.mime||"").toLowerCase();
    if(!httpsSource(record.source)||!MIME_PATTERN.test(mime)||!SHA256_PATTERN.test(sha256))return null;
    const revision=revisionPath(files.directory,id,sha256),image=fs.existsSync(revision)?revision:(allowLegacy?files.legacyImage:"");
    if(!image)return null;
    const stat=fs.statSync(image),data=fs.readFileSync(image);
    if(!stat.isFile()||!stat.size||stat.size>MAX_IMAGE_BYTES||digest(data)!==sha256)return null;
    return{...record,sha256,mime,image,bytes:stat.size};
  }catch{return null}
}
function readManifest(userDataPath,id){try{return JSON.parse(fs.readFileSync(cachePaths(userDataPath,id).meta,"utf8"))}catch{return null}}
function readCache(userDataPath,source,id){
  const meta=readManifest(userDataPath,id);if(!meta)return null;
  const verified=metadataRecords(meta).map((record,index)=>verifiedRecord(userDataPath,id,record,{allowLegacy:index===0})).filter(Boolean),exact=verified.find(record=>record.source===source),selected=exact||verified[0];
  return selected?{url:cacheUrl(id,selected.sha256),cached:true,updatedAt:selected.updatedAt,sha256:selected.sha256,stale:!exact,source:selected.source}:null;
}
function classifyError(error){const code=String(error?.code||"").toUpperCase();if(code==="ENOSPC"||code==="EDQUOT")return{message:"容量不足",kind:"storage"};const message=String(error?.message||error);if(/timeout|abort/i.test(message))return{message:"タイムアウト",kind:"timeout"};if(/unsupported image|content.?type/i.test(message))return{message:"画像形式が対象外",kind:"unsupported"};if(/image \d+/i.test(message))return{message:`HTTP ${message.match(/\d+/)?.[0]||"エラー"}`,kind:"http"};if(/size|検証/i.test(message))return{message,kind:"corrupt"};return{message,kind:"network"};}
function atomicWrite(file,data){const temporary=`${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;try{fs.writeFileSync(temporary,data);fs.renameSync(temporary,file);}catch(error){try{fs.unlinkSync(temporary)}catch{}throw error}}

function createMapImageCache({getUserDataPath,fetchImpl=globalThis.fetch,now=()=>new Date()}){
  return async function cacheMapImage(url,mapId,refresh=false){
    const input=String(url||""),source=httpsSource(input),id=safeMapId(mapId);
    if(!source)return{url:input,cached:false,error:"invalid url"};
    const userDataPath=getUserDataPath(),saved=()=>readCache(userDataPath,source,id);
    if(!refresh)return saved()||{url:source,cached:false};
    try{
      const response=await fetchImpl(source,{signal:AbortSignal.timeout(45000),headers:{"user-agent":"Tarkov Task Extract Navi/1.0"}});
      if(!response.ok)throw Error(`image ${response.status}`);
      const mime=String(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
      if(!MIME_PATTERN.test(mime))throw Error("unsupported image");
      const contentLength=Number(response.headers.get("content-length")||0);
      if(contentLength>MAX_IMAGE_BYTES)throw Error("invalid image size");
      const data=Buffer.from(await response.arrayBuffer());
      if(!data.length||data.length>MAX_IMAGE_BYTES)throw Error("invalid image size");
      const files=cachePaths(userDataPath,id),updatedAt=now().toISOString(),sha256=digest(data),current={source,mime,updatedAt,sha256,bytes:data.length};
      fs.mkdirSync(files.directory,{recursive:true});
      const imageFile=revisionPath(files.directory,id,sha256);
      if(!fs.existsSync(imageFile))atomicWrite(imageFile,data);
      if(digest(fs.readFileSync(imageFile))!==sha256)throw Error("保存画像の検証に失敗しました");
      const oldMeta=readManifest(userDataPath,id),oldRecords=metadataRecords(oldMeta).map(record=>verifiedRecord(userDataPath,id,record,{allowLegacy:record===oldMeta})).filter(record=>record&&record.sha256!==sha256).slice(0,8);
      for(const record of oldRecords){const target=revisionPath(files.directory,id,record.sha256);if(!fs.existsSync(target))atomicWrite(target,fs.readFileSync(record.image));}
      const history=oldRecords.map(({source,mime,updatedAt,sha256,bytes})=>({source,mime,updatedAt,sha256,bytes}));
      atomicWrite(files.meta,JSON.stringify({...current,history}));
      return{url:cacheUrl(id,sha256),cached:true,updatedAt,sha256,stale:false,source};
    }catch(error){
      const fallback=saved(),classified=classifyError(error);
      return fallback?{...fallback,error:classified.message,errorKind:classified.kind}:{url:source,cached:false,error:classified.message,errorKind:classified.kind};
    }
  };
}

const errorResponse=(status,message)=>new Response(message,{status,headers:{"cache-control":"no-store","content-type":"text/plain; charset=utf-8","x-content-type-options":"nosniff"}});
const staysInside=(root,target)=>{const relative=path.relative(root,target);return relative!==""&&!relative.startsWith(`..${path.sep}`)&&relative!==".."&&!path.isAbsolute(relative)};

function createMapCacheProtocolHandler({getUserDataPath}){
  return async request=>{
    if(request.method!=="GET")return errorResponse(405,"Method not allowed");
    let requested,id;
    try{requested=new URL(request.url);id=decodeURIComponent(requested.pathname.replace(/^\//,""))}catch{return errorResponse(400,"Invalid URL")}
    const expectedHash=requested.searchParams.get("v")||"";
    if(requested.protocol!==`${MAP_CACHE_SCHEME}:`||requested.hostname!=="cache"||!SAFE_ID_PATTERN.test(id)||!SHA256_PATTERN.test(expectedHash))return errorResponse(404,"Not found");
    try{
      const userDataPath=getUserDataPath(),files=cachePaths(userDataPath,id),meta=readManifest(userDataPath,id),record=metadataRecords(meta).find(entry=>String(entry.sha256||"").toLowerCase()===expectedHash.toLowerCase()),verified=record&&verifiedRecord(userDataPath,id,record,{allowLegacy:record===meta}),root=await fs.promises.realpath(files.directory),image=await fs.promises.realpath(verified?.image||"");
      if(!verified||!staysInside(root,image))return errorResponse(404,"Not found");
      const body=Readable.toWeb(fs.createReadStream(image));
      return new Response(body,{status:200,headers:{"cache-control":"private, max-age=31536000, immutable","content-length":String(verified.bytes),"content-security-policy":"default-src 'none'; sandbox","content-type":verified.mime,"x-content-type-options":"nosniff"}});
    }catch{return errorResponse(404,"Not found")}
  };
}

function registerMapCacheScheme(protocol){
  protocol.registerSchemesAsPrivileged([{scheme:MAP_CACHE_SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
}

module.exports={MAP_CACHE_SCHEME,MAX_IMAGE_BYTES,cacheUrl,createMapCacheProtocolHandler,createMapImageCache,registerMapCacheScheme,safeMapId};
