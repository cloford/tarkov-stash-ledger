const values=value=>Array.isArray(value)?value:[];
const uniqueBy=(items,key)=>[...new Map(items.map(item=>[key(item),item])).values()];
const FACTORY_EXIT_KEY_ID="5448ba0b4bdc2d02308b456c";

// tarkov.dev の生マップでは、鍵が個別設定されていない一部の車両トランクにも
// Factory 非常口の鍵 ID が既定値として入る。実際の用途ではないため除外する。
const usableLockKey=lock=>{
  const keyId=typeof lock?.key==="string"?lock.key:lock?.key?.id;
  return keyId===FACTORY_EXIT_KEY_ID&&lock?.lockType==="trunk"?null:keyId;
};

const mapNamesJa={"Ground Zero":"グラウンドゼロ","Streets of Tarkov":"ストリート・オブ・タルコフ",Customs:"カスタム",Woods:"ウッズ",Interchange:"インターチェンジ",Factory:"ファクトリー","Night Factory":"夜間ファクトリー",Reserve:"リザーブ",Lighthouse:"ライトハウス",Shoreline:"ショアライン","The Lab":"研究所",Terminal:"ターミナル",Icebreaker:"アイスブレーカー","The Labyrinth":"ラビリンス"};
const table=doc=>doc?.data||doc||{};
const records=(doc,key)=>Object.values(doc?.data?.[key]||doc?.data||doc?.[key]||doc||{});
const tr=(translations,key,fallback="")=>translations?.[key]||fallback||key||"";
const itemId=value=>typeof value==="string"?value:value?.id;

// requiredKeys は「外側の配列が AND、各内側配列が OR」。配列以外を推測で
// グループ化せず、確認できた構造だけを保持する。
const requiredKeyGroups=value=>values(value).map(group=>values(group).map(itemId).filter(Boolean)).filter(group=>group.length);

function buildKeyCatalog(documents,{fetchedAt=new Date().toISOString()}={}){
  const itemsDoc=documents?.items;
  if(!itemsDoc)throw Error("items unavailable");
  const items=records(itemsDoc,"items");
  if(!items.length)throw Error("empty items response");
  const tasksAvailable=Boolean(documents?.tasks),mapsAvailable=Boolean(documents?.maps),tasks=tasksAvailable?records(documents.tasks,"tasks"):[],maps=mapsAvailable?records(documents.maps,"maps"):[];
  const itemEn=table(documents?.items_en),itemJa=table(documents?.items_ja),taskEn=table(documents?.tasks_en),taskJa=table(documents?.tasks_ja),traderEn=table(documents?.traders_en),mapEn=table(documents?.maps_en),mapJa=table(documents?.maps_ja);
  const mapById=new Map(maps.map(map=>{const nameEn=tr(mapEn,map.name,map.normalizedName||map.id),translated=tr(mapJa,map.name,nameEn);return[map.id,{raw:map,name:mapNamesJa[nameEn]||translated,nameEn}]}));
  const traders=documents?.traders?records(documents.traders,"traders"):[];
  const traderById=new Map(traders.map(trader=>[trader.id,tr(traderEn,trader.name,trader.normalizedName||trader.name||"不明")]));
  const taskById=new Map(tasks.map(task=>[task.id,task]));
  const mapUseByKey=new Map(),requiredTasksByKey=new Map();

  if(mapsAvailable)for(const map of maps){
    const localized=mapById.get(map.id),locksByKey=new Map();
    for(const lock of values(map.locks)){
      const keyId=usableLockKey(lock);if(!keyId)continue;
      const positions=locksByKey.get(keyId)||[],position=lock?.position;
      if(position&&Number.isFinite(Number(position.x))&&Number.isFinite(Number(position.z)))positions.push({x:Number(position.x),y:Number(position.y)||0,z:Number(position.z),type:String(lock.lockType||"door")});
      locksByKey.set(keyId,positions);
    }
    for(const [keyId,positions] of locksByKey){const entries=mapUseByKey.get(keyId)||[];entries.push({id:map.id,name:localized?.name||map.id,nameEn:localized?.nameEn||map.id,kind:"door",positions:uniqueBy(positions,position=>`${position.x}:${position.y}:${position.z}`)});mapUseByKey.set(keyId,entries)}
    const accessKeys=uniqueBy(values(map.accessKeys).map(itemId).filter(Boolean),id=>id);
    for(const keyId of accessKeys){const entries=mapUseByKey.get(keyId)||[];entries.push({id:map.id,name:localized?.name||map.id,nameEn:localized?.nameEn||map.id,kind:"access",positions:[]});mapUseByKey.set(keyId,entries)}
  }

  if(tasksAvailable)for(const task of tasks){
    for(const [objectiveIndex,objective] of values(task.objectives).entries()){
      const groups=requiredKeyGroups(objective?.requiredKeys);
      for(const [groupIndex,keyIds] of groups.entries())for(const keyId of keyIds){
        const entries=requiredTasksByKey.get(keyId)||[],existing=entries.find(entry=>entry.id===task.id),objectiveId=objective?.id||`${task.id}:objective:${objectiveIndex}`;
        const mapId=values(objective?.maps).map(itemId).find(Boolean)||values(objective?.zones).map(zone=>itemId(zone?.map)).find(Boolean)||itemId(task.map),mapInfo=mapById.get(mapId);
        const occurrence={objectiveId,groupIndex,keyIds:[...keyIds],alternative:keyIds.length>1};
        if(existing){if(!existing.requirements.some(entry=>entry.objectiveId===objectiveId&&entry.groupIndex===groupIndex))existing.requirements.push(occurrence);if(!existing.map&&mapInfo)existing.map={id:mapId,name:mapInfo.name,nameEn:mapInfo.nameEn}}
        else entries.push({id:task.id,name:tr(taskJa,task.name,tr(taskEn,task.name,task.name)),nameEn:tr(taskEn,task.name,task.name),trader:traderById.get(itemId(task.trader))||"不明",level:Number(task.minPlayerLevel)||1,wiki:task.wikiLink||"",map:mapInfo?{id:mapId,name:mapInfo.name,nameEn:mapInfo.nameEn}:null,requirements:[occurrence]});
        requiredTasksByKey.set(keyId,entries);
      }
    }
  }

  const taskSummary=task=>{const raw=typeof task==="string"?taskById.get(task):taskById.get(task?.id)||task,id=itemId(raw)||itemId(task);if(!id)return null;const mapId=itemId(raw?.map),mapInfo=mapById.get(mapId);return{id,name:tr(taskJa,raw?.name,tr(taskEn,raw?.name,raw?.name||id)),nameEn:tr(taskEn,raw?.name,raw?.name||id),trader:traderById.get(itemId(raw?.trader))||"不明",level:Number(raw?.minPlayerLevel)||1,wiki:raw?.wikiLink||"",map:mapInfo?{id:mapId,name:mapInfo.name,nameEn:mapInfo.nameEn}:null}};
  const sellerName=vendor=>traderById.get(itemId(vendor))||tr(traderEn,vendor?.name,vendor?.normalizedName||vendor?.name||"トレーダー");
  const keys=items.filter(item=>values(item.types).includes("keys")).map(item=>{
    const tasks=uniqueBy((requiredTasksByKey.get(item.id)||[]).map(task=>({...task,objectiveCount:new Set(task.requirements.map(entry=>entry.objectiveId)).size,alternative:task.requirements.some(entry=>entry.alternative)})),task=>task.id);
    const requiredIds=new Set(tasks.map(task=>task.id)),otherTasks=tasksAvailable?uniqueBy(values(item.usedInTasks).map(taskSummary).filter(Boolean).filter(task=>!requiredIds.has(task.id)),task=>task.id):[];
    const mapUses=[...(mapUseByKey.get(item.id)||[])];
    for(const task of tasks)if(task.map&&!mapUses.some(map=>map.id===task.map.id&&map.kind==="task"))mapUses.push({...task.map,kind:"task",positions:[]});
    const traderSell=values(item.sellFor).map(entry=>({vendor:sellerName(entry.vendor),priceRUB:Number.isFinite(Number(entry.priceRUB))?Number(entry.priceRUB):null})).filter(entry=>entry.priceRUB!==null).sort((a,b)=>b.priceRUB-a.priceRUB)[0]||null;
    const nameEn=tr(itemEn,item.name,item.normalizedName||item.id),rawUses=item.properties?.uses,uses=typeof rawUses==="number"&&Number.isFinite(rawUses)?rawUses:null;
    return{id:item.id,name:tr(itemJa,item.name,nameEn),nameEn,shortName:tr(itemJa,item.shortName,tr(itemEn,item.shortName,nameEn)),description:tr(itemJa,item.description,tr(itemEn,item.description,"")),descriptionEn:tr(itemEn,item.description,""),image:item.gridImageLink||`https://assets.tarkov.dev/${item.id}-grid-image.webp`,inspectImage:item.inspectImageLink||"",wiki:item.wikiLink||"",uses,priceStatus:"available",prices:{avg24hPrice:Number.isFinite(item.avg24hPrice)?item.avg24hPrice:null,lastLowPrice:Number.isFinite(item.lastLowPrice)?item.lastLowPrice:null,low24hPrice:Number.isFinite(item.low24hPrice)?item.low24hPrice:null,traderSell},taskRelationsStatus:tasksAvailable?"available":"unavailable",mapUsesStatus:mapsAvailable?"available":"unavailable",tasks,otherTasks,mapUses:uniqueBy(mapUses,map=>`${map.id}:${map.kind}`)};
  }).filter(key=>key.id&&key.nameEn).sort((a,b)=>a.nameEn.localeCompare(b.nameEn,"en",{sensitivity:"base"}));
  if(!keys.length)throw Error("empty key catalog");
  return{catalogSchemaVersion:5,updatedAt:fetchedAt,source:"tarkov.dev",gameMode:"regular",categoryStatus:{prices:"available",tasks:tasksAvailable?"available":"unavailable",maps:mapsAvailable?"available":"unavailable"},keys};
}

async function fetchDocument(base,name,{required=false}={}){
  try{const response=await fetch(base+name,{headers:{"user-agent":"Tarkov Task Extract Navi/1.1"},signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(`${name} ${response.status}`);return await response.json()}
  catch(error){if(required)throw error;return null}
}

async function fetchKeyCatalog(){
  const base="https://json.tarkov.dev/regular/",names=["items","items_en","items_ja","tasks","tasks_en","tasks_ja","traders","traders_en","maps","maps_en","maps_ja"],entries=await Promise.all(names.map(name=>fetchDocument(base,name,{required:name==="items"}))),documents=Object.fromEntries(names.map((name,index)=>[name,entries[index]]));
  return buildKeyCatalog(documents);
}

module.exports={buildKeyCatalog,fetchKeyCatalog,requiredKeyGroups,usableLockKey};
