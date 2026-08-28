const wikiApi="https://escapefromtarkov.fandom.com/api.php";
const headers={"user-agent":"Tarkov Task Extract Navi/1.1"};
const cleanTitle=value=>String(value||"").replace(/^File:/i,"").replace(/\.[a-z0-9]+$/i,"").replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
function variantKind(value){const text=cleanTitle(value);if(/underground|basement|bunker|subterranean/i.test(text))return"地下・屋内";if(/3d|isometric/i.test(text))return"3D";if(/2d|top.?down/i.test(text))return"2D";if(/ingame|in.?game|plan map/i.test(text))return"ゲーム内地図";if(/floor|level|resort|dorm/i.test(text))return"建物・階層";return"コミュニティ"}
async function wikiRequest(params){const response=await fetch(`${wikiApi}?${new URLSearchParams({...params,format:"json",origin:"*"})}`,{headers,signal:AbortSignal.timeout(22000)});if(!response.ok)throw Error(`wiki ${response.status}`);return response.json()}
async function fetchMapVariants(mapName){
  const page=String(mapName||"").trim();if(!page)return{variants:[],sourceUrl:""};
  const sections=await wikiRequest({action:"parse",page,prop:"sections"}),mapSection=(sections.parse?.sections||[]).find(section=>/^maps?$/i.test(String(section.line||"").replace(/<[^>]+>/g,"").trim())),parseParams={action:"parse",page,prop:"images"};if(mapSection)parseParams.section=String(mapSection.index);
  const parsed=await wikiRequest(parseParams),allNames=(parsed.parse?.images||[]).filter(name=>/\.(png|jpe?g|webp)$/i.test(name)),names=allNames.filter(name=>!/(icon|logo|banner|button|flag|quest|task|keycard|key |portrait|achievement|trader|extraction.?icon|transit.?icon|spawn.?icon)/i.test(cleanTitle(name))).slice(0,50);
  if(!names.length)return{variants:[],sourceUrl:`https://escapefromtarkov.fandom.com/wiki/${encodeURIComponent(page.replace(/ /g,"_"))}`};
  const body=new URLSearchParams({action:"query",titles:names.map(name=>`File:${name}`).join("|"),prop:"imageinfo",iiprop:"url|mime|size",format:"json",origin:"*"}),infoResponse=await fetch(wikiApi,{method:"POST",headers:{...headers,"content-type":"application/x-www-form-urlencoded"},body,signal:AbortSignal.timeout(25000)});if(!infoResponse.ok)throw Error(`wiki imageinfo ${infoResponse.status}`);const info=await infoResponse.json(),byName=new Map();
  for(const file of Object.values(info.query?.pages||{})){const image=file?.imageinfo?.[0],name=String(file?.title||"").replace(/^File:/i,"");if(image?.url&&/^image\/(png|jpe?g|webp)$/i.test(image.mime||"")&&Number(image.width)>=700&&Number(image.height)>=500&&Number(image.width)*Number(image.height)>=500000)byName.set(cleanTitle(name).toLowerCase(),{id:`wiki-${Buffer.from(name).toString("base64url").slice(0,32)}`,url:image.url,title:cleanTitle(name),kind:variantKind(name),width:Number(image.width)||0,height:Number(image.height)||0,source:"Escape from Tarkov Wiki"})}
  const variants=names.map(name=>byName.get(cleanTitle(name).toLowerCase())).filter(Boolean).filter((variant,index,list)=>list.findIndex(item=>item.url===variant.url)===index).slice(0,12);
  return{variants,sourceUrl:`https://escapefromtarkov.fandom.com/wiki/${encodeURIComponent(page.replace(/ /g,"_"))}`};
}
module.exports={fetchMapVariants,variantKind,cleanTitle};
