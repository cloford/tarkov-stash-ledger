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
const cachePaths=(userDataPath,id)=>{const directory=cacheDirectory(userDataPath);return{directory,image:path.join(directory,`${id}.bin`),meta:path.join(directory,`${id}.json`)}};
const cacheUrl=(id,sha256)=>`${MAP_CACHE_SCHEME}://cache/${id}?v=${sha256}`;

function httpsSource(value){
  const source=String(value||"");
  try{return new URL(source).protocol==="https:"?source:null}catch{return null}
}

function readCache(userDataPath,source,id){
  try{
    const files=cachePaths(userDataPath,id),meta=JSON.parse(fs.readFileSync(files.meta,"utf8")),stat=fs.statSync(files.image);
    if(meta.source!==source||!MIME_PATTERN.test(String(meta.mime||""))||!stat.isFile()||!stat.size||stat.size>MAX_IMAGE_BYTES)return null;
    const sha256=SHA256_PATTERN.test(String(meta.sha256||""))?String(meta.sha256).toLowerCase():digest(fs.readFileSync(files.image));
    return{url:cacheUrl(id,sha256),cached:true,updatedAt:meta.updatedAt,sha256};
  }catch{return null}
}

function createMapImageCache({getUserDataPath,fetchImpl=globalThis.fetch,now=()=>new Date()}){
  return async function cacheMapImage(url,mapId,refresh=false){
    const input=String(url||""),source=httpsSource(input),id=safeMapId(mapId);
    if(!source)return{url:input,cached:false,error:"invalid url"};
    const saved=()=>readCache(getUserDataPath(),source,id);
    if(!refresh)return saved()||{url:source,cached:false};
    try{
      const response=await fetchImpl(source,{signal:AbortSignal.timeout(45000),headers:{"user-agent":"Tarkov Task Extract Navi/1.0"}});
      if(!response.ok)throw Error(`image ${response.status}`);
      const mime=String(response.headers.get("content-type")||"image/jpeg").split(";")[0].trim().toLowerCase();
      if(!MIME_PATTERN.test(mime))throw Error("unsupported image");
      const contentLength=Number(response.headers.get("content-length")||0);
      if(contentLength>MAX_IMAGE_BYTES)throw Error("invalid image size");
      const data=Buffer.from(await response.arrayBuffer());
      if(!data.length||data.length>MAX_IMAGE_BYTES)throw Error("invalid image size");
      const files=cachePaths(getUserDataPath(),id),updatedAt=now().toISOString(),sha256=digest(data);
      fs.mkdirSync(files.directory,{recursive:true});
      fs.writeFileSync(files.image,data);
      fs.writeFileSync(files.meta,JSON.stringify({source,mime,updatedAt,sha256,bytes:data.length}));
      return{url:cacheUrl(id,sha256),cached:true,updatedAt,sha256};
    }catch(error){
      const fallback=saved(),message=String(error?.message||error);
      return fallback?{...fallback,error:message}:{url:source,cached:false,error:message};
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
      const files=cachePaths(getUserDataPath(),id),root=await fs.promises.realpath(files.directory),image=await fs.promises.realpath(files.image),meta=JSON.parse(await fs.promises.readFile(files.meta,"utf8")),stat=await fs.promises.stat(image),mime=String(meta.mime||"").toLowerCase();
      if(!staysInside(root,image)||!stat.isFile()||!stat.size||stat.size>MAX_IMAGE_BYTES||!httpsSource(meta.source)||!MIME_PATTERN.test(mime)||!SHA256_PATTERN.test(String(meta.sha256||""))||meta.sha256.toLowerCase()!==expectedHash.toLowerCase())return errorResponse(404,"Not found");
      const body=Readable.toWeb(fs.createReadStream(image));
      return new Response(body,{status:200,headers:{"cache-control":"private, max-age=31536000, immutable","content-length":String(stat.size),"content-security-policy":"default-src 'none'; sandbox","content-type":mime,"x-content-type-options":"nosniff"}});
    }catch{return errorResponse(404,"Not found")}
  };
}

function registerMapCacheScheme(protocol){
  protocol.registerSchemesAsPrivileged([{scheme:MAP_CACHE_SCHEME,privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
}

module.exports={MAP_CACHE_SCHEME,MAX_IMAGE_BYTES,cacheUrl,createMapCacheProtocolHandler,createMapImageCache,registerMapCacheScheme,safeMapId};
