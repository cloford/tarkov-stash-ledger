import assert from "node:assert/strict";
import test from "node:test";
import {buildRaidImageTargets,inspectRaidImageTargets,saveRaidImageTargets,summarizeRaidImageSaveResult,summarizeRaidImageTargets,taskMediaCacheId} from "../app/raid-image-prefetch.mjs";

const task={id:"task-a",name:"Task A",map:"Customs",mapId:"56f40101d2720b2a4d8b45d6",objectives:[{id:"visit",maps:[{id:"56f40101d2720b2a4d8b45d6",name:"Customs"}]}]};
test("登録タスクに確実なマップと直接関連画像だけを抽出しURL重複を除く",()=>{
  const result=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"ready",images:[{url:"https://example.com/room.png",caption:"Room"},{url:"https://example.com/room.png#duplicate",caption:"Room copy"}]}}});
  assert.equal(result.maps.length,1);assert.equal(result.images.length,1);assert.equal(result.unavailable.length,0);assert.match(result.maps[0].source,/customs/i);
});

test("URLなしと取得失敗を対象外・取得不能として区別する",()=>{
  const noImages=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"ready",images:[]}}}),failed=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"failed",images:[]}}}),unsupported=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"unsupported",images:[]}}});
  assert.equal(noImages.unavailable[0].status,"excluded");assert.equal(noImages.unavailable[0].detail,"保存できる画像が登録されていません");assert.equal(failed.unavailable[0].status,"unavailable");assert.equal(unsupported.unavailable[0].status,"excluded");assert.match(unsupported.unavailable[0].detail,/対応している公開Wiki/);
});

test("stale索引の対象は維持しつつ最新参照の取得失敗を明示する",()=>{
  const result=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"stale",images:[{id:"Room.png",url:"https://example.com/room.png",caption:"Room"}]}}});
  assert.equal(result.images.length,1);assert.equal(result.unavailable.length,1);assert.match(result.unavailable[0].detail,/最新の画像参照を取得できない/);
});

test("提供元IDまたはURLで重複を除き、安全で衝突しない短いcacheIdを作る",()=>{
  const prefix="同じ長い接頭辞".repeat(30),first={id:`${prefix}-a.png`,url:"https://example.com/a.png",caption:prefix},second={id:`${prefix}-b.png`,url:"https://example.com/b.png",caption:prefix};
  const firstId=taskMediaCacheId(task.id,first),secondId=taskMediaCacheId(task.id,second);
  assert.ok(firstId.length<=80);assert.ok(secondId.length<=80);assert.notEqual(firstId,secondId);assert.match(firstId,/^task-media-[a-f0-9]+$/);
  assert.equal(firstId,taskMediaCacheId("other-task",{...first,url:"https://example.com/updated.png"}));
  assert.notEqual(taskMediaCacheId(task.id,{url:first.url,caption:"same"}),taskMediaCacheId(task.id,{url:second.url,caption:"same"}));
  assert.equal(taskMediaCacheId(task.id,{url:first.url}),taskMediaCacheId(task.id,{url:`${first.url}#section`}));
  assert.notEqual(taskMediaCacheId(task.id,{id:"Room.png"}),taskMediaCacheId(task.id,{id:"ROOM.png"}));
  const result=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"ready",images:[first,{...first,id:"different-id"},{...second,url:"https://example.com/c.png"},{id:second.id,url:"https://example.com/d.png",caption:"duplicate provider"}]}}});
  assert.equal(result.images.length,2);
});

test("保存状態を確認し未保存・更新・保存済みへ遷移する",async()=>{
  const targets=[{id:"a",cacheId:"a",source:"https://example.com/a.png",status:"checking"},{id:"b",cacheId:"b",source:"https://example.com/b.png",status:"checking"},{id:"c",cacheId:"c",source:"https://example.com/c.png",status:"checking"}],seen=[];
  const result=await inspectRaidImageTargets(targets,async(_url,id)=>id==="a"?{cached:true}:id==="b"?{cached:true,stale:true}:{cached:false},{onState:item=>seen.push(item.status)});
  assert.deepEqual(result.map(item=>item.status),["saved","update","pending"]);assert.deepEqual(seen,["saved","update","pending"]);
});

test("制限並列で保存し、一部失敗後は失敗項目だけ再試行する",async()=>{
  let active=0,maxActive=0,calls=[];const targets=["a","b","c","d"].map(id=>({id,cacheId:id,source:`https://example.com/${id}.png`,status:id==="b"?"failed":"pending"}));
  const cache=async(_url,id)=>{calls.push(id);active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;return id==="c"?{cached:false,error:"HTTP 500"}:{cached:true};};
  const first=await saveRaidImageTargets(targets,cache,{concurrency:2});assert.ok(maxActive<=2);assert.equal(first.find(item=>item.id==="c").status,"failed");
  calls=[];await saveRaidImageTargets(targets.map(item=>({...item,status:item.id==="c"?"failed":"saved"})),cache,{concurrency:2,retryOnly:true});assert.deepEqual(calls,["c"]);
});

test("集計は対象外を対象数へ含めず状態別に数える",()=>assert.deepEqual(summarizeRaidImageTargets([{status:"saved"},{status:"pending"},{status:"saving"},{status:"failed"},{status:"update"},{status:"excluded"},{status:"unavailable"}]),{total:5,saved:1,pending:1,saving:1,failed:1,unavailable:2,update:1}));

test("保存結果はsetStateを待たず最終項目と種別件数を集約する",()=>{
  const targets=[{id:"map",kind:"map",source:"https://example.com/map.png",status:"pending"},{id:"image",kind:"task",source:"https://example.com/image.png",status:"pending"},{id:"notice",kind:"task",status:"excluded"}],results=[{...targets[0],status:"saved"},{...targets[1],status:"failed"}];
  const summary=summarizeRaidImageSaveResult(targets,results);assert.deepEqual({total:summary.total,saved:summary.saved,failed:summary.failed,maps:summary.maps,images:summary.images},{total:2,saved:1,failed:1,maps:1,images:0});assert.deepEqual(summary.items.map(item=>item.status),["saved","failed","excluded"]);
  const retry=summarizeRaidImageSaveResult(summary.items,[{...results[1],status:"saved"}]);
  assert.deepEqual({total:retry.total,saved:retry.saved,failed:retry.failed,maps:retry.maps,images:retry.images},{total:1,saved:1,failed:0,maps:0,images:1});
  assert.deepEqual(retry.items.map(item=>item.status),["saved","saved","excluded"]);
});
