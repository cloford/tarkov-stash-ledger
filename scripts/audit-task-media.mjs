import taskGuide from "../app/data/task-guide.json" with {type: "json"};

const visualTypes = new Set(["visit", "mark", "plantItem", "extract", "findQuestItem", "questItem"]);
const tasks = taskGuide.tasks.filter(task => task.wiki?.includes("escapefromtarkov.fandom.com/wiki/") && (task.objectives || []).some(objective => visualTypes.has(objective.type) || (objective.zones || []).some(zone => zone.position)));
const pageTitle = task => decodeURIComponent(new URL(task.wiki).pathname.split("/wiki/")[1] || "").replaceAll("_", " ");
const key = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
const extractorReject = /\.(png|jpe?g|webp)$/i;
const fileReject = /(icon|logo|button|flag|currency|trader|emoji)/i;
const rendererDecorative = /banner|icon|logo|button|flag|currency|thumbnail|grid.?image|trader|portrait|報酬|銃|弾薬/i;
const rendererItemWord = /(?:^|[^a-z0-9])(?:reward|weapon|rifle|shotgun|pistol|smg|ammo|armor|armour|helmet|headset|backpack|rig|dogtag|cash|rouble|dollar|euro)(?:[^a-z0-9]|$)/i;
const oldPositive = /map|地図|guide|location|場所|building|建物|entrance|入口|outside|外観|inside|interior|室内|room|部屋|floor|階|stairs|階段|door|扉|hall|corridor|通路|route|経路|objective|目的|plant|設置|stash|隠|spot|地点|zone|区域|extract|脱出|checkpoint|bridge|bunker|warehouse|office|shop|store|station|garage|dorm/i;
const mediaByPage = new Map();

for (let offset = 0; offset < tasks.length; offset += 20) {
  const batch = tasks.slice(offset, offset + 20), titles = batch.map(pageTitle), params = new URLSearchParams({action: "query", prop: "images", imlimit: "max", titles: titles.join("|"), format: "json", origin: "*"});
  let continuation = "";
  do {
    if (continuation) params.set("imcontinue", continuation); else params.delete("imcontinue");
    const response = await fetch(`https://escapefromtarkov.fandom.com/api.php?${params}`, {headers: {"user-agent": "Tarkov Task Extract Navi media audit/1.0"}, signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(`Wiki API ${response.status}`);
    const json = await response.json();
    for (const page of Object.values(json.query?.pages || {})) {
      const list = mediaByPage.get(key(page.title)) || [];
      for (const image of page.images || []) if (!list.includes(image.title)) list.push(image.title);
      mediaByPage.set(key(page.title), list);
    }
    continuation = json.continue?.imcontinue || "";
  } while (continuation);
  process.stdout.write(`\r監査中 ${Math.min(offset + batch.length, tasks.length)}/${tasks.length}`);
}

const taskWords = name => String(name || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(word => word.length >= 4 && !/^(part|the|from|with|into|create)$/.test(word));
const rows = tasks.map(task => {
  const raw = mediaByPage.get(key(pageTitle(task))) || [], available = raw.map(name => name.replace(/^File:/i, "")).filter(name => extractorReject.test(name) && !fileReject.test(name)), usable = available.filter(name => !rendererDecorative.test(name) && !rendererItemWord.test(name)), oldSelected = usable.filter(name => oldPositive.test(name) || taskWords(task.name).some(word => name.toLowerCase().includes(word)));
  return {id: task.id, name: task.name, raw: raw.length, available: available.length, oldSelected: oldSelected.length, improvedSelected: Math.min(12, usable.length), examples: usable.slice(0, 6), availableExamples: available.slice(0, 8)};
});
const missingBefore = rows.filter(row => row.available > 0 && row.oldSelected === 0 && row.improvedSelected > 0), stillMissing = rows.filter(row => row.available > 0 && row.improvedSelected === 0), healthCare = rows.find(row => row.name === "Health Care Privacy - Part 1");
console.log("\n" + JSON.stringify({auditedTasks: tasks.length, pagesWithUsableMedia: rows.filter(row => row.improvedSelected > 0).length, fixedByFallback: missingBefore.length, stillMissing: stillMissing.length, healthCare, examples: missingBefore.slice(0, 40).map(row => ({name: row.name, images: row.examples})), rejectedOnly: stillMissing.map(row => ({name: row.name, images: row.availableExamples}))}, null, 2));
