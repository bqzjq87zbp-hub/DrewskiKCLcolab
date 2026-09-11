import {homography} from '/pier-v2-20260910/canvas-wrap.js';
import {sceneImage} from '../scene-images.js';
import {createVideoFrameSeam} from './video-frame-seam.js';
import {DEPTHS as depths,galleryDistance} from './gallery-layout.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/** A physical photographic forward/back walk with an ordinary-photo fallback. No wheel or touch interception.
 *  Root owns category data, callbacks, menu, collection routing and release.
 */
export function initPhotographicAisle({container,slots,onSelect,onCategory}){
  if(!(container instanceof Element)||!Array.isArray(slots)||!slots.length)throw Error('Aisle needs an empty container and measured slots');
  if(container.children.length)throw Error('Aisle container must be empty; existing scene is not overwritten');
  const ownedStyle=document.createElement('link');ownedStyle.rel='stylesheet';ownedStyle.href=new URL('./aisle.css',import.meta.url).href;if(!document.querySelector('link[data-kcl-aisle-style]'))document.head.append(ownedStyle);
  const journey=document.createElement('section');journey.className='aisle-journey';journey.id='aisle-journey';journey.setAttribute('aria-label','Photographic aisle');
  const viewport=document.createElement('div');viewport.className='aisle-viewport';
  const original=document.createElement('img');original.className='aisle-original';original.src=sceneImage('/pier-v1-20260909/media/underpier-photograph.jpg');original.alt="Kyle's original photograph beneath Newport Pier";original.width=4000;original.height=2667;original.decoding='async';original.fetchPriority='high';viewport.append(original);
  const progress=document.createElement('div');progress.className='aisle-progress';progress.innerHTML='<span>Scroll to move through</span><progress max="1" value="0" aria-label="Aisle progress"></progress>';viewport.append(progress);
  const fallback=document.createElement('ol');fallback.className='aisle-fallback';fallback.setAttribute('aria-label','All photographs without camera motion');
  const fallbackCategories=new Set();
  const records=slots.map(slot=>{
    if(!depths[slot.depth])throw Error('Unsupported measured depth '+slot.depth);
    const group=document.createElement('div');group.className='aisle-slot';group.dataset.slotId=slot.id;group.dataset.depth=slot.depth;group.style.zIndex=String(60-slot.depth);group.hidden=true;viewport.insertBefore(group,progress);
    const select=(trigger,event)=>{if(slot.category&&onCategory)onCategory(slot,trigger,event);else onSelect?.(slot,trigger,event);};
    const anchor=document.createElement('a');anchor.className='canvas-wrap-front';anchor.dataset.aisleSlot=slot.id;
    anchor.style.cssText='position:absolute;left:0;top:0;width:1000px;height:1000px;display:block;transform-origin:0 0;background:transparent';
    anchor.setAttribute('aria-label',slot.categoryLabel||slot.title);anchor.tabIndex=-1;
    if(slot.category)anchor.dataset.category=typeof slot.category==='string'?slot.category:slot.category.id||'';
    anchor.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;event.preventDefault();select(anchor,event);});group.append(anchor);
    if(!fallbackCategories.has(slot.category)){fallbackCategories.add(slot.category);
    const li=document.createElement('li'),a=document.createElement('a'),img=document.createElement('img'),label=document.createElement('span');a.href=slot.full;a.dataset.category=slot.category;img.src=sceneImage(slot.src);img.alt=slot.alt;img.loading='lazy';label.textContent=slot.categoryLabel||slot.title;a.append(img,label);a.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;event.preventDefault();select(a,event);});li.append(a);fallback.append(li);}
    return{slot,group,anchor,depth:depths[slot.depth],scale:1,projectedQuad:[]};
  });
  journey.append(viewport,fallback);container.append(journey);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let motionPreference='system',frame=0,destroyed=false,p=0,z=0,look='ahead',dimensions={width:0,height:0},frameCount=0;
  const video=createVideoFrameSeam({viewport,poster:original,onReady:schedule});
  let physical={ready:false,getState:()=>({ready:false,painted:false,error:null}),render:()=>null,destroy:()=>{}};
  let failed=false,lastInteraction=performance.now();
  const loading=document.createElement('div');loading.className='aisle-loading';loading.style.position='absolute';loading.setAttribute('data-kcl-glass-surface','');loading.setAttribute('role','status');
  const loadingText=document.createElement('span');loadingText.textContent='Loading your walk…';
  const browse=document.createElement('a');browse.href='#photographs';browse.textContent='Browse collections';
  const retry=document.createElement('button');retry.type='button';retry.textContent='Try the walk again';retry.hidden=true;retry.onclick=()=>location.reload();
  loading.append(loadingText,browse,retry);viewport.append(loading);viewport.dataset.loading='true';
  function fail(reason){
    if(failed||destroyed)return;
    failed=true;clearTimeout(deadline);physical.destroy();
    viewport.dataset.dimensional='false';viewport.dataset.loading='false';journey.dataset.failed='true';
    loading.hidden=false;loadingText.textContent='The walk is unavailable. Browse the photographs below.';retry.hidden=false;
    records.forEach(r=>{r.group.hidden=true;r.anchor.tabIndex=-1;r.projectedQuad=[];});
    physical={ready:false,getState:()=>({ready:false,painted:false,error:reason,fallback:true}),render:()=>null,destroy:()=>{}};
    measure();schedule();
  }
  const deadline=setTimeout(()=>fail('startup-timeout'),20000);
  import('./physical-display.js').then(({createPhysicalDisplay})=>{
    if(failed||destroyed)return;
    physical=createPhysicalDisplay({viewport,slots,onReady:()=>{if(physical.getState()?.assetsReady&&!viewport.getClientRects().length)clearTimeout(deadline);schedule();}});schedule();
  }).catch(()=>fail('scene-module-unavailable'));
  original.addEventListener('error',()=>fail('poster-unavailable'),{once:true});
  // Native scrolling always navigates unless Still is explicitly selected.
  // System reduced motion disables idle water and smooth scrolling, not access.
  const isReduced=()=>motionPreference==='still';
  // Scroll across the full viewing area even when the photograph is framed
  // in a smaller stage. This reaches the last pair before sticky exit begins.
  const getScrollRange=()=>Math.max(1,journey.offsetHeight-innerHeight);
  let measurement=null,scrollPosition=null;
  function rememberScrollPosition(){
    // A resize can clamp scrollY before its callback. Do not record that clamp
    // against the old range, or replace a hidden collection's return position.
    if(!measurement?.active||innerWidth!==measurement.windowWidth||innerHeight!==measurement.windowHeight||viewport.clientWidth!==measurement.width||viewport.clientHeight!==measurement.height)return;
    const offset=scrollY-measurement.top;
    scrollPosition={progress:clamp(offset/measurement.range,0,1),inJourney:offset>=-.5&&offset<=measurement.range+.5};
  }
  function measure(preserveProgress=false){
    const width=viewport.clientWidth,height=viewport.clientHeight;
    const next={width,height,windowWidth:innerWidth,windowHeight:innerHeight,top:journey.getBoundingClientRect().top+scrollY,range:getScrollRange(),active:width>0&&height>0&&!isReduced()&&journey.dataset.reduced!=='true'};
    const resized=measurement&&(width!==measurement.width||height!==measurement.height||innerWidth!==measurement.windowWidth||innerHeight!==measurement.windowHeight);
    const preserved=preserveProgress&&resized&&measurement.active&&next.active&&scrollPosition?.inJourney?scrollPosition.progress:null;
    dimensions={width,height};measurement=next;
    if(preserved!==null)scrollTo({top:next.top+preserved*next.range,behavior:'instant'});
    scrollPosition=null;rememberScrollPosition();
  }
  function render(now=performance.now()){
    frame=0;if(destroyed||!dimensions.width||!dimensions.height)return;frameCount++;
    // Commit native scrolling on the next display frame. A fixed 30 ms gate
    // discarded every other 60 Hz frame, even when rendering was inexpensive.
    const reducedMode=isReduced(),top=journey.getBoundingClientRect().top+scrollY,range=getScrollRange(),requestedProgress=reducedMode?0:clamp((scrollY-top)/range,0,1);
    rememberScrollPosition();
    video.setSuppressed(reducedMode||reduced.matches);video.request(requestedProgress);
    const committed=video.commit();p=committed?committed.progress:requestedProgress;
    z=committed?null:galleryDistance(p);
    // Scrolling moves along the aisle. Only an explicit look control changes
    // heading, on phones as well as desktop; it never oscillates with progress.
    const aimedLook=look==='left'?1:look==='right'?-1:0;
    let physicalFrames=null;
    try{physicalFrames=physical.render({width:dimensions.width,height:dimensions.height,progress:p,committed,reduced:reducedMode||reduced.matches,time:now/1000,look:aimedLook});}
    catch{fail('scene-render-failed');}
    if(physical.getState()?.error&&!failed)fail(physical.getState().error);
    if(physicalFrames){clearTimeout(deadline);loading.hidden=true;viewport.dataset.loading='false';}

    viewport.dataset.dimensional=String(Boolean(physicalFrames));
    for(const r of records){
      if(physicalFrames){
        const state=physicalFrames.find(s=>s.id===r.slot.id);
        r.group.hidden=false;r.group.style.transform='none';r.group.dataset.passed=String(state.passed);
        r.projectedQuad=state.quad;r.physical=state.physical;r.source=state.source;r.projectionMatrix=null;r.trackingValid=null;r.scale=1;
        const xs=state.quad.map(q=>q.x),ys=state.quad.map(q=>q.y);
        const width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
        const visible=!state.passed&&Math.max(...xs)>0&&Math.min(...xs)<dimensions.width&&Math.max(...ys)>0&&Math.min(...ys)<dimensions.height;
        r.anchor.style.transform=homography(state.quad.map(q=>[q.x,q.y])).css;
        r.anchor.tabIndex=visible&&width>=44&&height>=44&&!reducedMode?0:-1;
        r.anchor.setAttribute('aria-hidden',String(r.anchor.tabIndex<0));r.group.dataset.small=String(width<44||height<44);
        r.anchor.dataset.projectedWidth=width.toFixed(2);r.anchor.dataset.projectedHeight=height.toFixed(2);
        r.anchor.dataset.cameraDepth=state.distance.toFixed(3);
        continue;
      }
      r.group.hidden=true;r.projectedQuad=[];r.anchor.tabIndex=-1;r.anchor.setAttribute('aria-hidden','true');
    }
    // Integration owns the HUD wording. Updating it here and again in the
    // integration RAF alternated text widths every frame and shook the buttons.
    progress.querySelector('progress').value=p;
    viewport.dispatchEvent(new CustomEvent('kclaisleframe',{bubbles:true,detail:{frameIndex:committed?.index??null,mediaTime:committed?.mediaTime??null,committedProgress:p,requestedProgress,projectionMethod:committed?.projectionMethod??(physicalFrames?'physical photographic scene':'photographic loading or fallback')}}));
    const bounds=viewport.getBoundingClientRect();
    if(!failed&&physical.ready&&now-lastInteraction<220&&!reducedMode&&!reduced.matches&&!document.hidden&&bounds.bottom>0&&bounds.top<innerHeight&&viewport.getClientRects().length)schedule();
  }
  function schedule(){if(!frame&&!destroyed)frame=requestAnimationFrame(render);}
  function onScroll(){lastInteraction=performance.now();rememberScrollPosition();schedule();}
  function resize(){lastInteraction=performance.now();measure(true);schedule();}
  function preference(){journey.dataset.reduced=String(isReduced());measure();schedule();}
  function setMotionPreference(mode){if(!['system','guided','still'].includes(mode))throw new TypeError('Motion preference must be system, guided or still');motionPreference=mode;preference();return mode;}
  function setLook(direction){look=['left','right','ahead'].includes(direction)?direction:'ahead';schedule();}
  document.addEventListener('visibilitychange',schedule);
  const observer=new ResizeObserver(resize);observer.observe(viewport);window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',resize,{passive:true});reduced.addEventListener('change',preference);preference();
  original.decode().then(resize).catch(()=>fail('poster-unavailable'));
  const getState=()=>({kind:physical.ready?'dimensional easels with continuous photographic scenery; background depth approximate':video.getState().committedFrame!==null?'generated-video frames with measured 2D alignment; depth approximate':failed?'photographic collection fallback':'loading photographic walk',physical:physical.getState?.(),scrollY,scrollRange:getScrollRange(),cameraZ:z,progress:p,motionPreference,lookDirection:look,reducedMotion:isReduced(),systemReducedMotion:reduced.matches,backgroundAnimated:video.getState().committedFrame!==null,video:video.getState(),frameCount,viewport:{...dimensions},slots:records.map(r=>({id:r.slot.id,depth:r.depth,depthGroup:r.slot.depth,distance:z===null?null:r.depth-z,scale:r.scale,passed:r.group.dataset.passed==='true',trackingValid:r.trackingValid,projectionMatrix:r.projectionMatrix,physical:r.physical,source:r.source,projectedQuad:r.projectedQuad,interactive:r.anchor.tabIndex===0}))});
  const captureReturnPosition=()=>{
    const top=journey.getBoundingClientRect().top+scrollY,range=getScrollRange(),offset=scrollY-top;
    return{scrollY,progress:!isReduced()&&viewport.clientWidth>0&&offset>=0&&offset<=range?offset/range:null};
  };
  const restore=state=>{
    if(!state||!Number.isFinite(state.scrollY))return false;
    // Collections can resize while this scene is hidden. Restore the saved
    // walk fraction against its new range before the next rendered frame.
    measure();
    const top=journey.getBoundingClientRect().top+scrollY;
    const y=!isReduced()&&Number.isFinite(state.progress)?top+clamp(state.progress,0,1)*getScrollRange():state.scrollY;
    scrollTo({top:y,behavior:'instant'});rememberScrollPosition();schedule();return true;
  };
  const destroy=()=>{destroyed=true;clearTimeout(deadline);if(frame)cancelAnimationFrame(frame);physical.destroy();video.destroy();observer.disconnect();document.removeEventListener('visibilitychange',schedule);window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',resize);reduced.removeEventListener('change',preference);journey.remove();ownedStyle.remove();};
  return{viewport,journey,getState,getScrollRange,captureReturnPosition,restore,destroy,setMotionPreference,setLook,setVideoPreview:video.setEnabled,slotAnchors:records.map(({slot,anchor,group})=>({slot,anchor,group})),homography};
}
