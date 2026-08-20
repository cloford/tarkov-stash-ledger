import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const items = JSON.parse(await fs.readFile(path.join(root, "app/data/items.json"), "utf8"));
const css = (await fs.readFile(path.join(root, "app/globals.css"), "utf8")) +
  (await fs.readFile(path.join(root, "app/groups.css"), "utf8"));
for (const item of items) {
  const image = await fs.readFile(path.join(root, "public/items", `${item.id}.webp`));
  item.image = `data:image/webp;base64,${image.toString("base64")}`;
}

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stash Ledger — Tarkov Item Tracker</title><style>${css.replace('@import "tailwindcss";', '')}
.notice{position:fixed;right:18px;bottom:18px;background:#c7d65d;color:#15170f;padding:10px 14px;font:700 11px monospace;opacity:0;transform:translateY(8px);transition:.2s;z-index:20}.notice.show{opacity:1;transform:none}</style></head>
<body><main><header class="hero"><div class="eyebrow">ESCAPE FROM TARKOV · STANDALONE TRACKER</div><div class="heroRow"><div><h1>STASH <span>LEDGER</span></h1><p>拾った物を数える。持ち帰るべき物を見失わない。</p></div><div class="progressBox"><div class="progressTop"><strong id="percent">0%</strong><span id="progressText">0 / 0 個</span></div><div class="progress"><i id="progressBar" style="width:0"></i></div><small>全アイテムの収集進捗</small></div></div></header>
<section class="toolbar"><div class="tabs"><button data-tab="all" class="active">すべて</button><button data-tab="quest">クエスト</button><button data-tab="hideout">ハイドアウト</button></div><label class="search"><span>⌕</span><input id="search" placeholder="アイテム名で検索…"></label><label class="toggle"><input id="hideDone" type="checkbox"><span></span> 完了を隠す</label></section>
<div class="listHeader"><span id="itemCount"></span><span>必要数 / 所持数</span></div><section class="grid" id="grid"></section><div class="empty" id="empty" hidden>条件に合うアイテムはありません。</div><footer>DATA: TARKOVDATA · 2026-08-15 時点 <span>進捗はこのPCのブラウザに自動保存されます</span></footer></main><div class="notice" id="notice">自動保存しました</div>
<script>const ITEMS=${JSON.stringify(items)};let tab='all',query='',hideDone=false;let counts={};try{counts=JSON.parse(localStorage.getItem('tarkov-counts-standalone')||'{}')}catch{};
const grid=document.getElementById('grid'),empty=document.getElementById('empty');
function required(i){return tab==='quest'?i.quest:tab==='hideout'?i.hideout:i.quest+i.hideout}
function save(){localStorage.setItem('tarkov-counts-standalone',JSON.stringify(counts));const n=document.getElementById('notice');n.classList.add('show');clearTimeout(save.t);save.t=setTimeout(()=>n.classList.remove('show'),700)}
function render(){const totalReq=ITEMS.reduce((s,i)=>s+i.quest+i.hideout,0),totalOwn=ITEMS.reduce((s,i)=>s+Math.min(counts[i.id]||0,i.quest+i.hideout),0),pct=Math.round(totalOwn/totalReq*100);document.getElementById('percent').textContent=pct+'%';document.getElementById('progressText').textContent=totalOwn+' / '+totalReq+' 個';document.getElementById('progressBar').style.width=pct+'%';
const visible=ITEMS.filter(i=>(tab==='all'||(tab==='quest'?i.quest:i.hideout))&&((i.name+' '+i.shortName).toLowerCase().includes(query.toLowerCase()))&&(!hideDone||(counts[i.id]||0)<required(i))).sort((a,b)=>Number((counts[b.id]||0)>0)-Number((counts[a.id]||0)>0));const countedLength=visible.filter(i=>(counts[i.id]||0)>0).length;document.getElementById('itemCount').textContent=visible.length+' ITEMS';empty.hidden=visible.length>0;
grid.innerHTML=visible.map((i,index)=>{const own=counts[i.id]||0,req=required(i),done=own>=req;const heading=(index===0&&countedLength>0?'<div class="groupDivider counted"><strong>収集中</strong><span>'+countedLength+' アイテム</span></div>':'')+(index===countedLength?'<div class="groupDivider uncounted"><strong>未収集</strong><span>'+(visible.length-countedLength)+' アイテム</span></div>':'');return heading+'<article class="card '+(done?'done':'')+'"><div class="imageWrap"><img src="'+i.image+'" alt="" loading="lazy">'+(done?'<b>✓</b>':'')+'</div><div class="itemInfo"><h2>'+esc(i.shortName)+'</h2><p title="'+esc(i.name)+'">'+esc(i.name)+'</p><div class="tags">'+(i.quest?'<span class="quest">Q '+i.quest+'</span>':'')+(i.hideout?'<span class="hideout">H '+i.hideout+'</span>':'')+(i.foundInRaid?'<span class="fir">FIR</span>':'')+'</div></div><div class="counter"><button data-id="'+i.id+'" data-delta="-1" '+(own===0?'disabled':'')+'>−</button><div><strong>'+own+'</strong><small>/ '+req+'</small></div><button data-id="'+i.id+'" data-delta="1">＋</button></div></article>'}).join('')}
function esc(s){return s.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
document.querySelector('.tabs').onclick=e=>{if(!e.target.dataset.tab)return;tab=e.target.dataset.tab;document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b===e.target));render()};document.getElementById('search').oninput=e=>{query=e.target.value;render()};document.getElementById('hideDone').onchange=e=>{hideDone=e.target.checked;render()};grid.onclick=e=>{const b=e.target.closest('button[data-id]');if(!b)return;counts[b.dataset.id]=Math.max(0,(counts[b.dataset.id]||0)+Number(b.dataset.delta));save();render()};render();</script></body></html>`;

const out = path.join(root, "outputs", "Tarkov-Stash-Ledger-フレンド配布版");
await fs.mkdir(out, { recursive: true });
await fs.writeFile(path.join(out, "タルコフ収集カウンター.html"), html);
await fs.writeFile(path.join(out, "使い方.txt"), "タルコフ収集カウンター.html をダブルクリックしてください。\r\n\r\n・インストール不要、インターネット不要です。\r\n・個数は使用したブラウザへ自動保存されます。\r\n・ブラウザのサイトデータを削除すると個数はリセットされます。\r\n・2026年8月15日時点のデータです。\r\n");
console.log(out);
