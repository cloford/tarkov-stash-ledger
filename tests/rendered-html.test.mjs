import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

const [page,css]=await Promise.all([
 readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),
 readFile(new URL("../app/map.css",import.meta.url),"utf8")
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
 assert.match(page,/markerPoints\.map\(/);
 assert.doesNotMatch(page,/holeinthefence:\s*\{/);
 assert.match(page,/marker\.offsetLeft\s*-\s*viewport\.clientWidth\s*\/\s*2/);
 assert.doesNotMatch(page,/marker\.offsetLeft\s*\+\s*marker\.offsetWidth\s*\/\s*2/);
 assert.match(page,/event\.deltaY\s*>\s*0\s*\?\s*\.2\s*:\s*-\.2/);
 assert.match(css,/overscroll-behavior:\s*none/);
 assert.match(css,/\.printedLabelMarker\{[^}]*min-width:20px/);
});

test("サブタスクの並べ替え・グループ・ANY MAPを保持する",()=>{
 assert.match(page,/名前順 A–Z/);
 assert.match(page,/マップ別/);
 assert.match(page,/トレーダー別/);
 assert.match(page,/場所指定なし（ANY MAP）/);
});
