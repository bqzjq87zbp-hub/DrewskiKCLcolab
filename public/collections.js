const el=(tag,attrs={},text)=>{const node=document.createElement(tag);for(const[k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text)node.textContent=text;return node;};

export async function createCollections({onEnlarge}){
  const response=await fetch('/categories.json');
  if(!response.ok)throw new Error('The collection manifest is unavailable.');
  const manifest=await response.json();
  const data=new Map(manifest.categories.map(c=>[c.id,c]));
  const section=el('section',{id:'collection-view',class:'collection-view',hidden:'',tabindex:'-1','aria-labelledby':'collection-title'});
  document.querySelector('main').append(section);
  let returnY=0,returnFocus=null,active=null;

  const itemUrl=(item,full=false)=>full?(item.full||item.src):item.src;
  function makePhoto(item,items,index){
    const a=el('a',{href:itemUrl(item,true),class:'collection-photo','aria-label':'Enlarge photograph: '+item.title});
    const img=el('img',{src:itemUrl(item),alt:item.alt||item.title,loading:'lazy',decoding:'async',width:item.width||1600,height:item.height||1200});
    a.append(img);
    a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onEnlarge(items,index,a);});
    return a;
  }
  function makeRoom(room,category){
    const figure=el('figure',{class:'room-vignette'}),scene=el('div',{class:'room-scene'});
    scene.style.aspectRatio=room.width+'/'+room.height;
    scene.append(el('img',{src:room.src,width:room.width,height:room.height,alt:room.alt||'Illustrative room showing family wall art',loading:'lazy',decoding:'async'}));
    const artLayer=el('div',{class:'room-art-layer'});artLayer.style.width=room.width+'px';artLayer.style.height=room.height+'px';
    for(const art of room.art||[]){const index=category.items.findIndex(i=>i.id===art.imageId),item=category.items[index];if(!item)continue;
      const a=makePhoto(item,category.items,index);a.classList.add('room-art');
      const q=art.quad,dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
      const ratio=(dist(q[0],q[1])+dist(q[3],q[2]))/(dist(q[0],q[3])+dist(q[1],q[2]));
      const height=1000/ratio;a.style.height=height+'px';a.style.transform=projectQuad(q,1000,height);if(art.objectPosition)a.firstElementChild.style.objectPosition=art.objectPosition;
      artLayer.append(a);
    }
    scene.append(artLayer);figure.append(scene,el('figcaption',{},'Illustrative wall-art mockup · '+(room.title||'Family portraits')));
    const observer=new ResizeObserver(()=>artLayer.style.transform=`scale(${scene.clientWidth/room.width})`);observer.observe(scene);section._roomObservers.push(observer);
    return figure;
  }
  function render(id){
    const category=data.get(id);if(!category)return false;
    for(const o of section._roomObservers||[])o.disconnect();section._roomObservers=[];section.replaceChildren();active=id;
    const head=el('header',{class:'collection-header'}),back=el('button',{type:'button',class:'glass-control collection-back'},'← Back to the aisle');
    back.onclick=close;head.append(back);
    const nav=el('nav',{'aria-label':'Portfolio categories',class:'collection-switcher'});
    for(const c of data.values()){const a=el('a',{href:'#collection/'+c.id},c.title);if(c.id===id)a.setAttribute('aria-current','page');a.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();open(c.id,a);};nav.append(a);}
    head.append(nav);section.append(head,el('h1',{id:'collection-title'},category.title));
    if(category.rooms?.length){const rooms=el('div',{class:'room-sequence'});for(const room of category.rooms)rooms.append(makeRoom(room,category));section.append(rooms);}
    const grid=el('div',{class:'collection-grid','aria-label':category.title+' photographs'});
    category.items.forEach((item,index)=>{const figure=el('figure');figure.append(makePhoto(item,category.items,index));grid.append(figure);});section.append(grid);
    const footer=el('footer',{class:'collection-footer'});footer.append(el('a',{href:'https://kiyonocreativelab.com/inquiry-form',class:'glass-control'},'Plan Your Portrait'),el('button',{type:'button',class:'glass-control'},'Back to the aisle'));footer.lastChild.onclick=close;section.append(footer);
    return true;
  }
  function show(id,{focus=true}={}){
    if(!render(id))return;
    for(const node of document.querySelector('main').children)if(node!==section)node.hidden=true;
    section.hidden=false;document.body.dataset.view='collection';scrollTo({top:0,behavior:'instant'});if(focus)section.focus({preventScroll:true});
  }
  function open(id,trigger){
    if(!data.has(id))return;
    if(!active){returnY=scrollY;returnFocus=trigger||document.activeElement;history.replaceState({...history.state,aisleY:returnY},'',location.href);}
    const method=active?'replaceState':'pushState';history[method]({localCollection:true,aisleY:returnY},'','#collection/'+id);show(id);
  }
  function restore(){
    active=null;section.hidden=true;for(const o of section._roomObservers||[])o.disconnect();section._roomObservers=[];
    for(const node of document.querySelector('main').children)if(node!==section&&node.dataset.keepHidden!=='true')node.hidden=false;
    document.body.dataset.view='aisle';scrollTo({top:returnY,behavior:'instant'});returnFocus?.isConnected&&returnFocus.focus({preventScroll:true});
    // The photographic camera remeasures after its hidden parent reopens.
    // Keep focus restoration bounded and wait out its transient hidden frame;
    // never take focus back if the visitor has moved to another control.
    const target=returnFocus;let attempts=0,stable=0;
    function settleFocus(){if(active||!target?.isConnected||document.querySelector('dialog[open]')||attempts++>16)return;const focused=document.activeElement;if(focused!==document.body&&focused!==section&&focused!==target)return;
      const visible=target.getClientRects().length>0&&!target.closest('[hidden]')&&getComputedStyle(target).visibility!=='hidden';stable=visible?stable+1:0;
      if(stable>=3){target.focus({preventScroll:true});return;}requestAnimationFrame(settleFocus);
    }requestAnimationFrame(settleFocus);
  }
  function close(){
    if(history.state?.localCollection){history.back();return;}
    history.replaceState(null,'',location.pathname+location.search);restore();
  }
  addEventListener('popstate',()=>{const id=decodeURIComponent(location.hash.replace(/^#collection\//,''));if(data.has(id)){show(id);}else if(active){if(Number.isFinite(history.state?.aisleY))returnY=history.state.aisleY;restore();}});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&active&&!document.querySelector('dialog[open]')){e.preventDefault();close();}});
  const initial=decodeURIComponent(location.hash.replace(/^#collection\//,''));if(data.has(initial))show(initial,{focus:false});
  return{open,close,data,get active(){return active;},section};
}

export function projectQuad(quad,width=1000,height=width){
  const xy=[[0,0],[width,0],[width,height],[0,height]],r=[];xy.forEach(([u,v],i)=>{const[x,y]=quad[i];r.push([u,v,1,0,0,0,-x*u,-x*v,x],[0,0,0,u,v,1,-y*u,-y*v,y]);});
  for(let c=0;c<8;c++){let p=c;for(let j=c+1;j<8;j++)if(Math.abs(r[j][c])>Math.abs(r[p][c]))p=j;[r[c],r[p]]=[r[p],r[c]];const d=r[c][c];if(Math.abs(d)<1e-10)throw Error('Invalid artwork corners');for(let j=c;j<9;j++)r[c][j]/=d;for(let j=0;j<8;j++)if(j!==c){const f=r[j][c];for(let k=c;k<9;k++)r[j][k]-=f*r[c][k];}}
  const[a,b,c,d,e,f,g,h]=r.map(row=>row[8]);return`matrix3d(${[a,d,0,g,b,e,0,h,0,0,1,0,c,f,0,1].join(',')})`;
}
