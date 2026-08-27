const decorative = /banner|icon|logo|button|flag|currency|thumbnail|grid.?image|trader|portrait|報酬|銃|弾薬/i;
const itemWord = /(?:^|[^a-z0-9])(?:reward|weapon|rifle|shotgun|pistol|smg|ammo|armor|armour|helmet|headset|backpack|rig|dogtag|cash|rouble|dollar|euro)(?:[^a-z0-9]|$)/i;
const visualWord = /map|地図|guide|location|場所|ambulance|vehicle|truck|van|building|建物|entrance|入口|outside|外観|inside|interior|室内|room|部屋|floor|階|stairs|階段|door|扉|hall|corridor|通路|route|経路|objective|目的|plant|設置|stash|隠|spot|地点|zone|区域|extract|脱出|checkpoint|bridge|bunker|warehouse|office|shop|store|station|garage|dorm|resort|tunnel|helicopter|camp|tower|roof|key|body|corpse/i;
const stop = new Set(["part", "the", "from", "with", "into", "create", "locate", "find", "mark", "place", "escape", "tarkov"]);
const compact = value => String(value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[^\p{L}\p{N}]/gu, "");
const tokens = value => String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(word => word.length >= 3 && !stop.has(word));

export function selectTaskReferenceImages(images, task) {
  const usable = (Array.isArray(images) ? images : []).filter(image => {
    const caption = String(image?.caption || ""), url = String(image?.url || "");
    if (!url || decorative.test(caption) || itemWord.test(caption) || /assets\.tarkov\.dev|\/items?\/|\/traders?\//i.test(url)) return false;
    return !(image.width && image.height && image.width <= 128 && image.height <= 128);
  }), taskTokens = tokens(task?.name), objectiveTokens = [...new Set((task?.objectives || []).flatMap(objective => tokens(`${objective.description || ""} ${objective.descriptionJa || ""}`)))], acronymWords = String(task?.name || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(word => word.length >= 3), acronym = [...acronymWords.map(word => word[0]), ...(String(task?.name || "").match(/\d+/g) || [])].join("");
  return usable.map((image, index) => {
    const caption = String(image.caption || "").toLowerCase(), key = compact(caption);
    let score = visualWord.test(caption) ? 6 : 0;
    if (acronym.length >= 3 && key.includes(acronym)) score += 10;
    score += taskTokens.reduce((total, word) => total + (key.includes(compact(word)) ? 2 : 0), 0);
    score += objectiveTokens.reduce((total, word) => total + (key.includes(compact(word)) ? 3 : 0), 0);
    return {image, index, score};
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(entry => entry.image).slice(0, 12);
}
