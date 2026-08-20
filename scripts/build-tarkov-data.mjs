import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const quests = JSON.parse(await fs.readFile(path.join(root, "work/quests.json"), "utf8"));
const hideout = JSON.parse(await fs.readFile(path.join(root, "work/hideout.json"), "utf8"));
const names = JSON.parse(await fs.readFile(path.join(root, "work/items.en.json"), "utf8"));
const byId = new Map();
const ignored = new Set([
  "5449016a4bdc2d6f028b456f", // Roubles
  "569668774bdc2da2298b4568", // Euros
  "5696686a4bdc2da3298b456a", // Dollars
]);

function ensure(id) {
  if (!names[id] || ignored.has(id)) return null;
  if (!byId.has(id)) {
    byId.set(id, {
      id,
      name: names[id].name,
      shortName: names[id].shortName,
      quest: 0,
      hideout: 0,
      foundInRaid: false,
      quests: [],
      modules: [],
    });
  }
  return byId.get(id);
}

for (const quest of quests) {
  for (const objective of quest.objectives ?? []) {
    if (!["find", "collect"].includes(objective.type)) continue;
    const item = ensure(objective.target);
    if (!item) continue;
    const count = Number(objective.number) || 1;
    item.quest += count;
    item.foundInRaid ||= objective.type === "find";
    item.quests.push({ name: quest.title, count, foundInRaid: objective.type === "find" });
  }
}

for (const module of hideout.modules) {
  for (const requirement of module.require ?? []) {
    if (requirement.type !== "item") continue;
    const item = ensure(requirement.name);
    if (!item) continue;
    const count = Number(requirement.quantity) || 1;
    item.hideout += count;
    item.modules.push({ name: `${module.module} Lv.${module.level}`, count });
  }
}

const data = [...byId.values()]
  .filter((item) => item.quest > 0 || item.hideout > 0)
  .sort((a, b) => (b.quest + b.hideout) - (a.quest + a.hideout) || a.name.localeCompare(b.name));

await fs.mkdir(path.join(root, "public/items"), { recursive: true });
await fs.mkdir(path.join(root, "app/data"), { recursive: true });
await fs.writeFile(path.join(root, "app/data/items.json"), JSON.stringify(data, null, 2));

let cursor = 0;
async function worker() {
  while (cursor < data.length) {
    const item = data[cursor++];
    const destination = path.join(root, "public/items", `${item.id}.webp`);
    try {
      await fs.access(destination);
      continue;
    } catch {}
    const response = await fetch(`https://assets.tarkov.dev/${item.id}-grid-image.webp`);
    if (!response.ok) {
      console.warn(`image ${response.status}: ${item.name}`);
      continue;
    }
    await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  }
}

await Promise.all(Array.from({ length: 10 }, worker));
console.log(`Built ${data.length} tracked items.`);
