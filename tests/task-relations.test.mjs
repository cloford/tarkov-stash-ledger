import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {buildTaskRelationIndex,directTaskRelations,expandTaskPrerequisites,taskStatusLabels} from "../app/task-relations.mjs";

const task = (id, prerequisites = [], extra = {}) => ({id, name: `Task ${id}`, trader: "Prapor", relationsAvailable: true, prerequisites, ...extra});
const req = (id, status = ["complete"]) => ({id, name: `Task ${id}`, status});

test("直接前提0件・1件・複数件と後続をIDで逆引きする", () => {
  const tasks = [task("a"), task("b", [req("a")]), task("c", [req("a"), req("b")])];
  const index = buildTaskRelationIndex(tasks);
  assert.deepEqual(directTaskRelations(index, tasks[0]).prerequisites, []);
  assert.deepEqual(directTaskRelations(index, tasks[1]).prerequisites.map(entry => entry.task.id), ["a"]);
  assert.deepEqual(directTaskRelations(index, tasks[2]).prerequisites.map(entry => entry.task.id), ["a", "b"]);
  assert.deepEqual(directTaskRelations(index, tasks[0]).successors.map(entry => entry.task.id), ["b", "c"]);
});

test("重複した後続条件と複数ステータスをOR条件としてまとめる", () => {
  const tasks = [task("a"), task("b", [req("a", ["complete"]), req("a", ["active", "complete"])])];
  const relations = directTaskRelations(buildTaskRelationIndex(tasks), tasks[0]);
  assert.equal(relations.successors.length, 1);
  assert.deepEqual(relations.successors[0].status, ["complete", "active"]);
  assert.deepEqual(taskStatusLabels(relations.successors[0].status), ["完了", "進行中"]);
  assert.deepEqual(taskStatusLabels([0, "availableForStart", "failedRestartable", "availableAfter"]), ["ロック中", "開始可能", "失敗・再挑戦可能", "待機期間後に開始可能"]);
});

test("分岐する前提を階層化し、重複は一度だけ展開する", () => {
  const tasks = [task("root", [req("left"), req("right")]), task("left", [req("base")]), task("right", [req("base")]), task("base")];
  const expanded = expandTaskPrerequisites(buildTaskRelationIndex(tasks), tasks[0]);
  assert.equal(expanded.nodes.length, 2);
  assert.equal(expanded.nodes[0].children[0].task.id, "base");
  assert.equal(expanded.nodes[1].children[0].duplicate, true);
});

test("循環・欠損参照・件数上限でも展開を停止する", () => {
  const tasks = [task("a", [req("b"), req("missing")]), task("b", [req("a")])];
  const expanded = expandTaskPrerequisites(buildTaskRelationIndex(tasks), tasks[0], {maxDepth: 8, maxNodes: 10});
  assert.equal(expanded.nodes[0].children[0].cycle, true);
  assert.equal(expanded.nodes[1].missing, true);
  const depthTasks = [task("a", [req("b")]), task("b", [req("c")]), task("c")];
  const limited = expandTaskPrerequisites(buildTaskRelationIndex(depthTasks), depthTasks[0], {maxDepth: 1});
  assert.equal(limited.nodes[0].truncated, true);
  assert.equal(limited.limitReached, true);
});

test("同名タスクでもゲームモードをまたいで関連付けない", () => {
  const regularBase = task("base", [], {name: "Same Name", gameMode: "regular"});
  const pveBase = task("base", [], {name: "Same Name", gameMode: "pve"});
  const regularNext = task("regular-next", [req("base")], {gameMode: "regular"});
  const pveNext = task("pve-next", [req("base")], {gameMode: "pve"});
  const index = buildTaskRelationIndex([regularBase, pveBase, regularNext, pveNext]);
  assert.deepEqual(directTaskRelations(index, regularBase).successors.map(entry => entry.task.id), ["regular-next"]);
  assert.deepEqual(directTaskRelations(index, pveBase).successors.map(entry => entry.task.id), ["pve-next"]);
});

test("取得成功の空配列と取得不能を区別する", () => {
  const available = task("available");
  const unavailable = task("unavailable", [], {relationsAvailable: false});
  const index = buildTaskRelationIndex([available, unavailable]);
  assert.equal(directTaskRelations(index, available).prerequisitesAvailable, true);
  assert.equal(directTaskRelations(index, unavailable).prerequisitesAvailable, false);
  assert.equal(directTaskRelations(index, available).successorsAvailable, false);
});

test("タスク詳細は直接関係を初期表示し、再帰展開と狭幅表示を任意操作にする", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/task-guide-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guide.css", import.meta.url), "utf8")
  ]);
  assert.match(page, /const \[open, setOpen\] = useState\(true\)/);
  assert.match(page, /直接の前提/);
  assert.match(page, /直接の後続/);
  assert.match(page, /解放までの前提を表示/);
  assert.match(page, /guideRelationReturn/);
  assert.match(css, /@media\(max-width:760px\)[^{]*\{[^}]*\.taskRelations>header\{display:block\}/);
  assert.match(css, /\.taskRelationBody\{grid-template-columns:1fr\}/);
});
