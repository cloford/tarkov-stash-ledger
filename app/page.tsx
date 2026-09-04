"use client";
import {lazy, Suspense, useEffect, useState} from "react";
import TaskGuidePage from "./task-guide-page";

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
  const [guideReset, setGuideReset] = useState(0);
  useEffect(() => {const valid = (value: any): value is Page => ["guide", "maps", "keys"].includes(value); if (!valid(history.state?.stashPage)) history.replaceState({...history.state, stashPage: "guide"}, ""); const restore = (event: PopStateEvent) => {if (valid(event.state?.stashPage)) setPage(event.state.stashPage);}; window.addEventListener("popstate", restore); return () => window.removeEventListener("popstate", restore);}, []);
  const openPage = (next: Page) => {if (next === "guide") {const state = {...history.state, stashPage: "guide", guideSection: "tasks", guideView: "traders", guideSelected: "", guideTrader: ""}; if (page === "guide") history.replaceState(state, ""); else history.pushState(state, ""); setPage("guide"); setGuideReset(value => value + 1); return;} if (next !== page) {let state: any = {...history.state, stashPage: next}; try {const last = JSON.parse(sessionStorage.getItem("tarkov-map-last-view") || "{}"); state = {...state, mapStage: last.selected || ""};} catch {state = {...state, mapStage: ""};} history.pushState(state, "");} setPage(next);};
  const openTaskFromKey = (taskId: string, trader: string) => {history.pushState({...history.state, stashPage: "guide", guideSection: "tasks", guideView: "detail", guideSelected: taskId, guideTrader: trader}, ""); setPage("guide"); setGuideReset(value => value + 1);};
  const warmTab = (next: Page) => {if (next === "maps") void loadMapTab(); if (next === "keys") void loadKeyWiki();};
  return <main><nav className="mainNav">{([["guide", "タスク情報"], ["maps", "MAP"], ["keys", "鍵WIKI"]] as const).map(([key, label], index) => <button className={page === key ? "active" : ""} onClick={() => openPage(key)} onPointerEnter={() => warmTab(key)} onFocus={() => warmTab(key)} key={key}><span>0{index + 1}</span>{label}</button>)}</nav>
    {page === "guide" && <TaskGuidePage key={guideReset} />}
    {page === "maps" && <Suspense fallback={<TabLoading label="MAP" />}><MapTab /></Suspense>}
    {page === "keys" && <Suspense fallback={<TabLoading label="鍵WIKI" />}><KeyWiki onOpenTask={openTaskFromKey} /></Suspense>}
    <footer>DATA: TARKOVDATA · TARKOV.DEV · EFT WIKI <span>タスク・マップ・鍵の情報を表示します</span></footer></main>;
}
