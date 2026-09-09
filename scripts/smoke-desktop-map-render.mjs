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

try {
  const page = await waitForPage(port);
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  await cdp.call("Runtime.enable");
  if (!await evaluate(cdp, waitFor(".mainNav"))) throw new Error("アプリの初期画面を表示できませんでした");
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

  await evaluate(cdp, "window.close()");
  cdp.socket.close();
  console.log("Electron個別マップ描画: Interchange / Customs 成功");
} catch (error) {
  const suffix = processOutput.trim() ? `\nElectron出力:\n${processOutput.trim()}` : "";
  throw new Error(`${error.message}${suffix}`, {cause: error});
} finally {
  if (!child.killed) child.kill();
}
