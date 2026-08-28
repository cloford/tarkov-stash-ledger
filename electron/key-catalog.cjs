const KEY_CATALOG_QUERY=`query KeyCatalog {
  keysJa: items(type: keys, lang: ja, gameMode: regular) {
    id name shortName description gridImageLink inspectImageLink wikiLink
    properties { ... on ItemPropertiesKey { uses } }
    usedInTasks { id name minPlayerLevel wikiLink trader { name } map { id name } }
  }
  keysEn: items(type: keys, lang: en, gameMode: regular) {
    id name shortName description gridImageLink inspectImageLink wikiLink
    properties { ... on ItemPropertiesKey { uses } }
    usedInTasks { id name minPlayerLevel wikiLink trader { name } map { id name } }
  }
  mapsJa: maps(lang: ja, gameMode: regular) { id name accessKeys { id } locks { key { id } } }
  mapsEn: maps(lang: en, gameMode: regular) { id name accessKeys { id } locks { key { id } } }
}`;

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

async function fetchKeyCatalog(){
  const base="https://json.tarkov.dev/regular/",names=["items","items_en","items_ja","tasks","tasks_en","tasks_ja","traders","traders_en","maps","maps_en","maps_ja"],docs=await Promise.all(names.map(async name=>{const response=await fetch(base+name,{headers:{"user-agent":"Tarkov Task Extract Navi/1.1"},signal:AbortSignal.timeout(45000)});if(!response.ok)throw Error(`${name} ${response.status}`);return response.json()})),[itemsDoc,itemEnDoc,itemJaDoc,tasksDoc,taskEnDoc,taskJaDoc,tradersDoc,traderEnDoc,mapsDoc,mapEnDoc,mapJaDoc]=docs,table=doc=>doc?.data||doc||{},records=(doc,key)=>Object.values(doc?.data?.[key]||doc?.data||doc?.[key]||doc||{}),items=records(itemsDoc,"items"),tasks=records(tasksDoc,"tasks"),traders=records(tradersDoc,"traders"),maps=records(mapsDoc,"maps"),itemEn=table(itemEnDoc),itemJa=table(itemJaDoc),taskEn=table(taskEnDoc),taskJa=table(taskJaDoc),traderEn=table(traderEnDoc),mapEn=table(mapEnDoc),mapJa=table(mapJaDoc),tr=(translations,key,fallback="")=>translations[key]||fallback||key||"",mapById=new Map(maps.map(map=>{const nameEn=tr(mapEn,map.name,map.normalizedName||map.id),translated=tr(mapJa,map.name,nameEn);return[map.id,{raw:map,name:mapNamesJa[nameEn]||translated,nameEn}]})),traderById=new Map(traders.map(trader=>[trader.id,tr(traderEn,trader.name,trader.normalizedName||"不明")])),mapUseByKey=new Map(),tasksByKey=new Map(),collectIds=(value,result=new Set())=>{if(typeof value==="string"&&/^[a-f0-9]{24}$/i.test(value))result.add(value);else if(Array.isArray(value))value.forEach(entry=>collectIds(entry,result));else if(value&&typeof value==="object")Object.values(value).forEach(entry=>collectIds(entry,result));return result};
  for(const map of maps){const localized=mapById.get(map.id),locksByKey=new Map();for(const lock of values(map.locks)){const keyId=usableLockKey(lock);if(!keyId)continue;const positions=locksByKey.get(keyId)||[],position=lock?.position;if(position&&Number.isFinite(Number(position.x))&&Number.isFinite(Number(position.z)))positions.push({x:Number(position.x),y:Number(position.y)||0,z:Number(position.z),type:String(lock.lockType||"door")});locksByKey.set(keyId,positions)}for(const [keyId,positions] of locksByKey){const entries=mapUseByKey.get(keyId)||[];entries.push({id:map.id,name:localized?.name||map.id,nameEn:localized?.nameEn||map.id,kind:"door",positions:uniqueBy(positions,position=>`${position.x}:${position.y}:${position.z}`)});mapUseByKey.set(keyId,entries)}const accessKeys=uniqueBy(values(map.accessKeys).map(key=>typeof key==="string"?key:key?.id).filter(Boolean),id=>id);for(const keyId of accessKeys){const entries=mapUseByKey.get(keyId)||[];entries.push({id:map.id,name:localized?.name||map.id,nameEn:localized?.nameEn||map.id,kind:"access",positions:[]});mapUseByKey.set(keyId,entries)}}
  for(const task of tasks){const taskKeys=new Set(),mapForKey=new Map();for(const needed of values(task.neededKeys)){const ids=collectIds(needed?.keys);for(const id of ids){taskKeys.add(id);if(needed?.map)mapForKey.set(id,needed.map)}}for(const objective of values(task.objectives)){const ids=collectIds(objective?.requiredKeys);for(const id of ids){taskKeys.add(id);const objectiveMap=values(objective.maps)[0]||values(objective.zones).find(zone=>zone?.map)?.map;if(objectiveMap&&!mapForKey.has(id))mapForKey.set(id,objectiveMap)}}for(const keyId of taskKeys){const mapId=mapForKey.get(keyId)||task.map,mapInfo=mapById.get(mapId),entries=tasksByKey.get(keyId)||[];entries.push({id:task.id,name:tr(taskJa,task.name,tr(taskEn,task.name,task.name)),nameEn:tr(taskEn,task.name,task.name),trader:traderById.get(task.trader)||"不明",level:Number(task.minPlayerLevel)||1,wiki:task.wikiLink||"",map:mapInfo?{id:mapId,name:mapInfo.name,nameEn:mapInfo.nameEn}:null});tasksByKey.set(keyId,entries)}}
  const keys=items.filter(item=>values(item.types).includes("keys")).map(item=>{const tasks=uniqueBy(tasksByKey.get(item.id)||[],task=>task.id),mapUses=[...(mapUseByKey.get(item.id)||[])];for(const task of tasks)if(task.map&&!mapUses.some(map=>map.id===task.map.id))mapUses.push({...task.map,kind:"task",positions:[]});const nameEn=tr(itemEn,item.name,item.normalizedName||item.id);return{id:item.id,name:tr(itemJa,item.name,nameEn),nameEn,shortName:tr(itemJa,item.shortName,tr(itemEn,item.shortName,nameEn)),description:tr(itemJa,item.description,tr(itemEn,item.description,"")),descriptionEn:tr(itemEn,item.description,""),image:item.gridImageLink||`https://assets.tarkov.dev/${item.id}-grid-image.webp`,inspectImage:item.inspectImageLink||"",wiki:item.wikiLink||"",uses:Number(item.properties?.uses||0),tasks,mapUses:uniqueBy(mapUses,map=>`${map.id}:${map.kind}`)}}).filter(key=>key.id&&key.nameEn).sort((a,b)=>a.nameEn.localeCompare(b.nameEn,"en",{sensitivity:"base"}));
  if(!keys.length)throw Error("empty key catalog");
  return{updatedAt:new Date().toISOString(),source:"tarkov.dev",keys};
}

module.exports={fetchKeyCatalog,KEY_CATALOG_QUERY,usableLockKey};
