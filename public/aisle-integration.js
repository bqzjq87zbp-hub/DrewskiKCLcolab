import {initPhotographicAisle} from '/aisle/photographic-aisle.js';

export function attachAisle({slots,collections,enterCategory,menu,signLayer}){
  const main=document.querySelector('main'),composition=document.querySelector('#composition');
  const mount=document.createElement('div');mount.id='aisle-mount';main.prepend(mount);
  const enriched=slots.map(s=>({...s,categoryLabel:collections.data.get(s.category).title}));
  const engine=initPhotographicAisle({container:mount,slots:enriched,onCategory:enterCategory});
  const travelLabel=document.createElement('label');travelLabel.textContent='Travel';const travelChoice=document.createElement('select');travelChoice.id='travel-mode';travelChoice.setAttribute('aria-label','Aisle travel');
  for(const[value,label]of[['system','System'],['guided','Guided walk'],['still','Still view']]){const option=document.createElement('option');option.value=value;option.textContent=label;travelChoice.append(option);}travelLabel.append(travelChoice);menu.querySelector('nav').append(travelLabel);
  travelChoice.onchange=()=>{engine.setMotionPreference(travelChoice.value);try{sessionStorage.setItem('kcl-preview-travel',travelChoice.value);}catch{}requestAnimationFrame(schedule);};
  try{const saved=sessionStorage.getItem('kcl-preview-travel');if(['system','guided','still'].includes(saved)){travelChoice.value=saved;engine.setMotionPreference(saved);}}catch{}
  engine.viewport.append(menu);composition.hidden=true;composition.dataset.keepHidden='true';signLayer.hidden=true;
  const invitation=document.createElement('div');invitation.className='aisle-invitation';
  const invitationTitle=document.createElement('p');invitationTitle.className='invitation-title';invitationTitle.textContent='Get your feet wet.';
  const invitationBody=document.createElement('p');invitationBody.className='invitation-body';invitationBody.textContent='Take a walk through the art before you.';
  const invitationCue=document.createElement('p');invitationCue.className='invitation-cue';invitationCue.textContent=engine.getState().reducedMotion?'Choose a collection below to explore.':'Scroll or swipe to explore.';
  invitation.append(invitationTitle,invitationBody,invitationCue);engine.viewport.append(invitation);
  const note=document.querySelector('.note');note.textContent='Your original pier photograph, with separately moving photographic easels. Guided forward/back travel; no free-roaming reconstruction.';
  for(const{slot,anchor}of engine.slotAnchors){anchor.href='#collection/'+slot.category;anchor.setAttribute('aria-label','Explore '+slot.categoryLabel);}
  engine.journey.querySelectorAll('.aisle-fallback a').forEach((a,i)=>a.href='#collection/'+enriched[i].category);
  const signs=engine.slotAnchors.map(({slot,anchor})=>{
    const a=document.createElement('a');a.className='category-sign aisle-category-sign';a.href='#collection/'+slot.category;a.textContent=slot.categoryLabel;a.dataset.forCanvas=slot.id;
    a.onclick=e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();enterCategory(slot,a);};
    a.setAttribute('aria-label','Explore '+slot.categoryLabel);engine.viewport.append(a);return{slot,anchor,a};
  });
  const progress=engine.viewport.querySelector('.aisle-progress');
  const prev=document.createElement('button'),next=document.createElement('button');prev.type=next.type='button';prev.textContent='←';next.textContent='→';prev.setAttribute('aria-label','Walk back to the previous pair of canvases');next.setAttribute('aria-label','Walk forward to the next pair of canvases');prev.className=next.className='walk-step';progress.prepend(prev);progress.append(next);progress.setAttribute('aria-label','Scroll or swipe to walk; arrow buttons advance one pair');
  const stops=[0,.16,.30,.51,.79,1],reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function step(direction){const state=engine.getState(),target=direction>0?stops.find(v=>v>state.progress+.015):[...stops].reverse().find(v=>v<state.progress-.015);if(target===undefined)return;const y=engine.journey.getBoundingClientRect().top+scrollY+target*(engine.journey.offsetHeight-engine.viewport.clientHeight);scrollTo({top:y,behavior:reduced.matches?'instant':'smooth'});}
  prev.onclick=()=>step(-1);next.onclick=()=>step(1);
  let frame=0;
  function layout(){frame=0;if(collections.active||mount.hidden)return;const state=engine.getState();if(!state.viewport.width||!state.viewport.height)return;
    const invitationOpacity=state.reducedMotion?1:Math.max(0,1-state.progress/.045);
    invitation.style.opacity=String(invitationOpacity);invitation.setAttribute('aria-hidden',String(invitationOpacity===0));
    invitationCue.textContent=state.reducedMotion?'Choose a collection below to explore.':'Scroll or swipe to explore.';
    for(let i=0;i<signs.length;i++){const{a}=signs[i],r=state.slots[i],q=r.projectedQuad;if(!q.length){a.hidden=true;continue;}const x=(q[0].x+q[1].x)/2,y=Math.min(q[0].y,q[1].y)-12,w=Math.max(...q.map(p=>p.x))-Math.min(...q.map(p=>p.x));
      a.hidden=state.reducedMotion||!r.interactive||w<Math.min(105,state.viewport.width*.15)||x<30||x>state.viewport.width-30||y<65||y>state.viewport.height-100;
      a.style.left=Math.max(66,Math.min(state.viewport.width-66,x))+'px';a.style.top=y+'px';
    }
    prev.disabled=state.progress<.01;next.disabled=state.progress>.985;
    progress.querySelector('span').textContent=state.progress>.985?'Scroll back to return':matchMedia('(pointer:coarse)').matches?'Swipe up to walk forward':'Scroll to walk forward';
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(layout);}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});addEventListener('popstate',()=>requestAnimationFrame(schedule));reduced.addEventListener('change',schedule);
  engine.viewport.addEventListener('kclaisleframe',schedule);
  const observer=new ResizeObserver(()=>requestAnimationFrame(schedule));observer.observe(engine.viewport);requestAnimationFrame(schedule);
  if(collections.active)mount.hidden=true;
  return{...engine,mount,signs};
}
