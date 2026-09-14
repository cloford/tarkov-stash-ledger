export const normalizeKeyText=value=>String(value??"").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[^\p{L}\p{N}]/gu,"");
const WIKI_FIELDS=["lockLocation","lockLocationEn","behindLock","behindLockEn","lockLocationSource","behindLockSource","wikiUpdatedAt"];
export function mergeKeyCatalogWithBundled(runtime,bundled){const bundledKeys=Array.isArray(bundled?.keys)?bundled.keys:[],live=Array.isArray(runtime?.keys)&&runtime.keys.length?runtime:bundled,liveKeys=Array.isArray(live?.keys)?live.keys:bundledKeys,byId=new Map(bundledKeys.filter(key=>key&&typeof key==="object").map(key=>[key.id,key]));return{...bundled,...live,catalogSchemaVersion:Math.max(Number(bundled?.catalogSchemaVersion)||1,Number(live?.catalogSchemaVersion)||1),wikiUpdatedAt:bundled?.wikiUpdatedAt||live?.wikiUpdatedAt||null,wikiAudit:bundled?.wikiAudit||live?.wikiAudit||null,keys:liveKeys.filter(key=>key&&typeof key==="object").map(key=>{const included=byId.get(key.id)||{},wiki={};for(const field of WIKI_FIELDS)wiki[field]=included[field]||key[field]||"";const mapUses=Array.isArray(key.mapUses)?[...key.mapUses]:[];for(const map of Array.isArray(included.mapUses)?included.mapUses:[])if(map?.kind==="wiki"&&!mapUses.some(entry=>entry?.id===map.id))mapUses.push(map);return{...key,...wiki,mapUses}})}}
export function filterKeys(keys,{query="",map="all",usage="all"}={}){const needle=normalizeKeyText(query);return (Array.isArray(keys)?keys:[]).filter(key=>{if(!key||typeof key!=="object")return false;const tasks=Array.isArray(key.tasks)?key.tasks:[],otherTasks=Array.isArray(key.otherTasks)?key.otherTasks:[],mapUses=Array.isArray(key.mapUses)?key.mapUses:[],haystack=normalizeKeyText([key.name,key.nameEn,key.shortName,key.description,key.descriptionEn,key.lockLocationSource==="wiki-section"?key.lockLocation:"",key.lockLocationSource==="wiki-section"?key.lockLocationEn:"",key.behindLockSource==="wiki-section"?key.behindLock:"",key.behindLockSource==="wiki-section"?key.behindLockEn:"",...tasks.flatMap(task=>[task?.name,task?.nameEn,task?.trader]),...otherTasks.flatMap(task=>[task?.name,task?.nameEn,task?.trader]),...mapUses.flatMap(entry=>[entry?.name,entry?.nameEn])].join(" ")),matchesQuery=!needle||haystack.includes(needle),matchesMap=map==="all"||mapUses.some(entry=>entry?.id===map),matchesUsage=usage==="all"||(usage==="task"?tasks.length>0:tasks.length===0);return matchesQuery&&matchesMap&&matchesUsage})}

const finiteNumber=value=>typeof value==="number"&&Number.isFinite(value)?value:null;
export function keyUsesLabel(uses){const value=finiteNumber(uses);return value!==null&&value>0?`最大使用回数：${value}回`:"最大使用回数：確認できません"}
export function keyPriceRows(key){
  if(key?.priceStatus!=="available")return[];
  const prices=key?.prices&&typeof key.prices==="object"?key.prices:{},rows=[];
  const average=finiteNumber(prices.avg24hPrice);
  if(average!==null&&average>=0)rows.push({kind:"avg24h",label:"24時間平均",value:average});
  const trader=prices.traderSell&&typeof prices.traderSell==="object"?prices.traderSell:null,traderPrice=finiteNumber(trader?.priceRUB);
  if(rows.length<2&&traderPrice!==null&&traderPrice>=0)rows.push({kind:"trader",label:`${trader.vendor||"トレーダー"}売却`,value:traderPrice});
  const low=finiteNumber(prices.lastLowPrice);
  if(rows.length<2&&low!==null&&low>=0)rows.push({kind:"lastLow",label:"直近最低",value:low});
  return rows.slice(0,2);
}
export function keyTaskEvidence(key){
  const status=key?.taskRelationsStatus==="available"?"available":"unavailable";
  const required=Array.isArray(key?.tasks)?key.tasks:[],other=Array.isArray(key?.otherTasks)?key.otherTasks:[];
  return{status,required,other,requiredLabel:status==="available"?`鍵として必要：${required.length}件`:"鍵として必要：確認できません",otherLabel:status==="available"?(other.length?`その他のタスク関連：${other.length}件`:"API上のその他タスク関連登録なし"):"その他のタスク関連：確認できません"};
}
export function formatCatalogTime(value){
  if(!value)return"確認できません";
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return"確認できません";
  return new Intl.DateTimeFormat("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(date);
}
