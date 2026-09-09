import {normalizeKeyText} from "./key-wiki-utils.mjs";
import {mapLocation} from "./map-normalization.mjs";

export const normalizeQuickSearchText = normalizeKeyText;

const list = value => Array.isArray(value) ? value : [];
const text = values => values.filter(Boolean).join(" ");

export function createQuickSearchCatalog({tasks, keys, maps} = {}) {
  const unavailable = [];
  if (!Array.isArray(tasks)) unavailable.push("タスク");
  if (!Array.isArray(keys)) unavailable.push("鍵");
  if (!Array.isArray(maps)) unavailable.push("脱出地点");
  const entries = [
    ...list(tasks).filter(task => task && task.id).map(task => ({
      id: `task:${task.id}`, kind: "task", label: "タスク", title: task.nameJa || task.name || "名称未登録", subtitle: task.nameJa && task.name && normalizeKeyText(task.nameJa) !== normalizeKeyText(task.name) ? task.name : "", taskId: task.id, trader: task.trader || "", map: list(task.objectives).flatMap(objective => list(objective?.maps)).map(mapLocation)[0] || (task.map ? mapLocation({id: task.mapId, name: task.map, nameJa: task.mapJa}) : null),
      searchText: normalizeKeyText(text([task.nameJa, task.name, task.shortName, task.trader, ...list(task.aliases), ...list(task.objectives).flatMap(objective => [objective?.description, objective?.descriptionJa])]))
    })),
    ...list(keys).filter(key => key && key.id).map(key => ({
      id: `key:${key.id}`, kind: "key", label: "鍵", title: key.name || key.nameEn || "名称未登録", subtitle: key.name && key.nameEn && normalizeKeyText(key.name) !== normalizeKeyText(key.nameEn) ? key.nameEn : "", keyId: key.id, map: list(key.mapUses).map(mapLocation)[0] || null,
      searchText: normalizeKeyText(text([key.name, key.nameEn, key.shortName, ...list(key.aliases), ...list(key.mapUses).flatMap(map => [map?.name, map?.nameEn, map?.nameJa]), ...list(key.tasks).flatMap(task => [task?.name, task?.nameEn])]))
    })),
    ...list(maps).flatMap(map => list(map?.extracts).filter(extract => extract?.name).map((extract, index) => {
      const location = mapLocation(map);
      return {id: `extract:${location.id || location.name}:${extract.id || index}:${extract.name}`, kind: "extract", label: "脱出地点", title: extract.name, subtitle: "", map: location, extractName: extract.name, searchText: normalizeKeyText(text([extract.name, extract.nameJa, extract.shortName, ...list(extract.aliases), location.name, location.nameJa, location.slug]))};
    }))
  ];
  return {entries, unavailable};
}

export function findQuickSearchResults(catalog, query, limit = 50) {
  const needle = normalizeKeyText(query);
  if (!needle) return [];
  return list(catalog?.entries).filter(entry => entry.searchText.includes(needle)).slice(0, limit);
}
