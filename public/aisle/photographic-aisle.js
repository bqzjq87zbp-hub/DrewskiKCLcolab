import {createWrappedCanvas,homography} from '/canvas-wrap.js';
import {easelMask} from './easel-masks.js';
import {createVideoFrameSeam} from './video-frame-seam.js';

const W=2528,H=1684,VP={x:1327,y:1416},depths=[0,4,6.15,9.8,15.2,21],travel=17;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// CSS affine order [a,b,c,d,e,f]. Compose left × right exactly once.
const multiply=(l,r)=>[l[0]*r[0]+l[2]*r[1],l[1]*r[0]+l[3]*r[1],l[0]*r[2]+l[2]*r[3],l[1]*r[2]+l[3]*r[3],l[0]*r[4]+l[2]*r[5]+l[4],l[1]*r[4]+l[3]*r[5]+l[5]];
let nextInstance=0;

/** A photographic2.5D forward/back dolly. No wheel or touch interception.
 *  Root owns category data, callbacks, menu, collection routing and release.
 */
export function initPhotographicAisle({container,slots,onSelect,onCategory}){
  if(!(container instanceof Element)||!Array.isArray(slots)||!slots.length)throw Error('Aisle needs an empty container and measured slots');
  if(container.children.length)throw Error('Aisle container must be empty; existing scene is not overwritten');
  const instance=++nextInstance,ownedStyle=document.createElement('link');ownedStyle.rel='stylesheet';ownedStyle.href=new URL('./aisle.css',import.meta.url).href;document.head.append(ownedStyle);
  const journey=document.createElement('section');journey.className='aisle-journey';journey.id='aisle-journey';journey.setAttribute('aria-label','Photographic aisle');
  const viewport=document.createElement('div');viewport.className='aisle-viewport';
  const original=document.createElement('img');original.className='aisle-original';original.src='/media/underpier-photograph.jpg';original.alt="Kyle's original photograph beneath Newport Pier";original.width=4000;original.height=2667;original.decoding='async';original.fetchPriority='high';viewport.append(original);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('width','0');svg.setAttribute('height','0');svg.setAttribute('aria-hidden','true');svg.style.position='absolute';const defs=document.createElementNS(svg.namespaceURI,'defs');svg.append(defs);viewport.append(svg);
  // The reference contains front-to-back canvas occlusion. Only expose actual
  // photographed wood; never carry a neighboring baked checkerboard along with it.
  function exposedWoodMask(index){const mask=document.createElementNS(svg.namespaceURI,'mask');mask.id=`aisle-wood-only-${instance}-${index}`;mask.setAttribute('maskUnits','userSpaceOnUse');mask.setAttribute('maskContentUnits','userSpaceOnUse');mask.setAttribute('x','0');mask.setAttribute('y','0');mask.setAttribute('width',W);mask.setAttribute('height',H);mask.style.maskType='luminance';const field=document.createElementNS(svg.namespaceURI,'rect');field.setAttribute('width',W);field.setAttribute('height',H);field.setAttribute('fill','white');mask.append(field);slots.forEach((slot,i)=>{if(i===index)return;const cut=document.createElementNS(svg.namespaceURI,'polygon');cut.setAttribute('points',(slot.edge||slot.quad).map(p=>p.join(',')).join(' '));cut.setAttribute('fill','black');cut.setAttribute('stroke','black');cut.setAttribute('stroke-width','6');cut.setAttribute('stroke-linejoin','round');mask.append(cut);});defs.append(mask);return mask;}
  const progress=document.createElement('div');progress.className='aisle-progress';progress.innerHTML='<span>Scroll to move through</span><progress max="1" value="0" aria-label="Aisle progress"></progress>';viewport.append(progress);
  const fallback=document.createElement('ol');fallback.className='aisle-fallback';fallback.setAttribute('aria-label','All photographs without camera motion');
  const records=slots.map((slot,index)=>{
    if(!depths[slot.depth])throw Error('Unsupported measured depth '+slot.depth);
    const mask=document.createElementNS(svg.namespaceURI,'clipPath');mask.id=`aisle-mask-${instance}-${index}`;mask.setAttribute('clipPathUnits','userSpaceOnUse');for(const points of easelMask(slot)){const p=document.createElementNS(svg.namespaceURI,'polygon');p.setAttribute('points',points.map(x=>x.join(',')).join(' '));mask.append(p);}defs.append(mask);
    const group=document.createElement('div');group.className='aisle-slot';group.dataset.slotId=slot.id;group.dataset.depth=slot.depth;group.style.zIndex=String(60-slot.depth);const wood=document.createElement('img');wood.className='aisle-wood';wood.src='/media/easel-composition-reference.jpg';wood.alt='';wood.width=W;wood.height=H;wood.style.clipPath=`url(#${mask.id})`;wood.style.mask=`url(#${exposedWoodMask(index).id})`;group.append(wood);
    const select=(trigger,event)=>{if(slot.category&&onCategory)onCategory(slot,trigger,event);else onSelect?.(slot,trigger,event);};
    const wrap=createWrappedCanvas(slot,index,{onSelect:(_i,trigger,_slot,event)=>select(trigger,event)});group.append(wrap);viewport.insertBefore(group,progress);
    const anchor=wrap.querySelector('.canvas-wrap-front');anchor.dataset.aisleSlot=slot.id;anchor.setAttribute('aria-label',slot.categoryLabel||slot.title);if(slot.category)anchor.dataset.category=typeof slot.category==='string'?slot.category:slot.category.id||'';
    const li=document.createElement('li'),a=document.createElement('a'),img=document.createElement('img'),label=document.createElement('span');a.href=slot.full;img.src=slot.src;img.alt=slot.alt;img.loading='lazy';label.textContent=slot.categoryLabel||slot.title;a.append(img,label);a.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;event.preventDefault();select(a,event);});li.append(a);fallback.append(li);
    return{slot,group,anchor,wood,depth:depths[slot.depth],scale:1,projectedQuad:[]};
  });
  journey.append(viewport,fallback);container.append(journey);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let motionPreference='system',frame=0,destroyed=false,p=0,z=0,dimensions={width:0,height:0},frameCount=0;
  const video=createVideoFrameSeam({viewport,poster:original,onReady:schedule});
  const isReduced=()=>motionPreference==='still'||(motionPreference==='system'&&reduced.matches);
  // The generated walk is the background. Still and reduced motion keep the photograph.
  if(!isReduced())void video.setEnabled(true);
  // Living water: WebGPU-only overlay that keeps the sea moving while scroll is idle.
  // Browsers without WebGPU never fetch the bundle; any failure leaves the img pipeline as-is.
  let water=null;
  if('gpu'in navigator)import('/aisle/water-layer.js').then(m=>m.mountWaterLayer(viewport)).then(w=>{water=w;}).catch(()=>{});
  function measure(){dimensions={width:viewport.clientWidth,height:viewport.clientHeight};}
  function render(){
    frame=0;if(destroyed||!dimensions.width||!dimensions.height)return;frameCount++;
    const reducedMode=isReduced(),top=journey.getBoundingClientRect().top+scrollY,range=Math.max(1,journey.offsetHeight-viewport.clientHeight),requestedProgress=reducedMode?0:clamp((scrollY-top)/range,0,1);
    video.setSuppressed(reducedMode||reduced.matches);video.request(requestedProgress);
    const committed=video.commit();p=committed?committed.progress:requestedProgress;
    z=committed?null:p*travel;
    const fit=dimensions.width/W,vpx=dimensions.width*(VP.x/W),vpy=dimensions.height*.846;
    let cover=null;
    if(committed){
      // Match the decoded image's object-fit:cover and 52% 86% positioning.
      // Native-to-web x/y scales are separate to preserve export rounding.
      const k=Math.max(dimensions.width/committed.width,dimensions.height/committed.height),native=committed.tracking.coordinateSpace;
      cover=[k*committed.width/native.width,0,0,k*committed.height/native.height,(dimensions.width-k*committed.width)*.52,(dimensions.height-k*committed.height)*.86];
    }
    for(const r of records){
      let matrix,passed=false,distance=null;
      const tracked=committed?.tracking.groups.find(g=>g.depth===r.slot.depth);
      r.trackingValid=committed?Boolean(tracked?.valid):null;
      r.group.hidden=committed&&!r.trackingValid;
      if(r.group.hidden){
        r.projectedQuad=[];r.projectionMatrix=null;r.scale=null;r.group.style.transform='none';r.group.dataset.passed='false';
        r.anchor.tabIndex=-1;r.anchor.setAttribute('aria-hidden','true');r.anchor.dataset.cameraDepth='untracked';
        continue;
      }
      if(committed){
        // Replace the old independent-depth dolly; never stack it on the data.
        matrix=multiply(cover,multiply(tracked.affine,committed.tracking.initialAffine));
        r.scale=Math.sqrt(Math.abs(matrix[0]*matrix[3]-matrix[1]*matrix[2]));
      }else{
        distance=r.depth-z;passed=distance<=.35;const s=passed?1:r.depth/distance,k=fit*s;
        r.scale=s;matrix=[k,0,0,k,vpx-VP.x*k,vpy-VP.y*k];
      }
      r.projectionMatrix=matrix;r.group.style.transform=`matrix(${matrix.join(',')})`;r.group.dataset.passed=String(passed);
      r.projectedQuad=r.slot.quad.map(([x,y])=>({x:x*matrix[0]+y*matrix[2]+matrix[4],y:x*matrix[1]+y*matrix[3]+matrix[5]}));
      const xs=r.projectedQuad.map(q=>q.x),ys=r.projectedQuad.map(q=>q.y),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys),visible=!passed&&Math.max(...xs)>0&&Math.min(...xs)<dimensions.width&&Math.max(...ys)>0&&Math.min(...ys)<dimensions.height,small=width<44||height<44;
      r.group.dataset.small=String(small);r.anchor.tabIndex=visible&&!small&&!reducedMode?0:-1;r.anchor.setAttribute('aria-hidden',String(!visible||small||reducedMode));r.anchor.dataset.projectedWidth=width.toFixed(2);r.anchor.dataset.projectedHeight=height.toFixed(2);r.anchor.dataset.cameraDepth=distance===null?'approximate 2D group':distance.toFixed(3);
    }
    progress.querySelector('progress').value=p;progress.querySelector('span').textContent=p>.985?'Scroll back to return':'Scroll to move through';
    viewport.dispatchEvent(new CustomEvent('kclaisleframe',{bubbles:true,detail:{frameIndex:committed?.index??null,mediaTime:committed?.mediaTime??null,committedProgress:p,requestedProgress,projectionMethod:committed?.projectionMethod??'static-photo independent-depth projection'}}));
  }
  function schedule(){if(!frame&&!destroyed)frame=requestAnimationFrame(render);}
  function resize(){measure();schedule();}
  function preference(){journey.dataset.reduced=String(isReduced());resize();}
  function setMotionPreference(mode){if(!['system','guided','still'].includes(mode))throw new TypeError('Motion preference must be system, guided or still');motionPreference=mode;preference();return mode;}
  const observer=new ResizeObserver(resize);observer.observe(viewport);window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',resize,{passive:true});reduced.addEventListener('change',preference);preference();
  Promise.all([original.decode(),...records.map(r=>r.wood.decode())]).then(resize).catch(()=>{const error=document.createElement('p');error.className='aisle-source-failure';error.textContent='A source photograph could not load. The ordinary photograph list remains available below.';viewport.append(error);journey.dataset.reduced='true';resize();});
  const getState=()=>({kind:video.getState().committedFrame!==null?'generated-video frames with measured 2D alignment; depth approximate':'photographic2.5D independent-depth projection',water:water?.getState?.()??null,scrollY,cameraZ:z,progress:p,motionPreference,reducedMotion:isReduced(),systemReducedMotion:reduced.matches,backgroundAnimated:video.getState().committedFrame!==null,video:video.getState(),frameCount,viewport:{...dimensions},slots:records.map(r=>({id:r.slot.id,depth:r.depth,depthGroup:r.slot.depth,distance:z===null?null:r.depth-z,scale:r.scale,passed:r.group.dataset.passed==='true',trackingValid:r.trackingValid,projectionMatrix:r.projectionMatrix,projectedQuad:r.projectedQuad,interactive:r.anchor.tabIndex===0}))});
  const restore=state=>{if(!state||!Number.isFinite(state.scrollY))return;scrollTo({top:state.scrollY,behavior:'instant'});schedule();};
  const destroy=()=>{destroyed=true;if(frame)cancelAnimationFrame(frame);water?.destroy();video.destroy();observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',resize);reduced.removeEventListener('change',preference);journey.remove();ownedStyle.remove();};
  return{viewport,journey,getState,restore,destroy,setMotionPreference,setVideoPreview:video.setEnabled,slotAnchors:records.map(({slot,anchor,group})=>({slot,anchor,group})),homography};
}
