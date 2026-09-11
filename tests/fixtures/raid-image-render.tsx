import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import type {ReactNode} from "react";
import {CachedReferenceImage, TaskMapModal} from "../../app/task-guide-page";
import {buildRaidImageTargets, saveRaidImageTargets} from "../../app/raid-image-prefetch.mjs";
import "../../app/guide.css";

const root=createRoot(document.getElementById("root")!);
const render=(element:ReactNode)=>flushSync(()=>root.render(element));
const map={id:"56f40101d2720b2a4d8b45d6",name:"Customs"};
const task={id:"fixture-task",name:"Fixture",map:"Customs",mapId:map.id,objectives:[{maps:[map]}]};
const media=[{id:"Customs_map.png",url:"https://example.com/map.png",caption:"Customs map"},{id:"Customs_room.png",url:"https://example.com/room.png",caption:"Customs room"}];
const view={taskId:task.id,map,description:"Customs"};
const pause=()=>new Promise(resolve=>setTimeout(resolve,25));
async function checkImages(selector:string,count:number,old=false){
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    const images=Array.from(document.querySelectorAll<HTMLImageElement>(selector));
    if(images.length===count&&images.every(image=>image.src.startsWith("stash-map://")&&image.complete&&image.naturalWidth>0)&&(!old||document.querySelector(".oldLocalImage")))return images.map(image=>image.src);
    await pause();
  }
  throw new Error(`保存済み画像の描画失敗: ${selector}: ${document.body.innerHTML}`);
}
Object.assign(window,{runImageRenderChecks:async()=>{
  const targets=buildRaidImageTargets([{task}],{mediaStates:{[task.id]:{status:"ready",images:media}}});
  const saved=await saveRaidImageTargets(targets.all.map((item:any)=>({...item,status:"pending"})),window.stashAI!.cacheMapImage!);
  if(saved.length!==3||saved.some((item:any)=>item.status!=="saved"))throw new Error("描画検証用の事前保存が失敗しました");
  render(<section className="locationMedia"><CachedReferenceImage taskId={task.id} image={media[0]} loading="eager"/></section>);
  const normal=await checkImages(".locationMedia img",1);
  render(<TaskMapModal view={view} media={media} mediaLoading={false} wiki="" onClose={()=>{}}/>);
  const specific=await checkImages(".taskMapCanvas img",1),landmarks=await checkImages(".taskLandmarks img",1);
  if(document.querySelector<HTMLAnchorElement>(".taskLandmarks a")?.href!==media[1].url)throw new Error("原寸表示リンクが変更されました");
  render(<TaskMapModal view={view} media={[]} mediaLoading={false} wiki="" onClose={()=>{}}/>);
  const baseline=await checkImages(".taskMapCanvas img",1);
  // 同じ提供元IDのURL更新後にonline取得を失敗させ、保存済み旧版へフォールバックする。
  render(<TaskMapModal view={view} media={media.map(image=>({...image,url:image.url+"?revision=2"}))} mediaLoading={false} wiki="" onClose={()=>{}}/>);
  const stale=await checkImages(".taskMapCanvas img",1,true);
  await checkImages(".taskLandmarks img",1,true);
  const canvas=document.querySelector(".taskMapCanvas")!,badge=canvas.querySelector(".oldLocalImage")!;
  if(getComputedStyle(badge).position!=="absolute"||canvas.clientHeight!==canvas.querySelector("img")!.clientHeight)throw new Error("旧版表示がマップの座標領域を変えています");
  return {normal,specific,landmarks,baseline,stale};
}});
