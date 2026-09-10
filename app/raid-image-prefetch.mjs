import {mapImageCacheId, mapSelectionKey, primaryMapVariant} from "./map-images.mjs";
import {taskMapReferences} from "./raid-prep-utils.mjs";

const array=value=>Array.isArray(value)?value:[];
const text=value=>typeof value==="string"?value.trim():"";
const taskName=task=>text(task?.nameJa)||text(task?.name)||"名称不明のタスク";
const urlKey=value=>{try{const url=new URL(String(value||""));url.hash="";return url.toString();}catch{return""}};
const shortHash=value=>{let hash=2166136261;for(const char of String(value)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return(hash>>>0).toString(36)};
export const taskMediaCacheId=(_taskId,image)=>`task-media-${text(image?.id)||shortHash(text(image?.caption)||urlKey(image?.url))}`;
const statusFromCache=result=>result?.cached?(result.stale?"update":"saved"):"pending";

export function buildRaidImageTargets(entries,{mapSelections={},mediaStates={}}={}){
  const resolved=array(entries).filter(entry=>entry?.task),maps=[],mapKeys=new Set(),images=[],imageKeys=new Set(),unavailable=[];
  for(const {task} of resolved){
    for(const map of taskMapReferences(task)){
      const key=mapSelectionKey(map).toLowerCase();if(!key||mapKeys.has(key))continue;mapKeys.add(key);
      const selected=mapSelections[mapSelectionKey(map)],variant=selected?.url?selected:primaryMapVariant(map),source=urlKey(variant.url);
      if(!source){unavailable.push({id:`map-unavailable-${key}`,kind:"map",label:map.nameJa||map.label||map.name,status:"unavailable",detail:"保存対象の画像URLを確認できません"});continue;}
      maps.push({id:`map:${mapImageCacheId(map,variant.id)}`,cacheId:mapImageCacheId(map,variant.id),kind:"map",label:map.nameJa||map.label||map.name,detail:variant.primary?"基準版":variant.title||variant.kind||"選択版",source,status:"checking"});
    }
    const mediaState=mediaStates[task.id];
    if(!mediaState||mediaState.status==="loading")continue;
    if(mediaState.status==="failed"){unavailable.push({id:`task-unavailable-${task.id}`,kind:"task",label:taskName(task),detail:"参考画像を取得できません",status:"unavailable"});continue;}
    const taskImages=array(mediaState.images);
    if(!taskImages.length){unavailable.push({id:`task-empty-${task.id}`,kind:"task",label:taskName(task),detail:"直接関連する画像URLはありません",status:"excluded"});continue;}
    for(const image of taskImages){
      const source=urlKey(image?.url),key=text(image?.id)||source;if(!source||!key||imageKeys.has(key))continue;imageKeys.add(key);
      images.push({id:`task:${key}`,cacheId:taskMediaCacheId(task.id,image),kind:"task",label:text(image.caption)||taskName(task),detail:taskName(task),source,status:"checking"});
    }
  }
  return{maps,images,unavailable,all:[...maps,...images,...unavailable]};
}

export function summarizeRaidImageTargets(targets){
  const all=array(targets),count=status=>all.filter(item=>item.status===status).length;
  return{total:all.filter(item=>!["excluded","unavailable"].includes(item.status)).length,saved:count("saved"),pending:count("pending"),saving:count("saving"),failed:count("failed"),unavailable:count("unavailable")+count("excluded"),update:count("update")};
}

export async function inspectRaidImageTargets(targets,cache,{concurrency=3,onState=()=>{}}={}){
  return runLimited(array(targets).filter(item=>item.source),concurrency,async item=>{try{const result=await cache(item.source,item.cacheId,false),next={...item,status:statusFromCache(result),cache:result};onState(next);return next;}catch(error){const next={...item,status:"pending",error:String(error?.message||error)};onState(next);return next;}});
}

export async function saveRaidImageTargets(targets,cache,{concurrency=3,retryOnly=false,onState=()=>{}}={}){
  const allowed=retryOnly?new Set(["failed"]):new Set(["pending","update"]),queue=array(targets).filter(item=>item.source&&allowed.has(item.status));
  return runLimited(queue,concurrency,async item=>{onState({...item,status:"saving",error:""});try{const result=await cache(item.source,item.cacheId,true),success=result?.cached&&!result.stale&&!result.error,next=success?{...item,status:"saved",cache:result,error:""}:{...item,status:"failed",cache:result,error:result?.error||"保存できませんでした",oldLocal:Boolean(result?.cached)};onState(next);return next;}catch(error){const next={...item,status:"failed",error:String(error?.message||error)};onState(next);return next;}});
}

async function runLimited(items,limit,worker){const results=new Array(items.length),next={index:0};async function run(){while(next.index<items.length){const index=next.index++;results[index]=await worker(items[index]);}}await Promise.all(Array.from({length:Math.min(Math.max(1,limit),items.length)},run));return results;}

export function resolveCachedImage(result,remoteUrl){if(result?.cached&&!result.stale)return{url:result.url,source:"current-local"};if(result?.cached&&result.stale)return{url:result.url,source:"old-local"};return{url:remoteUrl,source:"online"};}
