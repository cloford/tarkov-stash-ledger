import assert from "node:assert/strict";
import test from "node:test";
import {readFile} from "node:fs/promises";
import {createQuickSearchCatalog, findQuickSearchResults, normalizeQuickSearchText} from "../app/quick-search-utils.mjs";

const catalog = createQuickSearchCatalog({
  tasks: [{id: "task-1", name: "Checking", nameJa: "チェック中", trader: "Prapor", objectives: [{maps: [{id: "56f40101d2720b2a4d8b45d6", name: "Customs", nameJa: "カスタム"}]}]}],
  keys: [{id: "key-1", name: "Dorm room 206 key", nameEn: "Dorm room 206 key", shortName: "206", mapUses: [{id: "56f40101d2720b2a4d8b45d6", name: "Customs", nameJa: "カスタム"}], tasks: []}],
  maps: [{id: "56f40101d2720b2a4d8b45d6", name: "Customs", extracts: [{id: "zb-1011", name: "ZB-1011", aliases: ["ZB 1011"]}]}]
});

test("NFKC・大文字小文字・空白記号を省略して検索できる", () => {
  assert.equal(normalizeQuickSearchText(" ＺＢ- １０１１ "), "zb1011");
  assert.equal(findQuickSearchResults(catalog, "zb 1011")[0].label, "脱出地点");
  assert.equal(findQuickSearchResults(catalog, "チェ ック")[0].taskId, "task-1");
});

test("タスク・鍵・脱出地点を種類と正しい遷移情報付きで返す", () => {
  const task = findQuickSearchResults(catalog, "checking")[0], key = findQuickSearchResults(catalog, "206")[0], extract = findQuickSearchResults(catalog, "ZB-1011")[0];
  assert.deepEqual({kind: task.kind, taskId: task.taskId, map: task.map.label}, {kind: "task", taskId: "task-1", map: "カスタム"});
  assert.deepEqual({kind: key.kind, keyId: key.keyId, map: key.map.label}, {kind: "key", keyId: "key-1", map: "カスタム"});
  assert.deepEqual({kind: extract.kind, name: extract.extractName, map: extract.map.name}, {kind: "extract", name: "ZB-1011", map: "Customs"});
});

test("取得できないカテゴリを明示し、取得済みカテゴリの結果は残す", () => {
  const partial = createQuickSearchCatalog({tasks: [{id: "task-1", name: "Checking"}], keys: undefined, maps: undefined});
  assert.deepEqual(partial.unavailable, ["鍵", "脱出地点"]);
  assert.equal(findQuickSearchResults(partial, "checking").length, 1);
});

test("共通検索はキーボード操作と3種類の遷移を提供する", async () => {
  const component = await readFile(new URL("../app/quick-search.tsx", import.meta.url), "utf8"), shell = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const key of ["Ctrl", "Escape", "ArrowDown", "ArrowUp", "Enter"]) assert.match(component, new RegExp(key), `${key}操作を実装する`);
  assert.match(component, /onOpenTask\(entry\.taskId, entry\.trader\)/);
  assert.match(component, /onOpenKey\(entry\.keyId\)/);
  assert.match(component, /onOpenExtract\(entry\.map, entry\.extractName\)/);
  assert.match(shell, /mapExtract: \{map, name: extractName\}/);
});
