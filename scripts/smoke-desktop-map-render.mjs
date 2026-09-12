import {spawn} from "node:child_process";
import {createServer} from "node:net";
import {existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import electronPath from "electron";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(projectRoot, "electron", "main.cjs");
const desktopEntry = path.join(projectRoot, "desktop-dist", "index.html");
if (!existsSync(desktopEntry)) throw new Error("desktop-dist がありません。先に npm run desktop:bundle を実行してください。");

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close(error => error ? reject(error) : resolve(address.port));
  });
});
const waitForPage = async (port, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find(target => target.type === "page" && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await delay(150);
  }
  throw new Error("Electronの描画ページへ接続できませんでした");
};
const connectCdp = url => new Promise((resolve, reject) => {
  const socket = new WebSocket(url);
  const pending = new Map();
  const runtimeErrors = [];
  let nextId = 1;
  socket.addEventListener("error", reject, {once: true});
  socket.addEventListener("open", () => {
    socket.addEventListener("message", event => {
      const message = JSON.parse(String(event.data));
      if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails?.text || "JavaScript例外");
      if (!message.id || !pending.has(message.id)) return;
      const {resolve: resolveCall, reject: rejectCall} = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) rejectCall(new Error(message.error.message));
      else resolveCall(message.result);
    });
    const call = (method, params = {}) => new Promise((resolveCall, rejectCall) => {
      const id = nextId++;
      pending.set(id, {resolve: resolveCall, reject: rejectCall});
      socket.send(JSON.stringify({id, method, params}));
    });
    resolve({socket, call, runtimeErrors});
  }, {once: true});
});
const evaluate = async (cdp, expression) => {
  const response = await cdp.call("Runtime.evaluate", {expression, awaitPromise: true, returnByValue: true});
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result?.value;
};
const waitFor = (selector, timeoutMs = 12000) => `(async()=>{const end=Date.now()+${timeoutMs};while(Date.now()<end){if(document.querySelector(${JSON.stringify(selector)}))return true;await new Promise(resolve=>setTimeout(resolve,50));}return false})()`;

const port = await freePort();
const child = spawn(electronPath, [`--remote-debugging-port=${port}`, entry], {
  cwd: projectRoot,
  env: {...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true"},
  stdio: ["ignore", "pipe", "pipe"]
});
let processOutput = "";
child.stdout.on("data", chunk => {processOutput += chunk;});
child.stderr.on("data", chunk => {processOutput += chunk;});
let cdp, previousRaidIds, previousGuideView;

try {
  const page = await waitForPage(port);
  cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.call("Runtime.enable");
  await cdp.call("Page.enable");
  if (!await evaluate(cdp, waitFor(".mainNav"))) throw new Error("アプリの初期画面を表示できませんでした");
  previousRaidIds = await evaluate(cdp, `localStorage.getItem("tarkov-raid-prep-task-ids")`);
  previousGuideView = await evaluate(cdp, `sessionStorage.getItem("tarkov-task-last-view")`);
  await evaluate(cdp, `localStorage.setItem("tarkov-raid-prep-task-ids","[]");sessionStorage.removeItem("tarkov-task-last-view")`);
  await cdp.call("Page.reload", {ignoreCache: true});
  if (!await evaluate(cdp, waitFor(".traderPortraitGrid"))) throw new Error("今回のレイド検証用にタスクTOPを表示できませんでした");
  await evaluate(cdp, `localStorage.setItem("tarkov-raid-prep-task-ids",JSON.stringify(["missing-task-id"]))`);
  await cdp.call("Page.reload", {ignoreCache: true});
  if (!await evaluate(cdp, waitFor(".raidPrepTrigger"))) throw new Error("欠損タスクIDを復元できませんでした");
  await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.click()`);
  if (!await evaluate(cdp, waitFor(".raidPrepMissing"))) throw new Error("欠損タスクIDの確認不能表示を確認できませんでした");
  await evaluate(cdp, `document.querySelector(".raidPrepMissing>button")?.click();document.querySelector(".raidPrepHeader>button")?.click()`);
  if (!String(await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.textContent||""`)).includes("0件")) throw new Error("欠損タスクIDを解除できませんでした");
  await evaluate(cdp, `Array.from(document.querySelectorAll(".taskViewSwitch button")).find(button=>button.textContent.includes("全タスク"))?.click()`);
  if (!await evaluate(cdp, waitFor(".guideTaskCards button"))) throw new Error("今回のレイドへ追加するタスクを表示できませんでした");
  await evaluate(cdp, `document.querySelector(".guideTaskCards button")?.click()`);
  if (!await evaluate(cdp, waitFor(".taskRaidToggle"))) throw new Error("タスク詳細の今回のレイドボタンを表示できませんでした");
  await evaluate(cdp, `document.querySelector(".taskRaidToggle")?.click()`);
  if (!String(await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.textContent||""`)).includes("1件")) throw new Error("今回のレイド件数へ追加結果が反映されませんでした");
  await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.click()`);
  if (!await evaluate(cdp, waitFor(".raidPrepDrawer .raidPrepSelected article"))) throw new Error("今回のレイドパネルに選択タスクを表示できませんでした");
  if (!/対象マップ：/.test(String(await evaluate(cdp, `document.querySelector(".raidPrepSelected article")?.textContent||""`)))) throw new Error("選択タスクごとの対象マップ表示を確認できませんでした");
  await evaluate(cdp, `document.querySelector(".raidPrepHeader>button")?.click()`);
  await cdp.call("Page.reload", {ignoreCache: true});
  if (!await evaluate(cdp, waitFor(".raidPrepTrigger"))) throw new Error("今回のレイド保存後に再表示できませんでした");
  if (!String(await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.textContent||""`)).includes("1件")) throw new Error("再起動相当の再読み込みで今回のレイド件数を復元できませんでした");
  await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.click()`);
  await evaluate(cdp, `document.querySelector(".raidPrepSelected article>button:first-child")?.click()`);
  if (!await evaluate(cdp, waitFor(".taskRaidToggle.inRaid"))) throw new Error("今回のレイドからタスク詳細へ移動できませんでした");
  if (!await evaluate(cdp, waitFor(".guideRaidReturn"))) throw new Error("今回のレイドから開いた詳細に戻り導線が表示されませんでした");
  await evaluate(cdp, `document.querySelector(".guideRaidReturn")?.click()`);
  if (!await evaluate(cdp, waitFor(".raidPrepDrawer"))) throw new Error("今回のレイドへ戻る操作で準備パネルを再表示できませんでした");
  await evaluate(cdp, `document.querySelector(".raidPrepHeader>button")?.click()`);
  await evaluate(cdp, `document.querySelector(".taskRaidToggle.inRaid")?.click()`);
  if (!String(await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.textContent||""`)).includes("0件")) throw new Error("今回のレイドから個別解除できませんでした");
  await evaluate(cdp, `document.querySelector(".taskRaidToggle")?.click();document.querySelector(".raidPrepTrigger")?.click()`);
  if (!await evaluate(cdp, waitFor(".raidPrepDrawer"))) throw new Error("狭い幅の確認用パネルを開けませんでした");
  await evaluate(cdp, `document.querySelector(".raidPrepHeader>button")?.click();document.querySelector(".guideHomeButton")?.click()`);
  if (!await evaluate(cdp, waitFor(".taskViewSwitch button"))) throw new Error("タスク一覧の表示設定へ戻れませんでした");
  await evaluate(cdp, `Array.from(document.querySelectorAll(".taskViewSwitch button")).find(button=>button.textContent.includes("全タスク"))?.click()`);
  if (!await evaluate(cdp, waitFor(".guideTaskCards button"))) throw new Error("全タスク一覧を表示できませんでした");
  if (!await evaluate(cdp, waitFor(".guideTaskCards button.inRaid"))) throw new Error("今回のレイド登録済みタスクを一覧で識別できませんでした");
  await evaluate(cdp, `document.querySelector(".guideTaskCards button")?.click()`);
  if (!await evaluate(cdp, waitFor(".taskRaidToggle"))) throw new Error("通常のタスク一覧から詳細を開けませんでした");
  if (await evaluate(cdp, `!!document.querySelector(".guideRaidReturn")`)) throw new Error("通常のタスク一覧から開いた詳細に今回のレイドへの戻り導線が表示されました");
  await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.click()`);
  if (!await evaluate(cdp, waitFor(".raidPrepDrawer"))) throw new Error("一覧確認後に今回のレイドパネルを再表示できませんでした");
  await cdp.call("Emulation.setDeviceMetricsOverride", {width: 480, height: 800, deviceScaleFactor: 1, mobile: false});
  const narrowLayout = await evaluate(cdp, `({pageWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,drawerWidth:document.querySelector(".raidPrepDrawer")?.getBoundingClientRect().width||0})`);
  if (narrowLayout.pageWidth > narrowLayout.viewport + 1 || narrowLayout.drawerWidth > narrowLayout.viewport + 1) throw new Error(`狭い幅で横スクロールが発生しました: ${JSON.stringify(narrowLayout)}`);
  await evaluate(cdp, `document.querySelector(".raidPrepSelected>header button")?.click()`);
  if (!await evaluate(cdp, waitFor(".raidPrepEmpty"))) throw new Error("今回のレイドを全件解除できませんでした");
  await cdp.call("Emulation.clearDeviceMetricsOverride");
  await evaluate(cdp, `document.querySelector(".raidPrepHeader>button")?.click()`);
  await evaluate(cdp, `localStorage.setItem("tarkov-raid-prep-task-ids",JSON.stringify(["5936da9e86f7742d65037edf"]))`);
  await cdp.call("Page.reload", {ignoreCache: true});
  if (!await evaluate(cdp, waitFor(".raidPrepTrigger"))) throw new Error("Background Checkの今回のレイド登録を復元できませんでした");
  await evaluate(cdp, `document.querySelector(".raidPrepTrigger")?.click()`);
  if (!await evaluate(cdp, waitFor(".raidPrepKeyList button", 25000))) throw new Error("Background Checkの必要鍵を取得できませんでした");
  const backgroundKey = await evaluate(cdp, `({text:document.querySelector(".raidPrepKeyList button")?.textContent||"",count:document.querySelectorAll(".raidPrepKeyList button").length})`);
  if (backgroundKey.count !== 1 || !/Machinery|特殊車両/.test(backgroundKey.text) || /交渉室/.test(backgroundKey.text)) throw new Error(`Background Checkの必要鍵がMachinery keyではありません: ${JSON.stringify(backgroundKey)}`);
  await evaluate(cdp, `document.querySelector(".raidPrepKeyList button")?.click()`);
  if (!await evaluate(cdp, waitFor(".keyDetail h2"))) throw new Error("Machinery keyの鍵詳細へ移動できませんでした");
  const backgroundKeyDetail = await evaluate(cdp, `({id:history.state?.keySelected||"",text:document.querySelector(".keyDetail>header")?.textContent||""})`);
  if (backgroundKeyDetail.id !== "5937ee6486f77408994ba448" || !/Machinery|特殊車両/.test(backgroundKeyDetail.text)) throw new Error(`Machinery keyの鍵詳細ではありません: ${JSON.stringify(backgroundKeyDetail)}`);
  if (!await evaluate(cdp, waitFor(".keyJudgment"))) throw new Error("鍵詳細の判断材料を表示できませんでした");
  const keyJudgment = await evaluate(cdp, `document.querySelector(".keyJudgment")?.textContent||""`);
  if (!["タスク用途", "使用マップ", "使用回数", "参考相場", "価格取得"].every(label => keyJudgment.includes(label))) throw new Error(`鍵の判断材料が不足しています: ${keyJudgment}`);
  if (/保管推奨|売却推奨|タスク用に保管/.test(keyJudgment)) throw new Error(`鍵の判断材料に自動推奨が含まれています: ${keyJudgment}`);
  await evaluate(cdp, `document.querySelector(".keyEvidenceDetails>summary")?.click()`);
  if (!await evaluate(cdp, waitFor(".keyEvidenceDetails[open]"))) throw new Error("鍵の根拠と関連タスクを展開できませんでした");
  const keyEvidence = await evaluate(cdp, `document.querySelector(".keyEvidenceDetails")?.textContent||""`);
  if (!/使用マップの根拠/.test(keyEvidence) || !/マップのLock情報|マップのアクセスキー|タスク目標の対象マップ|既存Wikiの使用場所情報/.test(keyEvidence)) throw new Error(`鍵の使用マップ根拠を区別できませんでした: ${keyEvidence}`);
  await cdp.call("Emulation.setDeviceMetricsOverride", {width: 480, height: 800, deviceScaleFactor: 1, mobile: false});
  const narrowKeyLayout = await evaluate(cdp, `({pageWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,judgmentWidth:document.querySelector(".keyJudgment")?.getBoundingClientRect().width||0})`);
  if (narrowKeyLayout.pageWidth > narrowKeyLayout.viewport + 1 || narrowKeyLayout.judgmentWidth > narrowKeyLayout.viewport + 1) throw new Error(`狭い幅で鍵詳細に横スクロールが発生しました: ${JSON.stringify(narrowKeyLayout)}`);
  await cdp.call("Emulation.clearDeviceMetricsOverride");
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent("keydown", {key:"k", ctrlKey:true, bubbles:true}))`);
  if (!await evaluate(cdp, waitFor(".quickSearchDialog"))) throw new Error("タスク前後関係確認用のクイック検索を開けませんでした");
  await evaluate(cdp, `(()=>{const input=document.querySelector(".quickSearchDialog input"),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;if(!input||!setter)return;setter.call(input,"Chemical Part 3");input.dispatchEvent(new Event("input",{bubbles:true}));})()`);
  if (!await evaluate(cdp, waitFor(".quickSearchResults button"))) throw new Error("Chemical - Part 3の検索候補を表示できませんでした");
  await evaluate(cdp, `Array.from(document.querySelectorAll(".quickSearchResults button")).find(button=>button.textContent.includes("Chemical - Part 3"))?.click()`);
  if (!await evaluate(cdp, waitFor(".taskRelations"))) throw new Error("タスク詳細の前後関係を表示できませんでした");
  const taskRelations = await evaluate(cdp, `document.querySelector(".taskRelations")?.textContent||""`);
  if (!/直接の前提/.test(taskRelations) || !/直接の後続/.test(taskRelations) || !/要求：/.test(taskRelations)) throw new Error(`直接の前提・後続または要求ステータスが不足しています: ${taskRelations}`);
  await evaluate(cdp, `document.querySelector(".taskRelationExpand")?.click()`);
  if (!await evaluate(cdp, waitFor(".taskRelationExpanded"))) throw new Error("解放までの前提を任意展開できませんでした");
  await cdp.call("Emulation.setDeviceMetricsOverride", {width: 480, height: 800, deviceScaleFactor: 1, mobile: false});
  const narrowRelationLayout = await evaluate(cdp, `({pageWidth:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,relationsWidth:document.querySelector(".taskRelations")?.getBoundingClientRect().width||0})`);
  if (narrowRelationLayout.pageWidth > narrowRelationLayout.viewport + 1 || narrowRelationLayout.relationsWidth > narrowRelationLayout.viewport + 1) throw new Error(`狭い幅でタスク前後関係に横スクロールが発生しました: ${JSON.stringify(narrowRelationLayout)}`);
  await cdp.call("Emulation.clearDeviceMetricsOverride");
  const relationSourceName = await evaluate(cdp, `document.querySelector(".taskDetail .taskHero h2")?.textContent||""`);
  await evaluate(cdp, `document.querySelector(".taskRelationEntry button:not(:disabled)")?.click()`);
  if (!await evaluate(cdp, waitFor(".guideBreadcrumb"))) throw new Error("前提タスクの詳細へ移動できませんでした");
  if (!String(await evaluate(cdp, `document.querySelector(".guideBreadcrumb")?.textContent||""`)).includes(`元のタスク「${relationSourceName}」へ戻る`)) throw new Error("関連タスクから元のタスクへ戻る導線を表示できませんでした");
  await evaluate(cdp, `document.querySelector(".guideBreadcrumb button")?.click()`);
  if (!await evaluate(cdp, waitFor(".taskRelations"))) throw new Error("関連タスクから元のタスクへ戻れませんでした");
  await evaluate(cdp, `window.dispatchEvent(new KeyboardEvent("keydown", {key:"k", ctrlKey:true, bubbles:true}))`);
  if (!await evaluate(cdp, waitFor(".quickSearchDialog"))) throw new Error("クイック検索を開けませんでした");
  await evaluate(cdp, `(()=>{const input=document.querySelector(".quickSearchDialog input"),setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")?.set;if(!input||!setter)return;setter.call(input,"ZB-1011");input.dispatchEvent(new Event("input",{bubbles:true}));})()`);
  if (!await evaluate(cdp, waitFor(".quickSearchResults button"))) throw new Error("脱出地点の検索候補を表示できませんでした");
  await evaluate(cdp, `Array.from(document.querySelectorAll(".quickSearchResults button")).find(button=>button.textContent.includes("ZB-1011"))?.click()`);
  if (!await evaluate(cdp, waitFor(".mapDetail .extractMapPreview"))) throw new Error("ZB-1011の強調表示を確認できませんでした");
  const extractTitle = await evaluate(cdp, `document.querySelector(".extractMapPreview strong")?.textContent || ""`);
  if (extractTitle !== "ZB-1011") throw new Error(`ZB-1011ではない脱出地点が強調されました: ${extractTitle}`);
  await evaluate(cdp, `document.querySelector(".mapBack")?.click()`);
  if (!await evaluate(cdp, waitFor(".interactiveWorld"))) throw new Error("ZB-1011確認後に全体マップへ戻れませんでした");
  await evaluate(cdp, `Array.from(document.querySelectorAll(".mainNav button")).find(button=>button.textContent.includes("MAP"))?.click()`);
  if (!await evaluate(cdp, waitFor(".interactiveWorld"))) throw new Error("全体マップを表示できませんでした");

  for (const mapName of ["インターチェンジ", "カスタム"]) {
    await evaluate(cdp, `document.querySelector(${JSON.stringify(`[aria-label="${mapName}を開く"]`)})?.click()`);
    if (!await evaluate(cdp, waitFor(".mapDetail .zoomMapCard"))) throw new Error(`${mapName}の個別マップ画面を表示できませんでした`);
    const title = await evaluate(cdp, `document.querySelector(".mapDetail h2")?.textContent || ""`);
    if (!String(title).includes(mapName)) throw new Error(`${mapName}ではない個別マップが表示されました: ${title}`);
    if (cdp.runtimeErrors.length) throw new Error(`${mapName}表示時にJavaScript例外が発生しました: ${cdp.runtimeErrors.join(" / ")}`);
    await evaluate(cdp, `document.querySelector(".mapBack")?.click()`);
    if (!await evaluate(cdp, waitFor(".interactiveWorld"))) throw new Error("全体マップへ戻れませんでした");
  }

  console.log("Electron主要画面描画: 今回のレイド / 鍵判断材料 / タスク前後関係・戻る導線 / 狭い幅 / クイック検索 / 個別マップ 成功");
} catch (error) {
  const suffix = processOutput.trim() ? `\nElectron出力:\n${processOutput.trim()}` : "";
  throw new Error(`${error.message}${suffix}`, {cause: error});
} finally {
  if (cdp) {
    try {
      const raidValue = previousRaidIds === null ? `localStorage.removeItem("tarkov-raid-prep-task-ids")` : `localStorage.setItem("tarkov-raid-prep-task-ids",${JSON.stringify(previousRaidIds)})`;
      const guideValue = previousGuideView === null ? `sessionStorage.removeItem("tarkov-task-last-view")` : `sessionStorage.setItem("tarkov-task-last-view",${JSON.stringify(previousGuideView)})`;
      await evaluate(cdp, `${raidValue};${guideValue}`);
    } catch {}
    cdp.socket.close();
  }
  if (!child.killed) child.kill();
}
