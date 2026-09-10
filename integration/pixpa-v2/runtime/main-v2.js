import {createWrappedCanvas} from './canvas-wrap.js';
import {createCollections} from './collections.js';
import {attachAisle} from './aisle-integration.js';
import {installGlassSheen} from './glass-sheen.js';

const $=s=>document.querySelector(s),sourceSlots=await(await fetch('/pier-v2-20260910/slots.json')).json();
const layers=$('#layers'),composition=$('#composition'),viewer=$('#viewer'),full=$('#full-photo');
let current=0,photos=sourceSlots,returnFocus=null,returnY=0,request=0,sourceMode=false,restoreViewerReturn=true;
function display(items,index,trigger,original=false){
  if(!viewer.open){returnFocus=trigger||document.activeElement;returnY=scrollY;restoreViewerReturn=true;}
  photos=items;current=index;sourceMode=original;
  const photo=original?{title:"Kyle's original photograph",full:'/pier-v1-20260909/media/underpier-photograph.jpg',alt:'The original photograph beneath the Newport Beach pier.'}:items[index];
  const version=++request;$('#viewer-title').textContent=photo.title;$('#viewer-status').textContent='Loading full photograph…';full.style.opacity='0';full.setAttribute('aria-busy','true');full.alt=photo.alt;full.src=photo.full||photo.src;$('#full-link').href=photo.full||photo.src;$('#previous').disabled=$('#next').disabled=original;
  full.decode().then(()=>{if(version!==request)return;$('#viewer-status').textContent='';full.style.opacity='1';full.setAttribute('aria-busy','false');}).catch(()=>{if(version!==request)return;$('#viewer-status').textContent='The image could not load. Open the photograph file or try another image.';full.setAttribute('aria-busy','false');});
  if(!viewer.open)viewer.showModal();
}
function dismissViewerForNavigation(){
  // The destination owns scroll and focus after a route change, including
  // when a dialog close event is still queued from the previous view.
  restoreViewerReturn=false;++request;
  if(viewer.open)viewer.close();
}
let aisle=null;
const collections=await createCollections({onEnlarge:(items,index,trigger)=>display(items,index,trigger),onNavigate:dismissViewerForNavigation,captureReturn:()=>aisle?.captureReturnPosition()??null,restoreReturn:position=>aisle?.restore(position)??false});
const categoryMap=['families','families','families','headshots','branding','branding','coastal','branding','branding','coastal'];
const slots=sourceSlots.map((s,i)=>({...s,category:categoryMap[i]}));
// This easel introduces the actual professional-client collection, never Kyle's About portraits.
const headshot=collections.data.get('headshots')?.items[0];
if(headshot)Object.assign(slots[3],{src:headshot.src,full:headshot.full,title:headshot.title,alt:headshot.alt,objectPosition:headshot.objectPosition||'50% 40%'});
function enterCategory(slot,trigger){const category=collections.data.get(slot.category);if(category)collections.open(category.id,trigger);}
for(const[index,slot]of slots.entries()){const canvas=createWrappedCanvas(slot,index,{onSelect:(i,a)=>enterCategory(slots[i],a)});canvas.querySelector('a').setAttribute('aria-label','Explore '+collections.data.get(slot.category).title);canvas.querySelector('a').href='#collection/'+slot.category;layers.append(canvas);}
const signLayer=document.createElement('div');signLayer.className='category-signs';composition.append(signLayer);
const signs=[];
for(const slot of slots){const category=collections.data.get(slot.category);if(!category)continue;const a=document.createElement('a');a.className='category-sign';a.href='#collection/'+slot.category;a.textContent=category.title;a.dataset.slot=slot.id;a.setAttribute('aria-label','Explore '+category.title);a.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();enterCategory(slot,a);};signLayer.append(a);signs.push({slot,a});}
function resize(){const scale=composition.clientWidth/2528;layers.style.transform=`scale(${scale})`;for(const{slot,a}of signs){a.style.left=(slot.quad[0][0]+slot.quad[1][0])/2*scale+'px';a.style.top=(Math.min(slot.quad[0][1],slot.quad[1][1])-20)*scale+'px';a.hidden=slot.depth!==1;}}
const observer=new ResizeObserver(resize);observer.observe(composition);resize();

// The accessible list is grouped by destination, not a duplicate wall of enlargement links.
const list=$('#photo-list');list.replaceChildren();
for(const c of collections.data.values()){const li=document.createElement('li'),a=document.createElement('a'),img=document.createElement('img');a.href='#collection/'+c.id;a.className='category-card';img.loading='lazy';img.decoding='async';img.src=c.items[0].src;img.alt=c.items[0].alt;a.append(img,document.createTextNode(c.title));a.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();collections.open(c.id,a);};li.append(a);list.append(li);}
$('#photographs h1').textContent='Explore the collections';

$('#close').onclick=()=>viewer.close();$('#previous').onclick=()=>display(photos,(current-1+photos.length)%photos.length);$('#next').onclick=()=>display(photos,(current+1)%photos.length);
viewer.addEventListener('keydown',e=>{if(sourceMode)return;if(e.key==='ArrowLeft'){e.preventDefault();$('#previous').click();}if(e.key==='ArrowRight'){e.preventDefault();$('#next').click();}});
viewer.addEventListener('close',()=>{if(viewer.open)return;++request;full.setAttribute('aria-busy','false');if(!restoreViewerReturn)return;scrollTo({top:returnY,behavior:'instant'});returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});});
const menu=$('#menu'),panel=$('#menu-panel'),toggle=$('#menu-toggle');
panel.setAttribute('aria-label','Portfolio collections');$('#show-plate').hidden=true;$('#show-original').hidden=true;
function closeMenu(focus=false){panel.hidden=true;toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus({preventScroll:true});}
toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));};
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closeMenu(true);});
panel.querySelector('a').textContent='All collections';panel.querySelector('a').onclick=()=>closeMenu();
for(const c of [...collections.data.values()].reverse()){const a=document.createElement('a');a.href='#collection/'+c.id;a.textContent=c.title;a.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();closeMenu();collections.open(c.id,toggle);};panel.prepend(a);}
$('#show-original').onclick=()=>{closeMenu();display(slots,0,toggle,true);};
$('#show-plate').onclick=()=>{layers.hidden=!layers.hidden;signLayer.hidden=layers.hidden;$('#show-plate').textContent=layers.hidden?'Show wrapped canvases':'Show supplied composition';closeMenu(true);};
$('#appearance').onchange=e=>{menu.dataset.appearance=e.target.value;document.body.dataset.appearance=e.target.value;try{sessionStorage.setItem('kcl-preview-appearance-v2',e.target.value);}catch{}};
let appearance='clear';try{const saved=sessionStorage.getItem('kcl-preview-appearance-v2');if(['clear','solid','system'].includes(saved))appearance=saved;}catch{}
document.body.dataset.appearance=appearance;menu.dataset.appearance=appearance;$('#appearance').value=appearance;
window.PhotographicCollections={slots,collections,display,enterCategory,menu,signLayer};
window.PhotographicAisle=aisle=attachAisle(window.PhotographicCollections);
window.KCLGlassSheen=installGlassSheen();
