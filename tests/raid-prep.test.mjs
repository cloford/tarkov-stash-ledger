import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {buildRaidPrepSummary, loadRaidKeyRequirements, parseRaidTaskIds, resolveRaidTasks, sanitizeRaidTaskIds, taskMapReferences, updateRaidTaskIds} from "../app/raid-prep-utils.mjs";
import {createRetryableRequestCache} from "../app/task-request-cache.mjs";

test("今回のレイド保存値をタスクIDだけにsanitizeし再起動相当で復元する", () => {
  const sanitized = sanitizeRaidTaskIds([" task-a ", "task-a", null, "", {id: "task-b"}, "bad id", "task-b"]);
  assert.deepEqual(sanitized, ["task-a", "task-b"]);
  assert.deepEqual(parseRaidTaskIds(JSON.stringify(sanitized)), sanitized);
  assert.deepEqual(parseRaidTaskIds("{broken"), []);
  assert.deepEqual(parseRaidTaskIds(JSON.stringify({tasks: ["task-a"]})), []);
});

test("追加・個別解除・全件解除で件数と順序を維持する", () => {
  let ids = updateRaidTaskIds([], "task-a", true);
  ids = updateRaidTaskIds(ids, "task-b", true);
  ids = updateRaidTaskIds(ids, "task-a", true);
  assert.deepEqual(ids, ["task-a", "task-b"]);
  ids = updateRaidTaskIds(ids, "task-a", false);
  assert.deepEqual(ids, ["task-b"]);
  assert.deepEqual(sanitizeRaidTaskIds([]), []);
});

test("現データにない保存IDを保持し、確認不能のまま解除対象にできる", () => {
  const entries = resolveRaidTasks(["missing-task", "task-a"], [{id: "task-a", name: "確認可能"}]);
  assert.deepEqual(entries.map(entry => [entry.id, entry.task?.name || null]), [["missing-task", null], ["task-a", "確認可能"]]);
  assert.deepEqual(updateRaidTaskIds(entries.map(entry => entry.id), "missing-task", false), ["task-a"]);
});

test("選択タスクの対象マップは既存の正規化を通し、指定がなければ空のままにする", () => {
  const task = {id: "task-a", map: "Night Factory", mapId: "59fc81d786f774390775787e", objectives: [{id: "visit", maps: [{id: "55f2d3fd4bdc2d5f408b4567", name: "Factory"}, {id: "56f40101d2720b2a4d8b45d6", name: "Customs"}]}]};
  assert.deepEqual(taskMapReferences(task).map(map => map.name), ["Factory", "Customs"]);
  assert.deepEqual(taskMapReferences({id: "unknown", objectives: []}), []);
  assert.deepEqual(buildRaidPrepSummary(resolveRaidTasks(["task-a"], [task])).maps.map(map => map.name), ["Factory", "Customs"]);
});

test("鍵をIDで重複排除し利用タスクを併記する", () => {
  const tasks = [{id: "task-a", name: "A", objectives: []}, {id: "task-b", name: "B", objectives: []}], entries = resolveRaidTasks(["task-a", "task-b"], tasks);
  const summary = buildRaidPrepSummary(entries, {
    "task-a": {status: "ready", keys: [{id: "key-1", name: "共通鍵"}]},
    "task-b": {status: "ready", keys: [{id: "key-1", name: "共通鍵"}, {id: "key-2", name: "別鍵"}]}
  });
  assert.equal(summary.keys.length, 2);
  assert.deepEqual(summary.keys.find(entry => entry.id === "key-1").tasks.map(task => task.name), ["A", "B"]);
});

test("確実な消費品だけ合算し、不確実な使用品はタスク別表示する", () => {
  const item = {id: "marker", name: "Marker"}, tasks = [
    {id: "task-a", name: "A", objectives: [{id: "plant-a", type: "plantItem", count: 2, items: [item], description: "stash"}, {id: "use-a", type: "useItem", count: 4, useAny: [item], description: "use"}]},
    {id: "task-b", name: "B", objectives: [{id: "mark-b", type: "mark", count: 3, markerItem: item, description: "mark"}, {id: "use-b", type: "useItem", count: 2, useAny: [item], description: "use"}]}
  ];
  const summary = buildRaidPrepSummary(resolveRaidTasks(["task-a", "task-b"], tasks));
  const certain = summary.bring.find(entry => entry.certain), uncertain = summary.bring.filter(entry => !entry.certain);
  assert.equal(certain.totalCount, 5);
  assert.deepEqual(certain.tasks.map(task => task.name), ["A", "B"]);
  assert.equal(uncertain.length, 2);
  assert.deepEqual(uncertain.map(entry => entry.count), [4, 2]);
});

test("持ち込み・現地回収・帰還後納品とFIRを混同しない", () => {
  const same = {id: "same-item", name: "Same"}, task = {id: "task-a", name: "A", objectives: [
    {id: "bring", type: "plantItem", count: 1, items: [same], description: "bring"},
    {id: "find", type: "findItem", count: 2, items: [same], foundInRaid: true, description: "find"},
    {id: "give", type: "giveItem", count: 3, items: [same], foundInRaid: true, description: "give"},
    {id: "quest-find", type: "findQuestItem", count: 1, items: [], description: "quest item"}
  ]};
  const summary = buildRaidPrepSummary(resolveRaidTasks(["task-a"], [task]));
  assert.deepEqual([summary.bring.length, summary.find.length, summary.give.length], [1, 2, 1]);
  assert.equal(summary.find[0].foundInRaid, true);
  assert.equal(summary.give[0].foundInRaid, true);
  assert.equal(summary.find[1].item, null, "items欠損でも現地回収目的を消さない");
  assert.deepEqual(summary.notices.map(notice => notice.kind).sort(), ["missing-find-item"]);
});

test("複数の候補アイテムは各品に必要数を割り当てずobjective単位で残す", () => {
  const candidates = [{id: "item-a", name: "A"}, {id: "item-b", name: "B"}], task = {id: "task-a", name: "A", objectives: [
    {id: "find", type: "findItem", count: 3, items: candidates, description: "find candidates"},
    {id: "plant", type: "plantItem", count: 2, items: candidates, description: "plant candidate"}
  ]};
  const summary = buildRaidPrepSummary(resolveRaidTasks(["task-a"], [task]));
  assert.equal(summary.find.length, 1);
  assert.deepEqual(summary.find[0].items.map(item => item.id), ["item-a", "item-b"]);
  assert.equal(summary.find[0].item, null);
  assert.equal(summary.bring.length, 1);
  assert.equal(summary.bring[0].certain, false);
  assert.match(summary.bring[0].note, /内訳は未確認/);
});

test("回収・納品のitems欠損を行と未確認noticeの両方に残す", () => {
  const task = {id: "task-a", name: "A", objectives: [
    {id: "find-item", type: "findItem", description: "find item"},
    {id: "find-quest", type: "findQuestItem", description: "find quest"},
    {id: "give-item", type: "giveItem", description: "give item"},
    {id: "give-quest", type: "giveQuestItem", description: "give quest"}
  ]};
  const summary = buildRaidPrepSummary(resolveRaidTasks(["task-a"], [task]));
  assert.equal(summary.find.length, 2);
  assert.equal(summary.give.length, 2);
  assert.deepEqual(summary.notices.map(notice => notice.kind), ["missing-find-item", "missing-find-item", "missing-give-item", "missing-give-item"]);
  assert.ok(summary.notices.every(notice => notice.message.includes("構造化データで確認できません")));
});

test("単数itemはbuild系だけを装備条件に分類し、明示装備フィールドはtype横断で扱う", () => {
  const task = {id: "task-a", name: "A", objectives: [
    {id: "plain", type: "visit", description: "visit", item: {id: "not-equipment", name: "Not equipment"}},
    {id: "build", type: "buildWeapon", description: "build", item: {id: "weapon", name: "Weapon"}},
    {id: "explicit", type: "shoot", description: "shoot", usingWeapon: [{id: "rifle", name: "Rifle"}]}
  ]};
  const summary = buildRaidPrepSummary(resolveRaidTasks(["task-a"], [task]));
  assert.deepEqual(summary.equipment.map(entry => entry.id), ["task-a:build", "task-a:explicit"]);
  assert.deepEqual(summary.equipment[0].items.map(item => item.id), ["weapon"]);
  assert.deepEqual(summary.equipment[1].items.map(item => item.id), ["rifle"]);
});

test("不明objectiveと鍵取得失敗を情報なし扱いにしない", () => {
  const task = {id: "task-a", name: "A", objectives: [{id: "future", type: "futureObjective", description: "future"}, {id: "mark", type: "mark", description: "mark"}]};
  const summary = buildRaidPrepSummary(resolveRaidTasks(["task-a"], [task]), {"task-a": {status: "failed", keys: []}});
  assert.deepEqual(summary.keyStates, [{taskId: "task-a", taskName: "A", status: "failed"}]);
  assert.deepEqual(summary.notices.map(notice => notice.kind).sort(), ["missing-marker", "unsupported-objective"]);
});

test("鍵取得中に閉じて再度開いても同じPromiseへ再接続して完了する", async () => {
  const entries = resolveRaidTasks(["task-a"], [{id: "task-a", name: "A", objectives: []}]), cache = createRetryableRequestCache();
  let calls = 0, finish;
  const request = () => {calls++; return new Promise(resolve => {finish = resolve;});}, states = [];
  const options = {request, cache, onState: (id, state) => states.push({id, ...state})};
  const firstOpen = loadRaidKeyRequirements(entries, options);
  const reopened = loadRaidKeyRequirements(entries, options);
  await Promise.resolve();
  assert.equal(calls, 1, "再オープンは進行中の鍵取得を共有する");
  finish({verified: true, keys: [{id: "key-1", name: "Key"}]});
  await Promise.all([firstOpen, reopened]);
  assert.equal(states.filter(state => state.status === "ready").length, 2);
  assert.ok(states.filter(state => state.status === "ready").every(state => state.keys[0].id === "key-1"));
});

test("今回のレイドUIからタスク・鍵・マップへ既存state形式で遷移する", async () => {
  const [shell, panel, detail, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/raid-prep.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/task-guide-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/raid-prep.css", import.meta.url), "utf8")
  ]);
  assert.match(shell, /guideSelected: taskId/);
  assert.match(shell, /guideRaidReturn: true/);
  assert.match(shell, /keySelected: keyId/);
  assert.match(shell, /mapStage: map\?\.name \|\| map\?\.nameJa/);
  assert.match(panel, /onOpenTask\(entry\.id, entry\.task\.trader\)/);
  assert.match(panel, /対象マップ：/);
  assert.match(panel, /構造化データで確認できません/);
  assert.match(panel, /onOpenKey\(entry\.id\)/);
  assert.match(panel, /onOpenMap\(map\)/);
  assert.match(panel, /タスク詳細の「今回のレイドに追加」から、次の出撃で確認したいタスクを登録できます。/);
  assert.match(detail, /今回のレイドに追加/);
  assert.match(detail, /今回のレイドから外す/);
  assert.match(detail, /今回のレイドへ戻る/);
  assert.match(detail, /guideRaidRegistered/);
  assert.match(detail, /guideRaidReturn: false/);
  assert.doesNotMatch(panel, /position\.x|position\.z|marker/i, "パネルは未検証座標を表示しない");
  assert.match(css, /@media\(max-width:650px\)/);
});
