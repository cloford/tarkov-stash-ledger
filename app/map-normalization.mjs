const canonicalMaps = [
  {id: "55f2d3fd4bdc2d5f408b4567", name: "Factory", nameJa: "ファクトリー", slug: "factory", ids: ["55f2d3fd4bdc2d5f408b4567", "59fc81d786f774390775787e"], aliases: ["Factory", "Night Factory", "factory4_day", "factory4_night"]},
  {id: "653e6760052c01c1c805532f", name: "Ground Zero", nameJa: "グラウンドゼロ", slug: "ground-zero", ids: ["653e6760052c01c1c805532f", "65b8d6f5cdde2479cb2a3125", "68236e8153654e8c1200798a"], aliases: ["Ground Zero", "Ground Zero 21+", "Ground Zero Tutorial", "Ground Zero チュートリアル", "Sandbox", "Sandbox_high"]},
  {id: "5b0fc42d86f7744a585f9105", name: "The Lab", nameJa: "研究所", slug: "the-lab", ids: ["5b0fc42d86f7744a585f9105", "6a294a5b5eb5f9a1700417b7"], aliases: ["The Lab", "The Lab (Dark)", "laboratory"]},
  {id: "56f40101d2720b2a4d8b45d6", name: "Customs", nameJa: "カスタム", slug: "customs", ids: ["56f40101d2720b2a4d8b45d6"], aliases: ["Customs", "bigmap"]},
  {id: "5704e3c2d2720bac5b8b4567", name: "Woods", nameJa: "ウッズ", slug: "woods", ids: ["5704e3c2d2720bac5b8b4567"], aliases: ["Woods"]},
  {id: "5704e4dad2720bb55b8b4567", name: "Lighthouse", nameJa: "ライトハウス", slug: "lighthouse", ids: ["5704e4dad2720bb55b8b4567"], aliases: ["Lighthouse"]},
  {id: "5704e554d2720bac5b8b456e", name: "Shoreline", nameJa: "ショアライン", slug: "shoreline", ids: ["5704e554d2720bac5b8b456e"], aliases: ["Shoreline"]},
  {id: "5704e5fad2720bc05b8b4567", name: "Reserve", nameJa: "リザーブ", slug: "reserve", ids: ["5704e5fad2720bc05b8b4567"], aliases: ["Reserve", "RezervBase"]},
  {id: "5714dbc024597771384a510d", name: "Interchange", nameJa: "インターチェンジ", slug: "interchange", ids: ["5714dbc024597771384a510d"], aliases: ["Interchange"]},
  {id: "5714dc692459777137212e12", name: "Streets of Tarkov", nameJa: "ストリート・オブ・タルコフ", slug: "streets-of-tarkov", ids: ["5714dc692459777137212e12"], aliases: ["Streets of Tarkov", "Streets", "TarkovStreets"]},
  {id: "6733700029c367a3d40b02af", name: "The Labyrinth", nameJa: "ラビリンス", slug: "the-labyrinth", ids: ["6733700029c367a3d40b02af"], aliases: ["The Labyrinth", "Labyrinth"]},
  {id: "69af492a4819ea4ba10a69c5", name: "Icebreaker", nameJa: "アイスブレーカー", slug: "icebreaker", ids: ["69af492a4819ea4ba10a69c5"], aliases: ["Icebreaker"]}
];

export function normalizeMapToken(value) {return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[^\p{L}\p{N}]/gu, "");}

function knownMap(reference) {
  if (!reference) return null;
  const map = typeof reference === "string" ? {name: reference} : reference;
  const id = String(map.id || "").toLowerCase();
  const names = [map.name, map.nameJa, map.normalizedName, map.slug, map.nameId].map(normalizeMapToken).filter(Boolean);
  const byId = canonicalMaps.find(candidate => candidate.ids.some(candidateId => candidateId.toLowerCase() === id));
  if (byId || id) return byId || null;
  return canonicalMaps.find(candidate => names.some(name => candidate.aliases.some(alias => normalizeMapToken(alias) === name))) || null;
}

export function mapLocation(reference) {
  const map = typeof reference === "string" ? {name: reference} : (reference || {});
  const canonical = knownMap(map);
  if (canonical) return {id: canonical.id, name: canonical.name, nameJa: canonical.nameJa, label: canonical.nameJa, slug: canonical.slug, sourceIds: [String(map.id || ""), canonical.id].filter((value, index, all) => value && all.indexOf(value) === index)};
  const id = String(map.id || ""), name = String(map.name || map.nameJa || map.normalizedName || map.slug || "");
  return {id, name, nameJa: String(map.nameJa || ""), label: String(map.nameJa || name), slug: String(map.slug || ""), sourceIds: id ? [id] : []};
}

export function normalizeMapEntries(entries) {
  const result = new Map();
  for (const map of (entries || []).filter(map => map && (map.name || map.nameJa || map.id))) {
    const normalized = mapLocation(map), key = knownMap(map) ? `known:${normalized.id}` : `unknown:${normalized.id || normalizeMapToken(normalized.name)}`, current = result.get(key);
    result.set(key, current ? {...current, sourceIds: [...new Set([...current.sourceIds, ...normalized.sourceIds])]} : {...map, ...normalized});
  }
  return [...result.values()];
}

export function sameMapLocation(left, right) {
  const leftKnown = knownMap(left), rightKnown = knownMap(right);
  if (leftKnown || rightKnown) return Boolean(leftKnown && rightKnown && leftKnown.id === rightKnown.id);
  const leftId = String(left?.id || ""), rightId = String(right?.id || "");
  if (leftId && rightId) return leftId === rightId;
  return normalizeMapToken(left?.name || left?.nameJa) === normalizeMapToken(right?.name || right?.nameJa);
}
