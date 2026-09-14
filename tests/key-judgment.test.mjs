import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
import {formatCatalogTime,keyPriceRows,keyTaskEvidence,keyUsesLabel} from "../app/key-wiki-utils.mjs";

const require=createRequire(import.meta.url),{buildKeyCatalog,requiredKeyGroups}=require("../electron/key-catalog.cjs");
const keyA="aaaaaaaaaaaaaaaaaaaaaaaa",keyB="bbbbbbbbbbbbbbbbbbbbbbbb",taskA="111111111111111111111111",taskOther="222222222222222222222222",mapA="333333333333333333333333",traderA="444444444444444444444444";
const documents={
  items:{data:{items:{[keyA]:{id:keyA,name:"KEY_A",shortName:"KEY_A_SHORT",description:"KEY_A_DESC",types:["keys"],properties:{uses:10},avg24hPrice:125000,lastLowPrice:118000,sellFor:[{vendor:traderA,price:31500,priceRUB:31500}],usedInTasks:[taskA,taskOther]},[keyB]:{id:keyB,name:"KEY_B",types:["keys"],properties:{uses:0},avg24hPrice:null,lastLowPrice:null,sellFor:[],usedInTasks:[]}}}},
  items_en:{KEY_A:"Room key",KEY_A_SHORT:"Room",KEY_A_DESC:"A key",KEY_B:"Alternative key"},items_ja:{KEY_A:"部屋の鍵",KEY_B:"代替鍵"},
  tasks:{data:{tasks:{[taskA]:{id:taskA,name:"TASK_A",trader:traderA,map:mapA,minPlayerLevel:12,objectives:[{id:"objective-a",maps:[mapA],requiredKeys:[[keyA,keyB]]},{id:"objective-b",maps:[mapA],requiredKeys:[[keyA]]}]},[taskOther]:{id:taskOther,name:"TASK_OTHER",trader:traderA,map:mapA,minPlayerLevel:3,objectives:[]}}}},tasks_en:{TASK_A:"Required task",TASK_OTHER:"Other task"},tasks_ja:{TASK_A:"必須タスク",TASK_OTHER:"その他タスク"},
  traders:{data:{traders:{[traderA]:{id:traderA,name:"TRADER_A"}}}},traders_en:{TRADER_A:"Therapist"},
  maps:{data:{maps:{[mapA]:{id:mapA,name:"MAP_A",locks:[{key:keyA,lockType:"door",position:{x:1,y:2,z:3}}],accessKeys:[keyA]}}}},maps_en:{MAP_A:"Customs"},maps_ja:{MAP_A:"カスタム"}
};

test("使用回数は正の通常値だけ回数として示し、0・null・欠損を無制限へ変換しない",()=>{
  assert.equal(keyUsesLabel(10),"最大使用回数：10回");
  assert.equal(keyUsesLabel(0),"最大使用回数：確認できません");
  assert.equal(keyUsesLabel(null),"最大使用回数：確認できません");
  assert.equal(keyUsesLabel(undefined),"最大使用回数：確認できません");
});

test("参考相場は価格種別付きで最大2件とし、0・欠損・取得失敗を区別する",()=>{
  assert.deepEqual(keyPriceRows({priceStatus:"available",prices:{avg24hPrice:125000,lastLowPrice:118000,traderSell:{vendor:"Therapist",priceRUB:31500}}}),[{kind:"avg24h",label:"24時間平均",value:125000},{kind:"trader",label:"Therapist売却",value:31500}]);
  assert.deepEqual(keyPriceRows({priceStatus:"available",prices:{avg24hPrice:0}}),[{kind:"avg24h",label:"24時間平均",value:0}]);
  assert.deepEqual(keyPriceRows({priceStatus:"available",prices:{}}),[]);
  assert.deepEqual(keyPriceRows({priceStatus:"unavailable",prices:{avg24hPrice:100}}),[]);
  assert.notEqual(formatCatalogTime("2026-09-12T05:30:00.000Z"),"確認できません");
  assert.equal(formatCatalogTime(null),"確認できません");
});

test("関連タスク0件と取得不能を区別する",()=>{
  const empty=keyTaskEvidence({taskRelationsStatus:"available",tasks:[],otherTasks:[]}),failed=keyTaskEvidence({tasks:[],otherTasks:[]});
  assert.equal(empty.requiredLabel,"鍵として必要：0件");
  assert.equal(empty.otherLabel,"API上のその他タスク関連登録なし");
  assert.equal(failed.requiredLabel,"鍵として必要：確認できません");
});

test("requiredKeysの外側AND・内側ORを維持し、同一タスクの複数目標を集約する",()=>{
  assert.deepEqual(requiredKeyGroups([[keyA,keyB],[keyA]]),[[keyA,keyB],[keyA]]);
  const catalog=buildKeyCatalog(documents,{fetchedAt:"2026-09-12T05:30:00.000Z"}),key=catalog.keys.find(entry=>entry.id===keyA);
  assert.equal(catalog.gameMode,"regular");
  assert.equal(key.tasks.length,1);
  assert.equal(key.tasks[0].objectiveCount,2);
  assert.equal(key.tasks[0].alternative,true);
  assert.deepEqual(key.tasks[0].requirements.map(entry=>entry.keyIds),[[keyA,keyB],[keyA]]);
  assert.deepEqual(key.otherTasks.map(task=>task.id),[taskOther]);
});

test("Lock・アクセス・タスク対象マップを別根拠にし、部分取得失敗でも基本情報を残す",()=>{
  const key=buildKeyCatalog(documents).keys.find(entry=>entry.id===keyA);
  assert.deepEqual(new Set(key.mapUses.map(entry=>entry.kind)),new Set(["door","access","task"]));
  assert.equal(key.prices.traderSell.priceRUB,31500);
  assert.equal(key.prices.traderSell.vendor,"Therapist");
  const partial=buildKeyCatalog({items:documents.items,items_en:documents.items_en,items_ja:documents.items_ja});
  assert.equal(partial.keys.length,2);
  assert.equal(partial.keys[0].taskRelationsStatus,"unavailable");
  assert.equal(partial.keys[0].mapUsesStatus,"unavailable");
  assert.deepEqual(partial.keys[0].tasks,[]);
});
