import fs from "node:fs/promises";
import path from "node:path";

const root=process.cwd(),base="https://json.tarkov.dev/regular";
async function get(name){const response=await fetch(`${base}/${name}`);if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);return response.json()}
const [taskDoc,taskEn,hideoutDoc,hideoutEn,itemDoc,itemEn,traderDoc,traderEn,mapDoc,mapEn,taskJa,itemJa,mapJa]=await Promise.all(["tasks","tasks_en","hideout","hideout_en","items","items_en","traders","traders_en","maps","maps_en","tasks_ja","items_ja","maps_ja"].map(get));
const tasks=Object.values(taskDoc.data.tasks),stations=Object.values(hideoutDoc.data),allItems=itemDoc.data.items,traders=traderDoc.data.traders||traderDoc.data;
const ignored=new Set(["5449016a4bdc2d6f028b456f","569668774bdc2da2298b4568","5696686a4bdc2da3298b456a"]);
const translate=(table,key,fallback)=>table.data[key]||fallback;
const itemName=id=>translate(itemEn,`${id} Name`,allItems[id]?.name||id),itemShort=id=>translate(itemEn,`${id} ShortName`,allItems[id]?.shortName||id);
const traderName=id=>{const t=traders[id]||Object.values(traders).find(x=>x.id===id);return translate(traderEn,t?.name||`${id} name`,t?.name||"Other")};
const maps=mapDoc.data.maps||mapDoc.data,mapName=id=>{const m=maps[id]||Object.values(maps).find(x=>x.id===id);return translate(mapEn,m?.name||`${id} Name`,m?.normalizedName||m?.name||"")};

const questData=[],questUses=new Map();
for(const task of tasks){
 const perItem=new Map();
 for(const objective of task.objectives||[]){
  if(!["giveItem","findItem"].includes(objective.type)||objective.items?.length!==1)continue;
  const id=objective.items[0];if(ignored.has(id)||!allItems[id])continue;
  const previous=perItem.get(id)||{count:0,fir:false};
  perItem.set(id,{count:Math.max(previous.count,Number(objective.count)||1),fir:previous.fir||!!objective.foundInRaid||objective.type==="findItem"});
 }
 const taskItems=[...perItem].map(([id,value])=>({id,...value}));
 const name=translate(taskEn,`${task.id} name`,task.name);
 questData.push({id:task.id,name,trader:traderName(task.trader),level:task.minPlayerLevel||1,items:taskItems});
 for(const x of taskItems){if(!questUses.has(x.id))questUses.set(x.id,[]);questUses.get(x.id).push({name,count:x.count,foundInRaid:x.fir})}
}

const moduleData=[],hideoutUses=new Map();
for(const station of stations){
 const stationName=translate(hideoutEn,station.name,station.normalizedName||station.name);
 for(const level of station.levels||[]){
  const levelItems=(level.itemRequirements||[]).filter(x=>!ignored.has(x.item)&&allItems[x.item]).map(x=>({id:x.item,count:Number(x.count)||1}));
  moduleData.push({id:level.id,stationId:station.id,station:stationName,level:level.level,items:levelItems});
  for(const x of levelItems){if(!hideoutUses.has(x.id))hideoutUses.set(x.id,[]);hideoutUses.get(x.id).push({name:`${stationName} Lv.${level.level}`,count:x.count})}
 }
}
moduleData.sort((a,b)=>a.station.localeCompare(b.station)||a.level-b.level);

const ids=new Set([...questUses.keys(),...hideoutUses.keys()]);
const itemData=[...ids].map(id=>({id,name:itemName(id),shortName:itemShort(id),quest:(questUses.get(id)||[]).reduce((s,x)=>s+x.count,0),hideout:(hideoutUses.get(id)||[]).reduce((s,x)=>s+x.count,0),foundInRaid:(questUses.get(id)||[]).some(x=>x.foundInRaid),quests:questUses.get(id)||[],modules:hideoutUses.get(id)||[]})).sort((a,b)=>(b.quest+b.hideout)-(a.quest+a.hideout)||a.name.localeCompare(b.name));
let legacyQuestIds={},legacyModuleIds={};
try{const legacyQuests=JSON.parse(await fs.readFile(path.join(root,"work/quests.json"),"utf8"));const newQuestByName=new Map(questData.map(q=>[q.name,q.id]));legacyQuestIds=Object.fromEntries(legacyQuests.map(q=>[String(q.id),newQuestByName.get(q.title)]).filter(x=>x[1]))}catch{}
try{const legacyHideout=JSON.parse(await fs.readFile(path.join(root,"work/hideout.json"),"utf8"));const legacyStations=new Map(legacyHideout.stations.map(s=>[s.id,s.locales.en]));const newModuleByKey=new Map(moduleData.map(m=>[`${m.station.toLowerCase()}|${m.level}`,m.id]));legacyModuleIds=Object.fromEntries(legacyHideout.modules.map(m=>[String(m.id),newModuleByKey.get(`${(legacyStations.get(m.stationId)||m.module).toLowerCase()}|${m.level}`)]).filter(x=>x[1]))}catch{}
const progress={story:["Accidental Witness","Batya","Blue Fire","Boreas","Falling Skies","The Labyrinth","The Ticket","The Unheard","They Are Already Here","Tour"],quests:questData,modules:moduleData,legacyQuestIds,legacyModuleIds};
const guideTasks=tasks.map(task=>({id:task.id,name:translate(taskEn,`${task.id} name`,task.name),nameJa:translate(taskJa,`${task.id} name`,""),trader:traderName(task.trader),level:task.minPlayerLevel||1,image:task.taskImageLink||"",wiki:task.wikiLink||"",map:mapName(task.map),mapJa:translate(mapJa,(maps[task.map]?.name||""),""),experience:task.experience||0,prerequisites:(task.taskRequirements||[]).map(r=>({id:r.task,name:translate(taskEn,`${r.task} name`,r.task),nameJa:translate(taskJa,`${r.task} name`,""),status:r.status||[]})),objectives:(task.objectives||[]).map(o=>({id:o.id,type:o.type,description:translate(taskEn,o.description,translate(taskEn,o.id,o.description||o.type)),descriptionJa:translate(taskJa,o.description,translate(taskJa,o.id,"")),count:o.count||1,foundInRaid:!!o.foundInRaid,maps:(o.maps||[]).map(id=>({id,name:mapName(id),nameJa:translate(mapJa,(maps[id]?.name||""),""),slug:maps[id]?.normalizedName||""})).filter(x=>x.name),zones:(o.zones||[]).map(z=>({id:z.id,map:z.map,position:z.position||null})),items:(o.items||[]).slice(0,12).map(id=>({id,name:itemName(id),nameJa:translate(itemJa,`${id} Name`,""),shortName:itemShort(id),image:allItems[id]?.gridImageLink||""}))})),rewards:{experience:task.experience||0,items:(task.finishRewards?.items||[]).map(x=>{const id=x.item||x.id;return{id,name:itemName(id),nameJa:translate(itemJa,`${id} Name`,""),shortName:itemShort(id),count:Number(x.count)||1,image:allItems[id]?.gridImageLink||""}})}}));
const battlePass=[{id:"kord-breach-2026",name:"KORD BREACH · Season 01",season:"CURRENT SEASON",summary:"シーズン進行用の書類・設計図を集め、段階報酬を解放するバトルパス。通常タスクとは別進行です。",objectives:["レイド中にシーズン用ドキュメントを収集","必要数を確認して段階報酬をアンロック","デイリー・ウィークリー報酬も併用"],source:"https://escapefromtarkov.fandom.com/wiki/BattlePass",image:""},{id:"arena-season-1",name:"Arena BattlePass · Season 1",season:"ARCHIVE",summary:"2025年10月22日から2026年4月20日まで開催されたArena連動バトルパス。",objectives:["Arenaのチャレンジを達成","トークンを集めて報酬を解放","一部報酬はEFT本編でも使用可能"],source:"https://escapefromtarkov.fandom.com/wiki/BattlePass",image:""}];
const taskGuide={updatedAt:new Date().toISOString(),source:"json.tarkov.dev",tasks:guideTasks,story:progress.story.map((name,index)=>({id:`story-${index+1}`,name,chapter:index+1,summary:"Escape from Tarkov 1.0のメインストーリー章。ゲーム内の選択や進行によって展開が変化する場合があります。",source:"https://escapefromtarkov.fandom.com/wiki/Story_chapters"})),battlePass};

await fs.mkdir(path.join(root,"app/data"),{recursive:true});await fs.mkdir(path.join(root,"public/items"),{recursive:true});await fs.mkdir(path.join(root,"public/hideout"),{recursive:true});
await fs.writeFile(path.join(root,"app/data/items.json"),JSON.stringify(itemData,null,2));
await fs.writeFile(path.join(root,"app/data/progress.json"),JSON.stringify(progress,null,2));
await fs.writeFile(path.join(root,"app/data/task-guide.json"),JSON.stringify(taskGuide,null,2));
let imageCursor=0;async function itemWorker(){while(imageCursor<itemData.length){const item=itemData[imageCursor++],response=await fetch(allItems[item.id].gridImageLink||`https://assets.tarkov.dev/${item.id}-grid-image.webp`);if(response.ok)await fs.writeFile(path.join(root,"public/items",`${item.id}.webp`),Buffer.from(await response.arrayBuffer()))}}
await Promise.all(Array.from({length:10},itemWorker));
for(const station of stations){if(!station.imageLink)continue;const response=await fetch(station.imageLink);if(response.ok)await fs.writeFile(path.join(root,"public/hideout",`${station.id}.png`),Buffer.from(await response.arrayBuffer()))}
await fs.writeFile(path.join(root,"work/latest-data-meta.json"),JSON.stringify({updatedAt:new Date().toISOString(),source:"json.tarkov.dev",mode:"regular",tasks:questData.length,stations:stations.length,levels:moduleData.length,items:itemData.length},null,2));
console.log(JSON.stringify({tasks:questData.length,stations:stations.length,levels:moduleData.length,items:itemData.length,questTotal:itemData.reduce((s,x)=>s+x.quest,0),hideoutTotal:itemData.reduce((s,x)=>s+x.hideout,0)},null,2));
