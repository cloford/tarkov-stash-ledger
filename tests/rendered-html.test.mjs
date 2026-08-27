import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const [page,css,main,mapsCache]=await Promise.all([
 readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
 readFile(new URL("../app/map.css",import.meta.url),"utf8"),
 readFile(new URL("../electron/main.cjs",import.meta.url),"utf8"),
 readFile(new URL("../app/data/maps-cache-v3.json",import.meta.url),"utf8")
]);

test("現在のタスク・マップ構成だけを表示する",()=>{
 assert.match(page,/\[\["guide",\s*"タスク情報"\],\s*\["maps",\s*"MAP"\]\]/);
 assert.doesNotMatch(page,/このタスクを完了済にする|アイテム情報|ハイドアウト/);
 assert.doesNotMatch(page,/function MapHub\s*\(/);
 assert.doesNotMatch(page,/extractFieldNote|方角・階層|画像でたどる脱出ルート|周辺の目印/);
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

test("対応マップの全脱出地点に注釈データがある",()=>{
 const match=page.match(/const printedLabelAnchors:[^=]+\s*=\s*(\{[\s\S]*?\n\});\nconst unprintedLabelKeys/);
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
