const fs=require("node:fs");
const path=require("node:path");
const {fetchKeyCatalog}=require("../electron/key-catalog.cjs");
const {enrichKeyCatalogWithWiki}=require("../electron/key-wiki-details.cjs");
(async()=>{const base=await fetchKeyCatalog(),catalog=await enrichKeyCatalogWithWiki(base,{translate:false}),target=path.join(__dirname,"..","app","data","key-catalog.json");fs.writeFileSync(target,JSON.stringify(catalog,null,2)+"\n");const audit=catalog.wikiAudit||{};console.log(`鍵カタログを更新しました: ${catalog.keys.length}件 / Wikiページ ${audit.pagesFound||0}件 / Lock Location節 ${audit.lockSections||0}件 / Behind the Lock節 ${audit.behindLockSections||0}件`);})().catch(error=>{console.error(error);process.exitCode=1});
