const array = value => Array.isArray(value) ? value : [];
const record = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};

// 保存済みデータは古い版や中断した更新で不完全になることがあるため、描画前に配列項目を固定する。
export function normalizeTaskGuideRuntime(value, fallback) {
  const source = value && typeof value === "object" && !Array.isArray(value) && Array.isArray(value.tasks) ? value : fallback;
  const guide = record(source);
  return {
    ...guide,
    tasks: array(guide.tasks).filter(task => task && typeof task === "object").map(task => ({...task, objectives: array(task.objectives), prerequisites: array(task.prerequisites)})),
    story: array(guide.story),
    battlePass: array(guide.battlePass)
  };
}

export function normalizeMapRuntime(value) {
  const source = Array.isArray(value) ? {maps: value, source: "従来キャッシュ", updatedAt: null} : record(value);
  return {
    ...source,
    maps: array(source.maps).filter(map => map && typeof map === "object").map(map => ({...map, extracts: array(map.extracts), transits: array(map.transits)}))
  };
}
