const fs=require("node:fs");
const path=require("node:path");
const {fetchKeyCatalog}=require("../electron/key-catalog.cjs");
(async()=>{const catalog=await fetchKeyCatalog(),target=path.join(__dirname,"..","app","data","key-catalog.json");fs.writeFileSync(target,JSON.stringify(catalog,null,2)+"\n");console.log(`鍵カタログを更新しました: ${catalog.keys.length}件`);})().catch(error=>{console.error(error);process.exitCode=1});
