const STATUS_LABELS = new Map([
  ["0", "ロック中"],
  ["locked", "ロック中"],
  ["1", "開始可能"],
  ["availableforstart", "開始可能"],
  ["2", "進行中"],
  ["active", "進行中"],
  ["3", "完了報告可能"],
  ["availableforfinish", "完了報告可能"],
  ["4", "完了"],
  ["complete", "完了"],
  ["5", "失敗"],
  ["failed", "失敗"],
  ["6", "失敗・再挑戦可能"],
  ["failedrestartable", "失敗・再挑戦可能"],
  ["7", "失敗扱い"],
  ["markedfailed", "失敗扱い"],
  ["8", "期限切れ"],
  ["expired", "期限切れ"],
  ["9", "待機期間後に開始可能"],
  ["availableafter", "待機期間後に開始可能"]
]);

const array = value => Array.isArray(value) ? value : [];
const taskId = task => String(task?.id || "");
const gameMode = (task, fallback = "regular") => String(task?.gameMode || task?.mode || fallback || "regular").toLowerCase();
const relationKey = (mode, id) => `${mode}\u0000${id}`;

export function taskStatusLabels(values) {
  const statuses = array(values);
  if (!statuses.length) return ["状態を確認できません"];
  return [...new Set(statuses.map(value => {
    const raw = String(value ?? "").trim();
    const normalized = raw.replace(/[\s_-]/g, "").toLowerCase();
    return STATUS_LABELS.get(normalized) || `不明な状態（${raw || "値なし"}）`;
  }))];
}

function mergedRequirements(task) {
  const merged = new Map();
  for (const requirement of array(task?.prerequisites)) {
    const id = String(requirement?.id || requirement?.task?.id || requirement?.task || "");
    if (!id) continue;
    const current = merged.get(id) || {id, name: requirement?.name || requirement?.task?.name || id, nameJa: requirement?.nameJa || requirement?.task?.nameJa || "", status: []};
    current.status = [...new Set([...current.status, ...array(requirement?.status)])];
    if (!current.nameJa && requirement?.nameJa) current.nameJa = requirement.nameJa;
    merged.set(id, current);
  }
  return [...merged.values()];
}

export function buildTaskRelationIndex(tasks, options = {}) {
  const defaultGameMode = String(options.defaultGameMode || "regular").toLowerCase();
  const byKey = new Map();
  const successorsByKey = new Map();
  const normalizedTasks = array(tasks).filter(task => task && typeof task === "object" && taskId(task));

  for (const task of normalizedTasks) byKey.set(relationKey(gameMode(task, defaultGameMode), taskId(task)), task);
  for (const task of normalizedTasks) {
    const mode = gameMode(task, defaultGameMode);
    for (const requirement of mergedRequirements(task)) {
      const key = relationKey(mode, requirement.id);
      const current = successorsByKey.get(key) || new Map();
      const successorId = taskId(task);
      const prior = current.get(successorId) || {task, status: []};
      prior.status = [...new Set([...prior.status, ...requirement.status])];
      current.set(successorId, prior);
      successorsByKey.set(key, current);
    }
  }

  return {
    defaultGameMode,
    byKey,
    successorsByKey,
    completeByMode: normalizedTasks.reduce((result, task) => {
      const mode = gameMode(task, defaultGameMode);
      result.set(mode, (result.get(mode) ?? true) && task.relationsAvailable !== false);
      return result;
    }, new Map())
  };
}

export function directTaskRelations(index, task) {
  const mode = gameMode(task, index?.defaultGameMode);
  const prerequisites = mergedRequirements(task).map(requirement => ({
    ...requirement,
    task: index?.byKey?.get(relationKey(mode, requirement.id)) || null,
    missing: !index?.byKey?.has(relationKey(mode, requirement.id))
  }));
  const successorMap = index?.successorsByKey?.get(relationKey(mode, taskId(task))) || new Map();
  return {
    mode,
    prerequisites,
    successors: [...successorMap.values()].map(entry => ({...entry, missing: false})),
    prerequisitesAvailable: task?.relationsAvailable !== false,
    successorsAvailable: index?.completeByMode?.get(mode) !== false
  };
}

export function expandTaskPrerequisites(index, task, options = {}) {
  const maxDepth = Math.max(1, Number(options.maxDepth) || 8);
  const maxNodes = Math.max(1, Number(options.maxNodes) || 100);
  const mode = gameMode(task, index?.defaultGameMode);
  const rootKey = relationKey(mode, taskId(task));
  const expanded = new Set([rootKey]);
  let nodeCount = 0;
  let limitReached = false;

  const visit = (owner, depth, path) => {
    const nodes = [];
    for (const requirement of mergedRequirements(owner)) {
      if (nodeCount >= maxNodes) {
        limitReached = true;
        break;
      }
    const key = relationKey(mode, requirement.id);
    const referenced = index?.byKey?.get(key) || null;
    nodeCount += 1;
    if (!referenced) {nodes.push({...requirement, task: null, missing: true, children: []}); continue;}
    if (path.has(key)) {nodes.push({...requirement, task: referenced, cycle: true, children: []}); continue;}
    if (expanded.has(key)) {nodes.push({...requirement, task: referenced, duplicate: true, children: []}); continue;}
    const hasChildren = mergedRequirements(referenced).length > 0;
    if (depth >= maxDepth) {
      limitReached ||= hasChildren;
      nodes.push({...requirement, task: referenced, truncated: hasChildren, children: []});
      continue;
    }
    expanded.add(key);
    const nextPath = new Set(path);
    nextPath.add(key);
    nodes.push({...requirement, task: referenced, children: visit(referenced, depth + 1, nextPath)});
    }
    return nodes;
  };

  return {nodes: visit(task, 1, new Set([rootKey])), nodeCount, limitReached};
}
