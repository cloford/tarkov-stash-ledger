const {app,BrowserWindow,ipcMain,protocol,session}=require("electron");
const path=require("node:path");
const {createMapImageCache,createMapCacheProtocolHandler,registerMapCacheScheme}=require("../../electron/map-image-cache.cjs");
app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-software-rasterizer");
app.commandLine.appendSwitch("no-sandbox");
app.setPath("userData",process.argv[3]);
registerMapCacheScheme(protocol);
const getUserDataPath=()=>app.getPath("userData");
const cache=createMapImageCache({getUserDataPath,fetchImpl:async()=>new Response('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="green"/></svg>',{headers:{"content-type":"image/svg+xml"}})});
ipcMain.handle("maps:cache-image",(_event,...args)=>cache(...args));
app.whenReady().then(async()=>{
  let onlineAttempts=0;
  session.defaultSession.webRequest.onBeforeRequest({urls:["https://*/*"]},(_details,callback)=>{onlineAttempts++;callback({cancel:true});});
  protocol.handle("stash-map",createMapCacheProtocolHandler({getUserDataPath}));
  const win=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{contextIsolation:true,sandbox:false,preload:path.resolve(__dirname,"../../electron/preload.cjs")}});
  try{
    await win.loadFile(process.argv[2]);
    const results=await win.webContents.executeJavaScript("window.runImageRenderChecks()");
    if(onlineAttempts!==2)throw new Error(`保存済み現行画像がonlineへアクセスしました（期待する旧版2件のみ）: ${onlineAttempts}`);
    console.log("Electron画像描画: 通常参考画像・specific・landmarks・基準マップ・旧版fallbackをstash-map://から実描画",JSON.stringify(results));
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
