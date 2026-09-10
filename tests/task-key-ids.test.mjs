import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {readFile} from "node:fs/promises";
import test from "node:test";

const require=createRequire(import.meta.url),{collectTaskKeyIds}=require("../electron/task-key-ids.cjs");

test("neededKeysのmap IDを除外しkeysだけを収集する",()=>{
  const customsMapId="56f40101d2720b2a4d8b45d6",machineryKeyId="5937ee6486f77408994ba448",objectiveKeyId="5a0dc45586f7742f6b0b73e3";
  const task={
    id:"5936da9e86f7742d65037edf",
    neededKeys:[{map:customsMapId,keys:[machineryKeyId,[machineryKeyId]]},{map:"5704e554d2720bac5b8b456e",keys:[]}],
    objectives:[{requiredKeys:[[objectiveKeyId,objectiveKeyId]]},{requiredKeys:{id:customsMapId,keys:[customsMapId]}}]
  };
  assert.deepEqual(collectTaskKeyIds(task),[machineryKeyId,objectiveKeyId]);
  assert.equal(collectTaskKeyIds(task).includes(customsMapId),false);
});

test("任意オブジェクトを再帰せず、異常型と重複を安全に無視する",()=>{
  const keyId="5937ee6486f77408994ba448",mapId="56f40101d2720b2a4d8b45d6";
  assert.deepEqual(collectTaskKeyIds({neededKeys:[null,{keys:[keyId,{id:mapId}]}],objectives:[null,{requiredKeys:[keyId,{nested:[mapId]}]}]}),[keyId]);
  assert.deepEqual(collectTaskKeyIds(null),[]);
});

test("Electron requirements handlerは純粋な鍵ID収集を利用する",async()=>{
  const main=await readFile(new URL("../electron/main.cjs",import.meta.url),"utf8");
  assert.match(main,/collectTaskKeyIds\(task\)/);
  assert.doesNotMatch(main,/collect\(task\.neededKeys/);
});
