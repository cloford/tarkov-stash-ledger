const fs=require("node:fs");
const path=require("node:path");
const {fetchKeyCatalog}=require("../electron/key-catalog.cjs");
const {enrichKeyCatalogWithWiki}=require("../electron/key-wiki-details.cjs");
(async()=>{const base=await fetchKeyCatalog(),catalog=await enrichKeyCatalogWithWiki(base,{translate:false}),target=path.join(__dirname,"..","app","data","key-catalog.json");fs.writeFileSync(target,JSON.stringify(catalog,null,2)+"\n");const locks=catalog.keys.filter(key=>key.lockLocationEn).length,loot=catalog.keys.filter(key=>key.behindLockEn).length;console.log(`鍵カタログを更新しました: ${catalog.keys.length}件 / 使用場所 ${locks}件 / 開錠先 ${loot}件`);})().catch(error=>{console.error(error);process.exitCode=1});
