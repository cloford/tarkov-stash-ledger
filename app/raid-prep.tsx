"use client";
import {useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {buildRaidPrepSummary, loadRaidKeyRequirements, resolveRaidTasks, taskMapReferences} from "./raid-prep-utils.mjs";
import {taskDetailRequestCache} from "./task-request-cache.mjs";

type RequirementState = {status: "idle" | "loading" | "ready" | "failed"; keys: any[];};
type RaidPrepProps = {
  open: boolean;
  ids: string[];
  tasks: any[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpenTask: (id: string, trader: string) => void;
  onOpenKey: (id: string) => void;
  onOpenMap: (map: any) => void;
};

const displayItem = (item: any) => item?.nameJa || item?.shortName || item?.name || item?.id || "指定アイテム";
const displayEntryItems = (entry: any) => entry.items?.length > 1 ? `候補：${entry.items.map(displayItem).join("・")}` : displayItem(entry.item);
const taskName = (task: any) => task?.nameJa || task?.name || "名称不明のタスク";
const buildAttributeLabels: Record<string, string> = {accuracy: "精度", durability: "耐久値", effectiveDistance: "有効射程", ergonomics: "エルゴノミクス", height: "高さ", magazineCapacity: "マガジン装弾数", muzzleVelocity: "初速", recoil: "反動", weight: "重量", width: "幅"};
const equipmentDetails = (entry: any) => {
  const lines: string[] = [], add = (label: string, values: any[]) => {if (values?.length) lines.push(`${label}：${values.map(displayItem).join("・")}`);};
  if (entry.item) lines.push(`ベース：${displayItem(entry.item)}`);
  add("使用武器", entry.usingWeapon); add("武器パーツ", entry.usingWeaponMods); add("装備", entry.wearing); add("装備不可", entry.notWearing); add("必須パーツ", entry.containsAll); add("種類指定", entry.containsCategory);
  const attributes = Object.entries(entry.buildAttributes || {}).filter(([, requirement]: any) => Number(requirement?.value) !== 0).map(([name, requirement]: any) => `${buildAttributeLabels[name] || name} ${Number(requirement.value).toLocaleString()} ${requirement.compareMethod || ""}`.trim());
  if (attributes.length) lines.push(`性能：${attributes.join("・")}`);
  return lines;
};

export default function RaidPrep({open, ids, tasks, onClose, onRemove, onClear, onOpenTask, onOpenKey, onOpenMap}: RaidPrepProps) {
  const entries = useMemo(() => resolveRaidTasks(ids, tasks), [ids, tasks]);
  const [requirements, setRequirements] = useState<Record<string, RequirementState>>({});
  const updateRequirements = (taskId: string, state: RequirementState) => setRequirements(current => ({...current, [taskId]: state}));

  useEffect(() => {
    if (!open) return;
    void loadRaidKeyRequirements(entries, {request: window.stashAI?.requirements, cache: taskDetailRequestCache as any, onState: updateRequirements});
  }, [open, entries]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {if (event.key === "Escape") onClose();};
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);

  const summary = useMemo(() => buildRaidPrepSummary(entries, requirements), [entries, requirements]);
  if (!open) return null;
  const unresolved = entries.filter(entry => !entry.task), resolved = entries.filter(entry => entry.task);
  const loadingKeys = summary.keyStates.filter((state: any) => state.status === "loading" || state.status === "idle"), failedKeys = summary.keyStates.filter((state: any) => state.status === "failed");

  return <div className="raidPrepOverlay" role="presentation" onMouseDown={event => {if (event.target === event.currentTarget) onClose();}}>
    <aside className="raidPrepDrawer" role="dialog" aria-modal="true" aria-labelledby="raid-prep-title">
      <header className="raidPrepHeader"><div><small>NEXT RAID</small><h2 id="raid-prep-title">今回のレイド</h2><p>ゲーム内の完了状態とは別の、一時的な出撃準備リストです。</p></div><button type="button" onClick={onClose} aria-label="今回のレイドを閉じる">×</button></header>
      {!ids.length ? <div className="raidPrepEmpty"><b>登録タスクはありません</b><p>タスク詳細の「今回のレイドに追加」から、次の出撃で確認したいタスクを登録できます。</p></div> : <>
        <section className="raidPrepSelected"><header><div><small>SELECTED TASKS</small><h3>選択タスク</h3></div><button type="button" onClick={onClear}>全件解除</button></header><div>{entries.map(entry => {const maps = entry.task ? taskMapReferences(entry.task) : []; return entry.task ? <article key={entry.id}><button type="button" onClick={() => onOpenTask(entry.id, entry.task.trader)}><span>LV.{entry.task.level || "-"}</span><strong>{taskName(entry.task)}</strong><small>{entry.task.trader || "トレーダー不明"}</small><small className="raidPrepTaskMap">対象マップ：{maps.length ? maps.map((map: any) => map.nameJa || map.label || map.name).join("・") : "構造化データで確認できません"}</small></button><button type="button" onClick={() => onRemove(entry.id)} aria-label={`${taskName(entry.task)}を今回のレイドから外す`}>外す</button></article> : <article className="raidPrepMissing" key={entry.id}><div><strong>現在のデータではタスクを確認できません</strong><small>ID: {entry.id}</small></div><button type="button" onClick={() => onRemove(entry.id)} aria-label={`${entry.id}を今回のレイドから外す`}>外す</button></article>;})}</div></section>
        {unresolved.length > 0 && <p className="raidPrepCaution">保存した{unresolved.length}件は現在のタスクデータにありません。ほかの項目だけで集約を続けています。</p>}
        <RaidSection eyebrow="TARGET MAPS" title="対象マップ" empty={resolved.length > 0 && !summary.maps.length ? "構造化データ上、対象マップの指定はありません。" : ""}><div className="raidPrepMapList">{summary.maps.map((map: any) => <button type="button" key={map.id || map.name} onClick={() => onOpenMap(map)}><span>⌖</span><strong>{map.nameJa || map.label || map.name}</strong><small>MAPへ ›</small></button>)}</div></RaidSection>
        <RaidSection eyebrow="REQUIRED KEYS" title="必要な鍵" empty={!summary.keys.length && !loadingKeys.length && !failedKeys.length ? "確認できた構造化データ上、必要な鍵はありません。" : ""}><div className="raidPrepKeyList">{summary.keys.map((entry: any) => <button type="button" key={entry.id} onClick={() => onOpenKey(entry.id)}><strong>{displayItem(entry.key)}</strong><small>{entry.tasks.map((task: any) => task.name).join("・")}</small><span>鍵詳細へ ›</span></button>)}</div>{loadingKeys.length > 0 && <p className="raidPrepLoading" role="status">必要な鍵を確認中…（{loadingKeys.map((state: any) => state.taskName).join("・")}）</p>}{failedKeys.map((state: any) => <p className="raidPrepWarning" key={state.taskId}>鍵情報を取得できませんでした：{state.taskName}</p>)}</RaidSection>
        <RaidSection eyebrow="TAKE INTO RAID" title="持ち込み品" empty={!summary.bring.length ? "確認できる持ち込み品はありません。" : ""}><div className="raidPrepRows">{summary.bring.map((entry: any) => <article key={entry.id}><div><strong>{entry.certain ? displayItem(entry.item) : displayEntryItems(entry)}</strong><small>{entry.certain ? `確実な消費数 合計 ${entry.totalCount}個` : `必要数 ${entry.count}（${entry.note}）`}</small></div><ul>{entry.certain ? entry.details.map((detail: any) => <li key={`${detail.taskId}:${detail.objectiveId}`}>{detail.taskName}：{detail.count}個</li>) : <li>{entry.task.name}：{entry.description}</li>}</ul></article>)}</div></RaidSection>
        <RaidItemSection eyebrow="FIND IN RAID" title="現地回収" entries={summary.find} empty="確認できる現地回収品はありません。" />
        <RaidItemSection eyebrow="TURN IN AFTER RAID" title="帰還後納品" entries={summary.give} empty="確認できる納品物はありません。" />
        <RaidSection eyebrow="EQUIPMENT" title="装備・武器・防具条件" empty={!summary.equipment.length ? "構造化データ上、確認できる装備条件はありません。" : ""}><div className="raidPrepRows">{summary.equipment.map((entry: any) => {const details = equipmentDetails(entry); return <article key={entry.id}><div><strong>{entry.description}</strong><small>{entry.task.name}</small></div>{details.length > 0 && <ul>{details.map(detail => <li key={detail}>{detail}</li>)}</ul>}</article>;})}</div></RaidSection>
        <RaidSection eyebrow="CAUTIONS" title="未確認・分類できない情報" empty={!summary.notices.length ? "未確認事項はありません。" : ""}><div className="raidPrepNoticeList">{summary.notices.map((notice: any) => <p key={`${notice.taskId}:${notice.objectiveId}:${notice.kind}`}><strong>{notice.taskName}</strong><span>{notice.message}</span></p>)}</div></RaidSection>
      </>}
    </aside>
  </div>;
}

function RaidSection({eyebrow, title, empty, children}: {eyebrow: string; title: string; empty?: string; children: ReactNode;}) {
  return <section className="raidPrepSection"><header><small>{eyebrow}</small><h3>{title}</h3></header>{children}{empty && <p className="raidPrepSectionEmpty">{empty}</p>}</section>;
}

function RaidItemSection({eyebrow, title, entries, empty}: {eyebrow: string; title: string; entries: any[]; empty: string;}) {
  return <RaidSection eyebrow={eyebrow} title={title} empty={!entries.length ? empty : ""}><div className="raidPrepRows">{entries.map(entry => <article key={entry.id}><div><strong>{displayEntryItems(entry)} · 必要数 {entry.count}</strong><small>{entry.task.name}{entry.foundInRaid ? " · FIR必須" : ""}</small></div><p>{entry.description}</p></article>)}</div></RaidSection>;
}
