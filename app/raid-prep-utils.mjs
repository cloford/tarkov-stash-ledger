import {normalizeMapEntries} from "./map-normalization.mjs";

export const RAID_PREP_STORAGE_KEY = "tarkov-raid-prep-task-ids";

const array = value => Array.isArray(value) ? value : [];
const text = value => typeof value === "string" ? value.trim() : "";
const positiveCount = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 1;
const itemKey = item => text(item?.id) || text(item?.name) || text(item?.shortName);
const taskLabel = task => text(task?.nameJa) || text(task?.name) || "名称不明のタスク";
const objectiveLabel = objective => text(objective?.descriptionJa) || text(objective?.description) || `目的（${text(objective?.type) || "種類不明"}）`;

export function sanitizeRaidTaskIds(value, {limit = 50} = {}) {
  if (!Array.isArray(value)) return [];
  const result = [], seen = new Set();
  for (const raw of value) {
    const id = text(raw);
    if (!id || id.length > 128 || !/^[a-zA-Z0-9:_-]+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= limit) break;
  }
  return result;
}

export function parseRaidTaskIds(raw) {
  if (typeof raw !== "string" || !raw) return [];
  try { return sanitizeRaidTaskIds(JSON.parse(raw)); } catch { return []; }
}

export function updateRaidTaskIds(ids, taskId, included) {
  const current = sanitizeRaidTaskIds(ids), id = text(taskId);
  if (!id || !/^[a-zA-Z0-9:_-]+$/.test(id)) return current;
  return sanitizeRaidTaskIds(included ? [...current, id] : current.filter(value => value !== id));
}

export function resolveRaidTasks(ids, tasks) {
  const byId = new Map(array(tasks).filter(task => task && typeof task === "object").map(task => [text(task.id), task]));
  return sanitizeRaidTaskIds(ids).map(id => ({id, task: byId.get(id) || null}));
}

function normalizedItems(value) {
  return array(value).map(item => typeof item === "string" ? {id: item, name: item} : item).filter(item => item && typeof item === "object" && itemKey(item));
}

function addCertainBring(groups, item, objective, task) {
  const key = itemKey(item), current = groups.get(key) || {id: key, item, totalCount: 0, certain: true, tasks: [], details: []};
  const count = positiveCount(objective.count);
  current.totalCount += count;
  if (!current.tasks.some(entry => entry.id === task.id)) current.tasks.push({id: task.id, name: taskLabel(task), trader: text(task.trader)});
  current.details.push({taskId: task.id, taskName: taskLabel(task), objectiveId: text(objective.id), description: objectiveLabel(objective), count});
  groups.set(key, current);
}

function addPerObjective(target, items, objective, task, extra = {}) {
  const resolvedItems = normalizedItems(items);
  target.push({id: `${task.id}:${text(objective.id)}`, item: resolvedItems.length === 1 ? resolvedItems[0] : null, items: resolvedItems, task: {id: task.id, name: taskLabel(task), trader: text(task.trader)}, description: objectiveLabel(objective), count: positiveCount(objective.count), foundInRaid: !!objective.foundInRaid, ...extra});
}

function equipmentItems(objective, type) {
  const explicit = [
    ...normalizedItems(objective.usingWeapon),
    ...normalizedItems(objective.usingWeaponMods),
    ...normalizedItems(objective.wearing),
    ...normalizedItems(objective.notWearing)
  ];
  if (!["buildWeapon", "buildItem"].includes(type)) return explicit;
  return [...explicit, ...normalizedItems(objective.containsAll), ...normalizedItems(objective.containsCategory), ...normalizedItems(objective.item ? [objective.item] : [])];
}

function uniqueNotices(notices) {
  const seen = new Set();
  return notices.filter(notice => {const key = `${notice.taskId}:${notice.objectiveId}:${notice.kind}`; if (seen.has(key)) return false; seen.add(key); return true;});
}

export function buildRaidPrepSummary(entries, requirementStates = {}) {
  const resolved = array(entries).filter(entry => entry?.task), maps = [], bringCertain = new Map(), bringUncertain = [], find = [], give = [], equipment = [], notices = [];
  const handled = new Set(["visit", "giveItem", "giveQuestItem", "findItem", "findQuestItem", "shoot", "extract", "plantItem", "plantQuestItem", "mark", "buildWeapon", "buildItem", "useItem"]);

  for (const {task} of resolved) {
    maps.push(...array(task.objectives).flatMap(objective => array(objective?.maps)));
    if (task.map) maps.push({id: task.mapId, name: task.map, nameJa: task.mapJa});
    for (const objective of array(task.objectives)) {
      if (!objective || typeof objective !== "object") {
        notices.push({taskId: task.id, taskName: taskLabel(task), objectiveId: "", kind: "invalid-objective", message: "目的データを確認できません。"});
        continue;
      }
      const type = text(objective.type), items = normalizedItems(objective.items);
      if (type === "findItem" || type === "findQuestItem") {
        addPerObjective(find, items, objective, task);
        if (!items.length) notices.push({taskId: task.id, taskName: taskLabel(task), objectiveId: text(objective.id), kind: "missing-find-item", message: `現地回収品目を構造化データで確認できません：${objectiveLabel(objective)}`});
      } else if (type === "giveItem" || type === "giveQuestItem") {
        addPerObjective(give, items, objective, task);
        if (!items.length) notices.push({taskId: task.id, taskName: taskLabel(task), objectiveId: text(objective.id), kind: "missing-give-item", message: `納品品目を構造化データで確認できません：${objectiveLabel(objective)}`});
      }
      else if (type === "plantItem") {
        if (items.length === 1) addCertainBring(bringCertain, items[0], objective, task);
        else if (items.length > 1) addPerObjective(bringUncertain, items, objective, task, {certain: false, note: "複数候補の消費内訳は未確認"});
        else notices.push({taskId: task.id, taskName: taskLabel(task), objectiveId: text(objective.id), kind: "missing-bring-item", message: `持ち込み品を構造化データで確認できません：${objectiveLabel(objective)}`});
      } else if (type === "mark") {
        const markerItems = normalizedItems(objective.markerItem ? [objective.markerItem] : items);
        if (markerItems.length === 1) addCertainBring(bringCertain, markerItems[0], objective, task);
        else if (markerItems.length > 1) addPerObjective(bringUncertain, markerItems, objective, task, {certain: false, note: "複数候補の消費内訳は未確認"});
        else notices.push({taskId: task.id, taskName: taskLabel(task), objectiveId: text(objective.id), kind: "missing-marker", message: `マーカーの品目・必要数は未確認です：${objectiveLabel(objective)}`});
      } else if (type === "plantQuestItem") {
        if (items.length === 1) addCertainBring(bringCertain, items[0], objective, task);
        else if (items.length > 1) addPerObjective(bringUncertain, items, objective, task, {certain: false, note: "複数候補の消費内訳は未確認"});
        else addPerObjective(bringUncertain, [], objective, task, {certain: false, note: "クエストアイテムの品目・消費数は未確認"});
      } else if (type === "useItem") {
        const candidates = items.length ? items : normalizedItems(objective.useAny);
        addPerObjective(bringUncertain, candidates, objective, task, {certain: false, note: "使用時の消費数は未確認"});
      }

      const structuredEquipment = equipmentItems(objective, type);
      if (["buildWeapon", "buildItem"].includes(type) || structuredEquipment.length) equipment.push({id: `${task.id}:${text(objective.id)}`, task: {id: task.id, name: taskLabel(task), trader: text(task.trader)}, type, description: objectiveLabel(objective), items: structuredEquipment, item: normalizedItems(objective.item ? [objective.item] : [])[0] || null, usingWeapon: normalizedItems(objective.usingWeapon), usingWeaponMods: normalizedItems(objective.usingWeaponMods), wearing: normalizedItems(objective.wearing), notWearing: normalizedItems(objective.notWearing), containsAll: normalizedItems(objective.containsAll), containsCategory: normalizedItems(objective.containsCategory), buildAttributes: objective.buildAttributes || null});
      if (type === "shoot" && !structuredEquipment.length) notices.push({taskId: task.id, taskName: taskLabel(task), objectiveId: text(objective.id), kind: "unverified-combat-equipment", message: `討伐条件（構造化された装備情報なし）：${objectiveLabel(objective)}`});
      if (!type || !handled.has(type)) notices.push({taskId: task.id, taskName: taskLabel(task), objectiveId: text(objective.id), kind: "unsupported-objective", message: `今回のレイド用に分類できません：${objectiveLabel(objective)}`});
    }
  }

  const keysById = new Map(), keyStates = [];
  for (const {id, task} of resolved) {
    const state = requirementStates[id] || {status: "idle", keys: []};
    keyStates.push({taskId: id, taskName: taskLabel(task), status: state.status || "idle"});
    if (state.status !== "ready") continue;
    for (const key of normalizedItems(state.keys)) {
      const idKey = text(key.id);
      if (!idKey) continue;
      const current = keysById.get(idKey) || {id: idKey, key, tasks: []};
      if (!current.tasks.some(entry => entry.id === id)) current.tasks.push({id, name: taskLabel(task), trader: text(task.trader)});
      keysById.set(idKey, current);
    }
  }

  return {
    maps: normalizeMapEntries(maps),
    keys: [...keysById.values()],
    keyStates,
    bring: [...bringCertain.values(), ...bringUncertain],
    find,
    give,
    equipment,
    notices: uniqueNotices(notices)
  };
}

export function loadRaidKeyRequirements(entries, {request, cache, onState}) {
  const loads = array(entries).filter(entry => entry?.task).map(entry => {
    if (typeof request !== "function") {onState(entry.id, {status: "failed", keys: []}); return Promise.resolve();}
    onState(entry.id, {status: "loading", keys: []});
    return cache.get(`requirements:${entry.id}`, () => request(entry.id), result => !!result?.verified)
      .then(result => onState(entry.id, {status: "ready", keys: array(result?.keys)}))
      .catch(() => onState(entry.id, {status: "failed", keys: []}));
  });
  return Promise.all(loads);
}
