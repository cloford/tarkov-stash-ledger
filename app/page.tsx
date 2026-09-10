"use client";
import {lazy, Suspense, useCallback, useEffect, useState} from "react";
import TaskGuidePage from "./task-guide-page";
import QuickSearch from "./quick-search";
import RaidPrep from "./raid-prep";
import bundledTaskGuide from "./data/task-guide.json";
import {normalizeTaskGuideRuntime} from "./runtime-data.mjs";
import {parseRaidTaskIds, RAID_PREP_STORAGE_KEY, sanitizeRaidTaskIds, updateRaidTaskIds} from "./raid-prep-utils.mjs";

type Page = "guide" | "maps" | "keys";
const loadMapTab = () => import("./map-tab");
const loadKeyWiki = () => import("./key-wiki");
const MapTab = lazy(loadMapTab);
const KeyWiki = lazy(loadKeyWiki);

function TabLoading({label}: {label: string}) {
  return <section className="tabLoading" role="status" aria-live="polite"><i aria-hidden="true" /><strong>{label}を読み込み中…</strong><span>タスク情報やほかのタブは引き続き操作できます。</span></section>;
}
export default function Home() {
  const [page, setPage] = useState<Page>("guide");
  const [guideReset, setGuideReset] = useState(0), [mapReset, setMapReset] = useState(0), [keyReset, setKeyReset] = useState(0);
  const [raidOpen, setRaidOpen] = useState(false), [raidTaskIds, setRaidTaskIds] = useState<string[]>([]), [raidTasks, setRaidTasks] = useState<any[]>(() => normalizeTaskGuideRuntime(bundledTaskGuide, bundledTaskGuide).tasks);
  useEffect(() => {try {const saved = parseRaidTaskIds(localStorage.getItem(RAID_PREP_STORAGE_KEY)); setRaidTaskIds(saved); localStorage.setItem(RAID_PREP_STORAGE_KEY, JSON.stringify(saved)); const cached = localStorage.getItem("tarkov-task-guide-cache"); if (cached) setRaidTasks(normalizeTaskGuideRuntime(JSON.parse(cached), bundledTaskGuide).tasks);} catch {}}, []);
  useEffect(() => {const valid = (value: any): value is Page => ["guide", "maps", "keys"].includes(value); if (!valid(history.state?.stashPage)) history.replaceState({...history.state, stashPage: "guide"}, ""); const restore = (event: PopStateEvent) => {if (valid(event.state?.stashPage)) setPage(event.state.stashPage);}; window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);}, []);
  const saveRaidTaskIds = useCallback((value: unknown) => {const next = sanitizeRaidTaskIds(value); setRaidTaskIds(next); try {localStorage.setItem(RAID_PREP_STORAGE_KEY, JSON.stringify(next));} catch {}}, []);
  const setRaidTask = useCallback((taskId: string, included: boolean) => setRaidTaskIds(current => {const next = updateRaidTaskIds(current, taskId, included); try {localStorage.setItem(RAID_PREP_STORAGE_KEY, JSON.stringify(next));} catch {} return next;}), []);
  const openPage = (next: Page) => {if (next === "guide") {const state = {...history.state, stashPage: "guide", guideSection: "tasks", guideView: "traders", guideSelected: "", guideTrader: "", mapExtract: null}; if (page === "guide") history.replaceState(state, ""); else history.pushState(state, ""); setPage("guide"); setGuideReset(value => value + 1); return;} if (next !== page) {let state: any = {...history.state, stashPage: next, mapExtract: null}; try {const last = JSON.parse(sessionStorage.getItem("tarkov-map-last-view") || "{}"); state = {...state, mapStage: last.selected || ""};} catch {state = {...state, mapStage: ""};} history.pushState(state, "");} setPage(next);};
  const openTaskFromKey = (taskId: string, trader: string) => {history.pushState({...history.state, stashPage: "guide", guideSection: "tasks", guideView: "detail", guideSelected: taskId, guideTrader: trader, guideRaidReturn: false}, ""); setRaidOpen(false); setPage("guide"); setGuideReset(value => value + 1);};
  const openTaskFromRaid = (taskId: string, trader: string) => {history.pushState({...history.state, stashPage: "guide", guideSection: "tasks", guideView: "detail", guideSelected: taskId, guideTrader: trader, guideRaidReturn: true}, ""); setRaidOpen(false); setPage("guide"); setGuideReset(value => value + 1);};
  const openKeyFromSearch = (keyId: string) => {history.pushState({...history.state, stashPage: "keys", keySelected: keyId}, ""); setRaidOpen(false); setPage("keys"); setKeyReset(value => value + 1);};
  const openExtractFromSearch = (map: any, extractName: string) => {history.pushState({...history.state, stashPage: "maps", mapStage: map?.name || map?.nameJa || "", mapExtract: {map, name: extractName}}, ""); setPage("maps"); setMapReset(value => value + 1);};
  const openMapFromRaid = (map: any) => {history.pushState({...history.state, stashPage: "maps", mapStage: map?.name || map?.nameJa || "", mapExtract: null}, ""); setRaidOpen(false); setPage("maps"); setMapReset(value => value + 1);};
  const warmTab = (next: Page) => {if (next === "maps") void loadMapTab(); if (next === "keys") void loadKeyWiki();};
  return <main><nav className="mainNav">{([["guide", "タスク情報"], ["maps", "MAP"], ["keys", "鍵WIKI"]] as const).map(([key, label], index) => <button className={page === key ? "active" : ""} onClick={() => openPage(key)} onPointerEnter={() => warmTab(key)} onFocus={() => warmTab(key)} key={key}><span>0{index + 1}</span>{label}</button>)}<QuickSearch onOpenTask={openTaskFromKey} onOpenKey={openKeyFromSearch} onOpenExtract={openExtractFromSearch} /><button type="button" className={`raidPrepTrigger ${raidOpen ? "active" : ""}`} onClick={() => setRaidOpen(true)}><span>04</span>今回のレイド：{raidTaskIds.length}件</button></nav>
    <RaidPrep open={raidOpen} ids={raidTaskIds} tasks={raidTasks} onClose={() => setRaidOpen(false)} onRemove={id => setRaidTask(id, false)} onClear={() => saveRaidTaskIds([])} onOpenTask={openTaskFromRaid} onOpenKey={openKeyFromSearch} onOpenMap={openMapFromRaid} />
    {page === "guide" && <TaskGuidePage key={guideReset} raidTaskIds={raidTaskIds} onRaidTaskChange={setRaidTask} onTasksChange={setRaidTasks} onReturnToRaid={() => setRaidOpen(true)} />}
    {page === "maps" && <Suspense fallback={<TabLoading label="MAP" />}><MapTab key={mapReset} /></Suspense>}
    {page === "keys" && <Suspense fallback={<TabLoading label="鍵WIKI" />}><KeyWiki key={keyReset} onOpenTask={openTaskFromKey} /></Suspense>}
    <footer>DATA: TARKOVDATA · TARKOV.DEV · EFT WIKI <span>タスク・マップ・鍵の情報を表示します</span></footer></main>;
}
