import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {selectTaskReferenceImages} from "../app/task-media.mjs";
import {filterKeys,mergeKeyCatalogWithBundled} from "../app/key-wiki-utils.mjs";
import {mapLocation,normalizeMapEntries,sameMapLocation} from "../app/map-normalization.mjs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url),{variantKind}=require("../electron/map-variants.cjs"),{usableLockKey}=require("../electron/key-catalog.cjs"),{KEY_CATALOG_SCHEMA_VERSION,extractWikiSection,mergeCatalogWikiDetails,plainWikiText}=require("../electron/key-wiki-details.cjs");

test("派生マップを基準マップへ正規化し、未知IDは統合しない",()=>{
 const entries=normalizeMapEntries([
  {id:"55f2d3fd4bdc2d5f408b4567",name:"Factory",nameJa:"Factory"},
  {id:"59fc81d786f774390775787e",name:"Night Factory",nameJa:"Night Factory"},
  {id:"653e6760052c01c1c805532f",name:"Ground Zero"},
  {id:"65b8d6f5cdde2479cb2a3125",name:"Ground Zero 21+"},
  {id:"68236e8153654e8c1200798a",name:"Ground Zero Tutorial"},
  {id:"5b0fc42d86f7744a585f9105",name:"The Lab"},
  {id:"6a294a5b5eb5f9a1700417b7",name:"The Lab (Dark)"}
 ]);
 assert.deepEqual(entries.map(map=>[map.id,map.name,map.nameJa,map.label]),[
  ["55f2d3fd4bdc2d5f408b4567","Factory","ファクトリー","ファクトリー"],
  ["653e6760052c01c1c805532f","Ground Zero","グラウンドゼロ","グラウンドゼロ"],
  ["5b0fc42d86f7744a585f9105","The Lab","研究所","研究所"]
 ]);
 assert.deepEqual(entries.map(map=>map.nameJa || map.name),["ファクトリー","グラウンドゼロ","研究所"]);
 assert.deepEqual(entries[0].sourceIds.sort(),["55f2d3fd4bdc2d5f408b4567","59fc81d786f774390775787e"].sort());
 assert.equal(sameMapLocation({id:"59fc81d786f774390775787e"},{id:"55f2d3fd4bdc2d5f408b4567"}),true);
 assert.equal(sameMapLocation({id:"future-map",name:"Factory"},{id:"55f2d3fd4bdc2d5f408b4567"}),false);
 assert.deepEqual(mapLocation({id:"future-map",name:"Factory",nameJa:"未来の工場"}),{id:"future-map",name:"Factory",nameJa:"未来の工場",label:"未来の工場",slug:"",sourceIds:["future-map"]});
 assert.equal(sameMapLocation({id:"future-terminal",name:"Terminal"},{name:"Terminal"}),true);
});

const [page,css,main,preload,keyWiki,mapsCache,keyCatalog,desktopMain,keyWikiV21,mapV21,keyWikiV22,packageJson]=await Promise.all([
 readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
 readFile(new URL("../app/map.css",import.meta.url),"utf8"),
 readFile(new URL("../electron/main.cjs",import.meta.url),"utf8"),
 readFile(new URL("../electron/preload.cjs",import.meta.url),"utf8"),
 readFile(new URL("../app/key-wiki.tsx",import.meta.url),"utf8"),
 readFile(new URL("../app/data/maps-cache-v3.json",import.meta.url),"utf8"),
 readFile(new URL("../app/data/key-catalog.json",import.meta.url),"utf8"),
 readFile(new URL("../desktop/main.tsx",import.meta.url),"utf8"),
 readFile(new URL("../app/key-wiki-v21.css",import.meta.url),"utf8"),
 readFile(new URL("../app/map-v21.css",import.meta.url),"utf8"),
 readFile(new URL("../app/key-wiki-v22.css",import.meta.url),"utf8"),
 readFile(new URL("../package.json",import.meta.url),"utf8")
]);

test("正規化したマップを一覧・詳細データ照合・目的地座標へ適用する",()=>{
 assert.match(page,/function taskLocations\(task: any\) \{[^\n]+normalizeMapEntries\(entries\)/);
 assert.match(page,/function taskMapReferences\(task: any\) \{[^\n]+normalizeMapEntries\(entries\)/);
 assert.match(page,/latest\.find\(x => sameMapLocation\(x, selected\)\)/);
 assert.match(page,/objective\.maps \|\| \[\]\)\.some\(\(candidate: any\) => sameMapLocation\(candidate, map\)\)/);
 assert.match(page,/mapIds = map\.sourceIds \|\| \[map\.id\]/);
});

test("タスク・マップ・鍵Wikiだけを表示する",()=>{
 assert.match(page,/\[\["guide",\s*"タスク情報"\],\s*\["maps",\s*"MAP"\],\s*\["keys",\s*"鍵WIKI"\]\]/);
 assert.doesNotMatch(page,/このタスクを完了済にする|アイテム情報|ハイドアウト/);
 assert.doesNotMatch(page,/function MapHub\s*\(/);
 assert.doesNotMatch(page,/extractFieldNote|方角・階層|画像でたどる脱出ルート|周辺の目印/);
});

test("英語Wikiの別マップを機能付き基準版と分離する",()=>{
 assert.match(main,/ipcMain\.handle\("maps:variants"/);
 assert.match(preload,/mapVariants:map=>ipcRenderer\.invoke\("maps:variants",map\)/);
 assert.match(page,/マップ画像を切り替え/);
 assert.match(page,/脱出地点対応マップへ戻す/);
 assert.match(page,/activeVariant\.primary \? primaryVisual/);
 assert.match(page,/位置表示は基準版のみ/);
 assert.match(css,/\.mapVariantPicker\{/);
 assert.equal(variantKind("Reserve underground map.png"),"地下・屋内");
 assert.equal(variantKind("Customs 3D Map.jpg"),"3D");
 assert.equal(variantKind("Factory plan map.png"),"ゲーム内地図");
});

test("鍵Wikiで鍵名・タスク名・マップ名を横断検索できる",()=>{
 const catalog=JSON.parse(keyCatalog),keys=catalog.keys;
 assert.equal(catalog.catalogSchemaVersion,KEY_CATALOG_SCHEMA_VERSION);
 assert.ok(keys.length>=200);
 assert.ok(keys.some(key=>key.tasks.length>0));
 assert.ok(keys.some(key=>key.mapUses.length>0));
 assert.ok(filterKeys(keys,{query:"factory emergency exit"}).some(key=>key.nameEn==="Factory emergency exit key"));
 assert.ok(filterKeys(keys,{query:"factoryemergencyexit"}).some(key=>key.nameEn==="Factory emergency exit key"));
 assert.ok(filterKeys(keys,{query:"Corporate Perks"}).some(key=>key.tasks.some(task=>task.nameEn==="Corporate Perks")));
 assert.ok(filterKeys(keys,{query:"corporateperks"}).some(key=>key.tasks.some(task=>task.nameEn==="Corporate Perks")));
 assert.ok(filterKeys(keys,{query:"customs"}).some(key=>key.mapUses.some(map=>map.nameEn==="Customs")));
 assert.ok(filterKeys(keys,{usage:"task"}).every(key=>key.tasks.length>0));
 const factoryKey="5448ba0b4bdc2d02308b456c";
 assert.equal(usableLockKey({key:factoryKey,lockType:"trunk"}),null);
 assert.equal(usableLockKey({key:factoryKey,lockType:"door"}),factoryKey);
 assert.deepEqual(keys.find(key=>key.id===factoryKey).mapUses.map(map=>map.nameEn).sort(),["Customs","Factory","Night Factory"]);
 assert.match(main,/ipcMain\.handle\("keys:latest"/);
 assert.match(main,/ipcMain\.handle\("keys:refresh-online"/);
 assert.match(preload,/keys:\(\)=>ipcRenderer\.invoke\("keys:latest"\)/);
 assert.match(keyWiki,/使用するタスク/);
 assert.match(keyWiki,/QUICK DECISION/);
 assert.match(keyWiki,/タスク用に保管/);
 assert.match(keyWiki,/最大 \$\{selected\.uses\}回使用/);
 assert.doesNotMatch(keyWiki,/keyMapUses|onOpenMap|位置を見る ›/);
 assert.match(keyWiki,/onOpenTask/);
 assert.match(desktopMain,/app\/key-wiki\.css/);
 assert.match(desktopMain,/app\/key-wiki-v21\.css/);
 assert.match(desktopMain,/app\/key-wiki-v22\.css/);
 assert.match(keyWikiV21,/\.keyDecision\.keep/);
 const keysWithPositions=keys.filter(key=>key.mapUses.some(map=>map.positions?.length));
 assert.ok(keysWithPositions.length>=100);
 const keysWithLockLocation=keys.filter(key=>key.lockLocationSource==="wiki-section");
 const keysWithBehindLock=keys.filter(key=>key.behindLockSource==="wiki-section");
 assert.ok(keysWithLockLocation.length>=235);
 assert.ok(keysWithBehindLock.length>=220);
 assert.equal(keys.filter(key=>key.behindLockEn).length,keys.length);
 assert.ok(keys.every(key=>["wiki-section","wiki-not-listed"].includes(key.behindLockSource)));
 assert.ok(keysWithBehindLock.every(key=>!/(?:\{\{|\[\[|File:|Category:|^===)/m.test(key.behindLockEn)));
 const wikiAudit=JSON.parse(keyCatalog).wikiAudit;
 assert.equal(wikiAudit.pagesFound,247);
 assert.equal(wikiAudit.behindLockSections,keysWithBehindLock.length);
 assert.equal(wikiAudit.lockTranslations,keys.filter(key=>key.lockLocationEn).length);
 assert.equal(wikiAudit.behindLockTranslations,keys.filter(key=>key.behindLockEn).length);
 const hasJapanese=value=>/[\u3040-\u30ff\u3400-\u9fff]/.test(String(value||""));
 assert.ok(keys.filter(key=>key.lockLocationEn).every(key=>hasJapanese(key.lockLocation)&&key.lockLocation!==key.lockLocationEn));
 assert.ok(keys.filter(key=>key.behindLockEn).every(key=>hasJapanese(key.behindLock)&&key.behindLock!==key.behindLockEn));
 assert.ok(keys.every(key=>!/(?:Loose loot|Relaxation room key spawn location|Streets of Tarkov|Western Repair Point Building)/i.test(`${key.lockLocation}\n${key.behindLock}`)));
 assert.ok(filterKeys(keys,{query:"grenade box"}).some(key=>key.behindLockEn?.includes("Grenade box")));
 assert.ok(keys.find(key=>key.nameEn==="Military checkpoint key").mapUses.some(map=>map.nameEn==="Customs"&&map.kind==="wiki"));
 assert.match(keyWiki,/鍵を使う場所/);
 assert.match(keyWiki,/locationMaps=selected/);
 assert.match(keyWiki,/使用場所の対応マップ/);
 assert.match(keyWiki,/対応マップ/);
 assert.match(keyWiki,/開錠先で入手・利用できるもの/);
 assert.match(keyWiki,/節の記載なし/);
 assert.match(keyWikiV22,/\.keyWikiIntel/);
 assert.match(keyWikiV22,/\.keyLocationMaps/);
 assert.equal(extractWikiSection("==Lock Location==\nDoor on [[Customs]].\n==Behind the Lock==\n* 2x {{Item|Grenade box}}","Lock Location"),"Door on Customs.");
 assert.equal(plainWikiText("* 2x {{Item|Grenade box}}"),"・2x Grenade box");
});

test("古い鍵キャッシュでもBehind the Lockを保持する",()=>{
 const catalog=JSON.parse(keyCatalog),keys=catalog.keys;
 const stale={keys:keys.map(({id,name,nameEn,mapUses})=>({id,name,nameEn,mapUses:(mapUses||[]).filter(map=>map.kind!=="wiki")}))};
 const clientMerged=mergeKeyCatalogWithBundled(stale,catalog);
 const mainMerged=mergeCatalogWikiDetails(stale,catalog,stale);
 const expectedBehind=keys.filter(key=>key.behindLockSource==="wiki-section").length;
 assert.equal(clientMerged.keys.filter(key=>key.behindLockEn).length,keys.length);
 assert.equal(clientMerged.keys.filter(key=>key.behindLockSource==="wiki-section").length,expectedBehind);
 assert.equal(mainMerged.catalogSchemaVersion,KEY_CATALOG_SCHEMA_VERSION);
 assert.equal(mainMerged.keys.filter(key=>key.behindLockEn).length,keys.length);
 assert.equal(mainMerged.keys.filter(key=>key.behindLockSource==="wiki-section").length,expectedBehind);
 assert.match(main,/wikiCoverage/);
 assert.match(main,/mergeCatalogWikiDetails\(base,included,saved\)/);
 assert.match(main,/mergeCatalogWikiDetails\(await fetchKeyCatalog\(\),included,saved\)/);
 assert.match(keyWiki,/mergeKeyCatalogWithBundled\(value,initial\)/);
 assert.doesNotMatch(keyWiki,/wikiTranslations|api\.translate\(texts\)/);
 assert.match(keyWiki,/selected\.lockLocation\|\|selected\.lockLocationEn/);
 assert.match(keyWiki,/selected\.behindLock\|\|selected\.behindLockEn/);
 assert.ok(JSON.parse(packageJson).build.files.includes("app/data/key-catalog.json"));
});

test("鍵位置・安定したマップタイトル・タスク一覧への戻り先を保持する",()=>{
 assert.match(page,/type KeyMapFocus/);
 assert.match(page,/className="keyLocationMarker"/);
 assert.match(page,/鍵の使用場所/);
 assert.match(page,/stableVariantTitle/);
 assert.match(page,/位置表示は基準版のみ/);
 assert.match(page,/selectedTrader \? openGuide\("list", "", selectedTrader\) : openGuide\("directory", "", ""\)/);
 assert.match(page,/5704e4dad2720bb55b8b4567/);
 assert.doesNotMatch(page,/5704e4dad2720bc5b8b4567/);
 assert.match(mapV21,/\.keyLocationMarker/);
 assert.match(mapV21,/\.keyMapPreview/);
 assert.match(desktopMain,/app\/map-v21\.css/);
});

test("全マップ共通の強調表示修正を保持する",()=>{
 assert.match(page,/replace\(\/\[・･\]\/g,\s*""\)/);
 assert.match(page,/ruafroadblock:\s*\{left:\s*54\.24,\s*top:\s*74\.89\}/);
 assert.match(page,/"name:thelabyrinth"\s*:\s*\{/);
 assert.match(page,/thewayup:\s*\{/);
 assert.match(page,/ariadnespath:\s*\{/);
 assert.match(page,/nearkamchatskayaarch:\s*\{left:\s*47\.11,\s*top:\s*33\.7/);
 assert.match(page,/hangargate:\s*\{left:\s*71\.64,\s*top:\s*77\.32/);
 assert.match(page,/thewayup:\s*\{left:\s*79,\s*top:\s*43\.7/);
 assert.match(page,/nakatanibasementstairs:\s*\{[^\n]*parts:\s*\[/);
 assert.match(page,/type MapAnnotation\s*=\s*\{focusPoint:/);
 assert.match(page,/labelBounds:\s*PixelRect\[\]/);
 assert.match(page,/hitBounds:\s*PixelRect\[\]/);
 assert.match(page,/className="mapAnnotationOverlay"/);
 assert.match(page,/className="printedLabelFrame"/);
 assert.match(page,/className="annotationHitTarget"/);
 assert.match(page,/vectorEffect="non-scaling-stroke"/);
 assert.match(page,/ruafroadblock:\s*\{left:\s*66\.8,\s*top:\s*32\.75,\s*width:\s*4\.1,\s*height:\s*2\.7/);
 assert.doesNotMatch(page,/PRINTED_LABEL_FRAME_SCALE|printedLabelMarker/);
 assert.doesNotMatch(page,/holeinthefence:\s*\{/);
 assert.match(page,/marker\.offsetLeft\s*-\s*viewport\.clientWidth\s*\/\s*2/);
 assert.doesNotMatch(page,/marker\.offsetLeft\s*\+\s*marker\.offsetWidth\s*\/\s*2/);
 assert.match(page,/event\.deltaY\s*<\s*0\s*\?\s*\.2\s*:\s*-\.2/);
 assert.match(page,/ホイール上で拡大/);
 assert.match(page,/ホイール下で縮小/);
 assert.match(css,/overscroll-behavior:\s*none/);
 assert.match(css,/\.printedLabelFrame\{[^}]*fill:none/);
 assert.match(css,/\.annotationHitTarget\{[^}]*background:transparent/);
 assert.doesNotMatch(css,/\.printedLabelMarker|inset 0 0 8px/);
 assert.match(main,/ipcMain\.handle\("maps:latest"/);
 assert.match(main,/ipcMain\.handle\("maps:refresh-online"/);
 assert.match(main,/ipcMain\.handle\("task:media"/);
 assert.match(main,/iiprop=url\|mime\|size/);
 assert.match(main,/names\.map\(name=>"File:"\+name\)\.join\("\|"\)/);
 assert.match(main,/createHash\("sha256"\)/);
 const bundled=JSON.parse(mapsCache);
 assert.ok(Array.isArray(bundled.maps) && bundled.maps.length >= 13);
 assert.ok(bundled.maps.every(map=>Array.isArray(map.extracts)));
});

test("サブタスクの並べ替え・グループ・ANY MAPを保持する",()=>{
 assert.match(page,/名前順 A–Z/);
 assert.match(page,/マップ別/);
 assert.match(page,/トレーダー別/);
 assert.match(page,/場所指定なし（ANY MAP）/);
});

test("サブタスク検索とマップ表示の回帰を防ぐ",()=>{
 assert.match(page,/function normalizeTaskGuide[^\n]+objectiveMapsFor\(task, objective\)/);
 assert.match(page,/function objectiveMapsFor\(/);
 assert.match(page,/mediaLoading=\{false\}/);
 assert.match(page,/const mapBounds:\s*Record<string/);
 assert.match(page,/normalizeSearchText\(search\)/);
 assert.ok(page.includes('.replace(/[^\\p{L}\\p{N}]/gu, "")'));
 assert.match(page,/zones:\s*Array\.isArray\(o\.zones\)[^\n]+oldObjective\.zones/);
});

test("タスク詳細では関連マップと攻略リンクをタスク単位に集約する",()=>{
 assert.match(page,/function taskMapReferences\(/);
 assert.match(page,/className="taskMaps"/);
 assert.match(page,/className="taskMapButton"/);
 assert.match(page,/対象手順/);
 assert.match(page,/className="taskSpecificMap"/);
 assert.match(page,/目的・準備・場所をひとつの画面で確認。/);
 assert.doesNotMatch(page,/目的・準備・場所・報酬をひとつの画面で確認。/);
 assert.doesNotMatch(page,/objective\.maps\?\.length > 0/);
 assert.doesNotMatch(page,/className="rewardSection"/);
 assert.doesNotMatch(page,/rewardSummary|rewardItems/);
 assert.doesNotMatch(page,/XP ·/);
 assert.doesNotMatch(css,/rewardSection|liveReward/);
});

test("Wikiの地点画像をタスク名・目的文・略称から選べる",()=>{
 const task={name:"Health Care Privacy - Part 1",objectives:[{description:"Locate and mark the first ambulance with an MS2000 Marker on Shoreline"}]};
 const images=[
  {url:"https://static.wikia/HCPP1.png",caption:"HCPP1.png",width:1920,height:1080},
  {url:"https://static.wikia/Ambulance1.png",caption:"Ambulance1.png",width:1280,height:720},
  {url:"https://static.wikia/Ambulance2.png",caption:"Ambulance2.png",width:1280,height:720},
  {url:"https://static.wikia/Out_of_Curiosity_Banner.png",caption:"Out of Curiosity Banner.png",width:1200,height:300},
  {url:"https://static.wikia/MS2000_icon.png",caption:"MS2000 Marker icon.png",width:64,height:64}
 ];
 assert.deepEqual(selectTaskReferenceImages(images,task).map(image=>image.caption),["HCPP1.png","Ambulance1.png","Ambulance2.png"]);
 assert.equal(selectTaskReferenceImages([{url:"https://static.wikia/Rigged.png",caption:"AnesthesiaxRiggedGameLocation1.png"}],{name:"Rigged Game",objectives:[]}).length,1);
 assert.equal(selectTaskReferenceImages([{url:"https://static.wikia/Trouble.png",caption:"TroubleBigCity MarkSpot.png"}],{name:"Trouble in the Big City",objectives:[]}).length,1);
});

test("対応マップの全脱出地点に注釈データがある",()=>{
 const match=page.match(/const printedLabelAnchors:[^=]+\s*=\s*(\{[\s\S]*?\r?\n\})\;\r?\nconst unprintedLabelKeys(?:[^=]+)?/);
 assert.ok(match,"注釈カタログを解析できる");
 const anchors=Function(`return (${match[1]})`)();
 const unprinted={"5714dbc024597771384a510d":new Set(["holeinthefence"]),"5b0fc42d86f7744a585f9105":new Set(["ストリートオブタルコフへ移動"])};
 const bundled=JSON.parse(mapsCache).maps;
 const key=value=>String(value||"").normalize("NFKC").toLowerCase().replace(/[・･]/g,"").replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/g,"");
 const missing=[];
 for(const [mapId,table] of Object.entries(anchors))for(const [name,point] of Object.entries(table)){
  assert.ok(point.left>0&&point.left<100&&point.top>0&&point.top<100,`${mapId}: ${name}の中心座標`);
  if(point.width!==undefined)assert.ok(point.width>0&&point.width<30,`${mapId}: ${name}の幅`);
  if(point.height!==undefined)assert.ok(point.height>0&&point.height<15,`${mapId}: ${name}の高さ`);
  for(const part of point.parts||[])assert.ok(part.left>0&&part.left<100&&part.top>0&&part.top<100&&part.width>0&&part.height>0,`${mapId}: ${name}の複数行枠`);
 }
 for(const map of bundled){
  const table=anchors[map.id]||anchors[`name:${key(map.name)}`];
  if(!table)continue;
  const points=[...(map.extracts||[]),...(map.name==="Factory"?[]:(map.transits||[]))];
  for(const point of points)if(!table[key(point.name)]&&!unprinted[map.id]?.has(key(point.name)))missing.push(`${map.name}: ${point.name}`);
 }
 assert.deepEqual(missing,[]);
});
