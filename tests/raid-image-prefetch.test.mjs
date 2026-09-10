import assert from "node:assert/strict";
import test from "node:test";
import {buildRaidImageTargets,inspectRaidImageTargets,saveRaidImageTargets,summarizeRaidImageTargets} from "../app/raid-image-prefetch.mjs";

const task={id:"task-a",name:"Task A",map:"Customs",mapId:"56f40101d2720b2a4d8b45d6",objectives:[{id:"visit",maps:[{id:"56f40101d2720b2a4d8b45d6",name:"Customs"}]}]};
test("登録タスクに確実なマップと直接関連画像だけを抽出しURL重複を除く",()=>{
  const result=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"ready",images:[{url:"https://example.com/room.png",caption:"Room"},{url:"https://example.com/room.png#duplicate",caption:"Room copy"}]}}});
  assert.equal(result.maps.length,1);assert.equal(result.images.length,1);assert.equal(result.unavailable.length,0);assert.match(result.maps[0].source,/customs/i);
});

test("URLなしと取得失敗を対象外・取得不能として区別する",()=>{
  const noImages=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"ready",images:[]}}}),failed=buildRaidImageTargets([{id:task.id,task}],{mediaStates:{"task-a":{status:"failed",images:[]}}});
  assert.equal(noImages.unavailable[0].status,"excluded");assert.equal(failed.unavailable[0].status,"unavailable");
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
