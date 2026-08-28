const WIKI_API="https://escapefromtarkov.fandom.com/api.php";
const KEY_CATALOG_SCHEMA_VERSION=4;
const WIKI_FIELDS=["lockLocation","lockLocationEn","behindLock","behindLockEn","lockLocationSource","behindLockSource","wikiUpdatedAt"];

const compactTitle=value=>decodeURIComponent(String(value||"")).replace(/_/g," ").trim().toLocaleLowerCase("en-US");
const wikiTitleFromUrl=url=>{try{return decodeURIComponent(new URL(url).pathname.split("/wiki/")[1]||"").replace(/_/g," ")}catch{return""}};
const decodeEntities=value=>String(value||"").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
const normalizeJapaneseWikiText=value=>String(value||"").replace(/Loose loot \(Valuables, Drinks, Building materials, Electronics\)/gi,"ルーズ戦利品（貴重品、飲料、建築資材、電子機器）").replace(/Loose loot \(Ammunition, Weapon mods and Electronics\)/gi,"ルーズ戦利品（弾薬、武器改造、電子機器）").replace(/Relaxation room key spawn location on the metal table/gi,"金属製テーブル上にリラクゼーションルームの鍵が出現").replace(/Streets of Tarkov/gi,"ストリート・オブ・タルコフ").replace(/Western Repair Point Building/gi,"西側修理ポイント建物").replace(/\bReserve\b/g,"リザーブ").replace(/\bAspect\b/g,"アスペクト").replace(/\bIcebreaker\b/g,"アイスブレーカー").replace(/\bLexOs\b/g,"レクソス").replace(/\bNecrusPharm\b/g,"ネクラスファーム").replace(/\bTerraGroup\b/g,"テラグループ").replace(/\bThe Lab\b/g,"研究所");
const hasJapanese=value=>/[\u3040-\u30ff\u3400-\u9fff]/.test(String(value||""));

function plainWikiText(value){
  let text=String(value||"")
    .replace(/<!--[\s\S]*?-->/g,"")
    .replace(/<gallery\b[\s\S]*?<\/gallery>/gi,"")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>|<ref\b[^>]*\/>/gi,"")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<[^>]+>/g,"");
  for(let pass=0;pass<5&&/\{\{[^{}]+\}\}/.test(text);pass++)text=text.replace(/\{\{([^{}]+)\}\}/g,(_match,body)=>{
    const parts=String(body).split("|").map(part=>part.trim()),name=String(parts.shift()||"").toLowerCase();
    if(/^(?:cite|citation|ref|gallery|clear|map|navbox|infobox|notice|quest item|tooltip)/.test(name))return"";
    const positional=parts.filter(part=>part&&!part.includes("=")).map(part=>part.replace(/^\d+\s*=/,""));
    if(/^(?:item|quest|location|map link)/.test(name))return positional[0]||"";
    return positional.join(" ");
  });
  text=text
    .replace(/^={3,6}\s*(.*?)\s*={3,6}\s*$/gm,"【$1】")
    .replace(/\[\[(?:File|Image):[^\]]+\]\]/gi,"")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]+)?\|([^\]]+)\]\]/g,"$2")
    .replace(/\[\[([^\]#]+)(?:#[^\]]+)?\]\]/g,"$1")
    .replace(/\[(?:https?:\/\/\S+)\s+([^\]]+)\]/g,"$1")
    .replace(/\[(?:https?:\/\/[^\]]+)\]/g,"")
    .replace(/'''?|__\w+__/g,"");
  const lines=decodeEntities(text).split(/\r?\n/).map(line=>line.trim()).filter(line=>{
    if(!line||/^\s*(?:File:|Image:|Category:|\{\||\|\}|\|-|!|[a-z]{2,3}:)/i.test(line))return false;
    return !/\.(?:png|jpe?g|webp|gif)(?:\||$)/i.test(line);
  }).map(line=>line.replace(/^\*+\s*/,"・").replace(/^#+\s*/,"").replace(/^;+\s*/,"").replace(/\s+/g," "));
  return [...new Set(lines)].join("\n").trim().slice(0,2400);
}

function extractWikiSection(wikitext,title){
  const lines=String(wikitext||"").split(/\r?\n/),heading=new RegExp(`^==\\s*${title.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*==\\s*$`,"i"),start=lines.findIndex(line=>heading.test(line));
  if(start<0)return"";
  let end=lines.length;
  for(let index=start+1;index<lines.length;index++)if(/^==[^=].*[^=]==\s*$/.test(lines[index])){end=index;break}
  return plainWikiText(lines.slice(start+1,end).join("\n"));
}

const hasWikiSection=(wikitext,title)=>new RegExp(`^==\\s*${title.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\s*==\\s*$`,"mi").test(String(wikitext||""));

const extractInfoboxUsage=wikitext=>plainWikiText(String(wikitext||"").match(/^\|\s*usage\s*=\s*(.+)$/mi)?.[1]||"");
const chunks=(items,size)=>Array.from({length:Math.ceil(items.length/size)},(_,index)=>items.slice(index*size,index*size+size));

async function fetchWikiPages(titles){
  const result=new Map();
  for(const batch of chunks([...new Set(titles.filter(Boolean))],35)){
    const params=new URLSearchParams({action:"query",prop:"revisions",rvprop:"content",rvslots:"main",titles:batch.join("|"),redirects:"1",format:"json",formatversion:"2",origin:"*"}),response=await fetch(`${WIKI_API}?${params}`,{headers:{"user-agent":"Tarkov Task Extract Navi/1.2"},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error(`wiki pages ${response.status}`);
    const json=await response.json(),aliases=new Map();
    for(const entry of [...(json.query?.normalized||[]),...(json.query?.redirects||[])])aliases.set(compactTitle(entry.from),compactTitle(entry.to));
    const pages=new Map((json.query?.pages||[]).map(page=>[compactTitle(page.title),page]));
    for(const original of batch){let key=compactTitle(original);for(let hop=0;hop<4&&aliases.has(key);hop++)key=aliases.get(key);const page=pages.get(key);if(page)result.set(compactTitle(original),page)}
  }
  return result;
}

async function translateJapanese(text){
  if(!text)return"";
  for(let attempt=0;attempt<3;attempt++)try{const params=new URLSearchParams({client:"gtx",sl:"en",tl:"ja",dt:"t",q:text}),response=await fetch(`https://translate.googleapis.com/translate_a/single?${params}`,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error(String(response.status));const json=await response.json(),translated=(json[0]||[]).map(part=>part[0]||"").join("").trim();if(translated)return translated}catch{if(attempt<2)await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)))}
  return"";
}

async function mapLimit(items,limit,worker){
  const output=new Array(items.length);let cursor=0;
  await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const index=cursor++;output[index]=await worker(items[index],index)}}));
  return output;
}

async function enrichKeyCatalogWithWiki(catalog,{translate=true}={}){
  const keys=Array.isArray(catalog?.keys)?catalog.keys:[],mapDirectory=[...new Map(keys.flatMap(key=>key.mapUses||[]).map(map=>[map.nameEn,map])).values()].sort((a,b)=>String(b.nameEn).length-String(a.nameEn).length),titles=keys.map(key=>wikiTitleFromUrl(key.wiki)||key.nameEn),pages=await fetchWikiPages(titles),details=keys.map((key,index)=>{
    const title=titles[index],page=pages.get(compactTitle(title)),wikitext=page?.revisions?.[0]?.slots?.main?.content||"",lockSection=extractWikiSection(wikitext,"Lock Location"),behindSection=extractWikiSection(wikitext,"Behind the Lock"),lockLocationEn=lockSection||extractInfoboxUsage(wikitext),noUsableLock=/^none\.?$/i.test(lockLocationEn),behindLockEn=behindSection||(noUsableLock?"This item currently has no usable lock, so there are no obtainable items behind it.":lockLocationEn?"The English Wiki does not list a Behind the Lock section or specific obtainable items for this key.":"The English Wiki does not currently list a lock location or obtainable items for this item.");
    return{key,pageFound:Boolean(page&&!page.missing),lockSectionListed:hasWikiSection(wikitext,"Lock Location"),behindSectionListed:hasWikiSection(wikitext,"Behind the Lock"),lockLocationEn,behindLockEn};
  });
  const translated=translate?await mapLimit(details.filter(item=>item.lockLocationEn||item.behindLockEn),4,async item=>({id:item.key.id,lockLocation:normalizeJapaneseWikiText(await translateJapanese(item.lockLocationEn)),behindLock:normalizeJapaneseWikiText(await translateJapanese(item.behindLockEn))})):[],jaById=new Map(translated.map(item=>[item.id,item])),wikiUpdatedAt=new Date().toISOString();
  const wikiAudit={requested:titles.length,pagesFound:details.filter(item=>item.pageFound).length,lockSections:details.filter(item=>item.lockSectionListed).length,behindLockSections:details.filter(item=>item.behindSectionListed).length,lockTranslations:translated.filter(item=>item.lockLocation).length,behindLockTranslations:translated.filter(item=>item.behindLock).length};
  return{...catalog,catalogSchemaVersion:KEY_CATALOG_SCHEMA_VERSION,wikiUpdatedAt,wikiAudit,keys:details.map(({key,lockSectionListed,behindSectionListed,lockLocationEn,behindLockEn})=>{const ja=jaById.get(key.id)||{},mapUses=[...(key.mapUses||[])];for(const map of mapDirectory){const name=String(map.nameEn||""),aliases=name==="The Lab"?["The Lab","TerraGroup Labs"]:[name],mentioned=aliases.some(alias=>new RegExp(`(?:^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:$|[^a-z])`,"i").test(lockLocationEn));if(mentioned&&!mapUses.some(entry=>entry.id===map.id))mapUses.push({id:map.id,name:map.name,nameEn:map.nameEn,kind:"wiki",positions:[]})}return{...key,lockLocation:ja.lockLocation||lockLocationEn,lockLocationEn,behindLock:ja.behindLock||behindLockEn,behindLockEn,lockLocationSource:lockSectionListed?"wiki-section":"wiki-fallback",behindLockSource:behindSectionListed?"wiki-section":"wiki-not-listed",wikiUpdatedAt,mapUses}})};
}

function mergeCatalogWikiDetails(catalog,...sources){
  const byId=new Map();for(const source of sources)for(const key of source?.keys||[])if(key?.id&&!byId.has(key.id))byId.set(key.id,key);
  const sourceWithAudit=sources.find(source=>source?.wikiAudit),hasWikiSource=sources.some(source=>source?.keys?.some(key=>key?.behindLockSource));return{...catalog,catalogSchemaVersion:hasWikiSource?KEY_CATALOG_SCHEMA_VERSION:Number(catalog?.catalogSchemaVersion)||1,wikiUpdatedAt:sources.find(source=>source?.wikiUpdatedAt)?.wikiUpdatedAt||null,wikiAudit:sourceWithAudit?.wikiAudit||null,keys:(catalog?.keys||[]).map(key=>{const saved=byId.get(key.id)||{},detail={};for(const field of WIKI_FIELDS)if(saved[field])detail[field]=saved[field];const mapUses=[...(key.mapUses||[])];for(const map of saved.mapUses||[])if(map.kind==="wiki"&&!mapUses.some(entry=>entry.id===map.id))mapUses.push(map);return{...key,...detail,mapUses}})};
}

function preserveJapaneseWikiDetails(catalog,previous){
  const oldById=new Map((previous?.keys||[]).map(key=>[key.id,key]));
  return{...catalog,catalogSchemaVersion:KEY_CATALOG_SCHEMA_VERSION,keys:(catalog?.keys||[]).map(key=>{const old=oldById.get(key.id)||{},lockLocation=hasJapanese(key.lockLocation)?key.lockLocation:old.lockLocation||key.lockLocation,behindLock=hasJapanese(key.behindLock)?key.behindLock:old.behindLock||key.behindLock;return{...key,lockLocation:normalizeJapaneseWikiText(lockLocation),behindLock:normalizeJapaneseWikiText(behindLock)}})};
}

module.exports={KEY_CATALOG_SCHEMA_VERSION,WIKI_FIELDS,wikiTitleFromUrl,plainWikiText,extractWikiSection,normalizeJapaneseWikiText,enrichKeyCatalogWithWiki,mergeCatalogWikiDetails,preserveJapaneseWikiDetails};
