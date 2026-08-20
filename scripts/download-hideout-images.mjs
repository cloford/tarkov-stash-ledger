import fs from "node:fs/promises";
import path from "node:path";
const root=process.cwd(),data=JSON.parse(await fs.readFile(path.join(root,"work/hideout.json"),"utf8"));
await fs.mkdir(path.join(root,"public/hideout"),{recursive:true});
const overrides={2:"Bitcoin_Farm_Portrait.png",3:"Booze_Generator_Portrait.png",9:"Nutrition_Unit_Portrait.png",11:"Scav_Case_Portrait.png",13:"Shooting_Range_Portrait.png",17:"Water_Collector_Portrait.png",19:"Christmas_Tree_Portrait.png"};
for(const station of data.stations){
 const filename=overrides[station.id]||(station.imgSource||"").split("/").pop(); if(!filename)continue;
 const api=`https://escapefromtarkov.fandom.com/api.php?action=query&titles=${encodeURIComponent('File:'+filename)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
 try{const meta=await (await fetch(api)).json(),page=Object.values(meta.query.pages)[0],url=page.imageinfo?.[0]?.url;if(!url)throw Error('image not found');const image=await fetch(url);if(!image.ok)throw Error(String(image.status));await fs.writeFile(path.join(root,"public/hideout",`${station.id}.png`),Buffer.from(await image.arrayBuffer()));console.log(station.id,station.locales.en)}catch(e){console.warn('skip',station.locales.en,e.message)}
}
