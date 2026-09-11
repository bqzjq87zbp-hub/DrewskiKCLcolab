import {initPhotographicAisle} from '/aisle/photographic-aisle.js';
import {FOCUS_STOPS} from '/aisle/gallery-layout.js';

export function attachAisle({slots,collections,enterCategory,menu,signLayer}){
  const main=document.querySelector('main'),composition=document.querySelector('#composition');
  const mount=document.createElement('div');mount.id='aisle-mount';main.prepend(mount);
  const enriched=slots.map(s=>({...s,categoryLabel:collections.data.get(s.category).title}));
  const engine=initPhotographicAisle({container:mount,slots:enriched,onCategory:enterCategory});
  const travelLabel=document.createElement('label');travelLabel.textContent='Travel';const travelChoice=document.createElement('select');travelChoice.id='travel-mode';travelChoice.setAttribute('aria-label','Aisle travel');
  for(const[value,label]of[['system','System'],['guided','Guided walk'],['still','Still view']]){const option=document.createElement('option');option.value=value;option.textContent=label;travelChoice.append(option);}travelLabel.append(travelChoice);menu.querySelector('nav').append(travelLabel);
  travelChoice.onchange=()=>{engine.setMotionPreference(travelChoice.value);try{sessionStorage.setItem('kcl-preview-travel-v2',travelChoice.value);}catch{}requestAnimationFrame(schedule);};
  try{const saved=sessionStorage.getItem('kcl-preview-travel-v2');if(['system','guided','still'].includes(saved)){travelChoice.value=saved;engine.setMotionPreference(saved);}}catch{}
  engine.viewport.append(menu);composition.hidden=true;composition.dataset.keepHidden='true';signLayer.hidden=true;
  // The optional video is a secondary review mode; keep it inside the menu.
  const videoControls=engine.viewport.querySelector('.aisle-video-controls');menu.querySelector('nav').append(videoControls);
  const invitation=document.createElement('div');invitation.className='aisle-invitation';
  const invitationTitle=document.createElement('p');invitationTitle.className='invitation-title';invitationTitle.textContent='Get your feet wet.';
  const invitationBody=document.createElement('p');invitationBody.className='invitation-body';invitationBody.textContent='Take a walk through the art before you.';
  const invitationCue=document.createElement('p');invitationCue.className='invitation-cue';invitationCue.textContent=engine.getState().reducedMotion?'Choose a collection below to explore.':'Scroll or swipe to explore.';
  invitation.append(invitationTitle,invitationBody,invitationCue);engine.viewport.append(invitation);
  const start=document.createElement('button');start.type='button';start.className='aisle-start-walk';start.textContent='Start walk';
  start.onclick=()=>{travelChoice.value='guided';engine.setMotionPreference('guided');try{sessionStorage.setItem('kcl-preview-travel-v2','guided');}catch{}schedule();};engine.viewport.append(start);
  const looks=document.createElement('div');looks.className='aisle-look-controls';looks.setAttribute('aria-label','Look toward the artworks');
  for(const[direction,label]of[['left','Look left'],['ahead','Look ahead'],['right','Look right']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(direction==='ahead'));b.onclick=()=>{engine.setLook(direction);for(const other of looks.children)other.setAttribute('aria-pressed',String(other===b));};looks.append(b);}engine.viewport.append(looks);
  const note=document.querySelector('.note');note.textContent='Your original pier photograph, with dimensional wooden easels and printed canvas. The photographic walk and experimental video are still in visual review.';
  for(const{slot,anchor}of engine.slotAnchors){anchor.href='#collection/'+slot.category;anchor.setAttribute('aria-label','Explore '+slot.categoryLabel);}
  engine.journey.querySelectorAll('.aisle-fallback a').forEach(a=>a.href='#collection/'+a.dataset.category);
  const signs=engine.slotAnchors.map(({slot,anchor})=>{
    const a=document.createElement('a');a.className='category-sign aisle-category-sign';a.href='#collection/'+slot.category;a.textContent=slot.categoryLabel;a.dataset.forCanvas=slot.id;
    a.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();enterCategory(slot,a);};
    a.setAttribute('aria-label','Explore '+slot.categoryLabel);engine.viewport.append(a);return{slot,anchor,a};
  });
  const progress=engine.viewport.querySelector('.aisle-progress');
  const prev=document.createElement('button'),next=document.createElement('button');prev.type=next.type='button';prev.textContent='← Previous pair';next.textContent='Next pair →';prev.setAttribute('aria-label','Walk back to the previous pair of canvases');next.setAttribute('aria-label','Walk forward to the next pair of canvases');prev.className=next.className='walk-step';const stepTools=document.createElement('div');stepTools.className='aisle-step-controls';stepTools.append(prev,next);menu.querySelector('nav').append(stepTools);progress.setAttribute('aria-label','Scroll or swipe to walk; arrow buttons advance one pair');
  const stops=FOCUS_STOPS,reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const stepTarget=(progress,direction)=>direction>0?stops.find(v=>v>progress+.015):[...stops].reverse().find(v=>v<progress-.015);
  function step(direction){const state=engine.getState();if(state.reducedMotion)return;const target=stepTarget(state.progress,direction);if(target===undefined)return;const y=engine.journey.getBoundingClientRect().top+scrollY+target*engine.getScrollRange();scrollTo({top:y,behavior:reduced.matches?'instant':'smooth'});}
  prev.onclick=()=>step(-1);next.onclick=()=>step(1);
  let frame=0;
  const setText=(element,text)=>{if(element.textContent!==text)element.textContent=text;};
  function layout(){frame=0;if(collections.active||mount.hidden)return;const state=engine.getState();if(!state.viewport.width||!state.viewport.height)return;
    start.hidden=!state.reducedMotion;looks.hidden=state.reducedMotion||!state.physical?.environment?.camera?.sideLookSupported;stepTools.hidden=state.reducedMotion;
    // Respect the rendered scene size, which can be shorter than the window.
    menu.style.setProperty('--aisle-menu-height',Math.max(48,state.viewport.height-96)+'px');
    menu.dataset.sideLook=String(Boolean(state.physical?.environment?.camera?.sideLookSupported));
    const invitationOpacity=state.reducedMotion?1:Math.max(0,1-state.progress/.045);
    invitation.style.opacity=String(invitationOpacity);invitation.setAttribute('aria-hidden',String(invitationOpacity===0));
    setText(invitationCue,state.reducedMotion?'Choose a collection below to explore.':'Scroll or swipe to explore.');
    const labeledSides=new Set(),reserved=[menu.getBoundingClientRect(),progress.getBoundingClientRect()];
    if(!looks.hidden)reserved.push(looks.getBoundingClientRect());
    const openPanel=menu.querySelector('nav:not([hidden])');
    if(openPanel)reserved.push(openPanel.getBoundingClientRect());
    if(invitationOpacity>.05)reserved.push(invitation.getBoundingClientRect());
    const overlaps=(a,b)=>a.left<b.right+8&&a.right>b.left-8&&a.top<b.bottom+8&&a.bottom>b.top-8;
    const visibleSigns=[];
    for(let i=0;i<signs.length;i++){const{a,slot}=signs[i],r=state.slots[i],q=r.projectedQuad;if(!q.length){a.hidden=true;continue;}const x=(q[0].x+q[1].x)/2,y=Math.min(q[0].y,q[1].y)-12,w=Math.max(...q.map(p=>p.x))-Math.min(...q.map(p=>p.x));
      a.hidden=state.reducedMotion||!r.interactive||w<Math.min(105,state.viewport.width*.15)||x<30||x>state.viewport.width-30||y<65||y>state.viewport.height-100;
      a.style.left=Math.max(66,Math.min(state.viewport.width-66,x))+'px';a.style.top=y+'px';
      if(!a.hidden)visibleSigns.push({a,slot});
    }
    // Finish position writes before reading bounds: one layout flush, not
    // alternating a write/read for every canvas as the visitor walks.
    const measuredSigns=visibleSigns.map(sign=>({...sign,rect:sign.a.getBoundingClientRect()}));
    for(const{a,slot,rect}of measuredSigns){
      if(reserved.some(reservedRect=>overlaps(rect,reservedRect)))a.hidden=true;
      if(state.physical?.ready){if(labeledSides.has(slot.side))a.hidden=true;else if(!a.hidden)labeledSides.add(slot.side);}
    }
    prev.disabled=stepTarget(state.progress,-1)===undefined;next.disabled=stepTarget(state.progress,1)===undefined;
    setText(progress.querySelector('span'),state.progress>.985?'Scroll back to return':matchMedia('(pointer:coarse)').matches?'Swipe up to walk forward':'Scroll to walk forward');
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(layout);}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});addEventListener('popstate',()=>requestAnimationFrame(schedule));reduced.addEventListener('change',schedule);
  engine.viewport.addEventListener('kclaisleframe',schedule);
  const menuObserver=new MutationObserver(schedule);menuObserver.observe(menu.querySelector('nav'),{attributes:true,attributeFilter:['hidden']});
  const observer=new ResizeObserver(()=>requestAnimationFrame(schedule));observer.observe(engine.viewport);requestAnimationFrame(schedule);
  if(collections.active)mount.hidden=true;
  return{...engine,mount,signs};
}
