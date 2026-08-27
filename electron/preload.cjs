const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("stashAI",{
 media:url=>ipcRenderer.invoke("task:media",url),
 requirements:id=>ipcRenderer.invoke("task:requirements",id),
 weaponBuild:id=>ipcRenderer.invoke("task:weapon-build",id),
 translate:texts=>ipcRenderer.invoke("task:translate",texts),
 traderPortraits:names=>ipcRenderer.invoke("task:trader-portraits",names),
 maps:()=>ipcRenderer.invoke("maps:latest"),
 refreshMaps:()=>ipcRenderer.invoke("maps:refresh-online"),
 cacheMapImage:(url,mapId,refresh=false)=>ipcRenderer.invoke("maps:cache-image",url,mapId,refresh),
 extractImage:(map,extract)=>ipcRenderer.invoke("maps:extract-image",map,extract),
 extractGuide:(map,extract)=>ipcRenderer.invoke("maps:extract-guide",map,extract),
});
