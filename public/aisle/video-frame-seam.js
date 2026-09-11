/**
 * Actual generated-video JPEG frames, fetched only after explicit opt-in.
 * This driver is a decode/commit clock, NOT a camera or easel tracking solution.
 * The owning aisle commits its projections in the same render as commit().
 */
const clamp = value => Math.max(0, Math.min(1, value));
const MAX_CACHE = 5, MAX_IN_FLIGHT = 2;

export function createVideoFrameSeam({viewport, poster, onReady, manifestURL='/video/frames.json', trackingURL='/video/tracking-preview.json'}) {
  const controls=document.createElement('div');
  controls.className='aisle-video-controls';
  const button=document.createElement('button');
  button.type='button'; button.className='aisle-video-toggle';
  button.textContent='Preview video walk'; button.setAttribute('aria-pressed','false');
  const status=document.createElement('span');
  status.className='aisle-video-status'; status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  controls.append(button,status); viewport.append(controls);

  let enabled=false, suppressed=false, destroyed=false, failed=false, generation=0;
  let manifest=null, tracking=null, manifestPromise=null, manifestAbort=null, desiredProgress=0;
  let requested=-1, committed=-1, currentImage=null, commits=0, direction=1;
  const cache=new Map(), inFlight=new Map(), failedFrames=new Set();
  const baseURL=new URL(manifestURL,location.origin);
  let lastStatus='';

  function announce(text) { if(text!==lastStatus){status.textContent=text;lastStatus=text;} }
  function isActive() { return enabled&&!suppressed&&!failed&&!destroyed; }
  function updateControl() {
    button.disabled=suppressed;
    button.setAttribute('aria-pressed',String(enabled&&!suppressed));
    button.textContent=enabled&&!suppressed?'Return to photographic walk':'Preview video walk';
    if(suppressed)announce('Video preview is off in Still or reduced motion.');
    else if(failed)announce('Video preview unavailable. The still photograph remains available.');
    else if(!enabled)announce('');
    else if(!manifest||committed<0)announce('Loading video frame…');
    else announce('Experimental video preview · alignment still in review.');
  }
  function release(entry) {
    if(!entry)return;
    if(entry.image!==currentImage)entry.image.remove();
    URL.revokeObjectURL(entry.objectURL);
  }
  function resetFrames() {
    generation++;
    for(const job of inFlight.values())job.abort.abort();
    inFlight.clear();
    currentImage?.remove();currentImage=null;
    for(const entry of cache.values())release(entry);
    cache.clear();committed=-1;requested=-1;poster.hidden=false;
    viewport.dataset.videoFrame='';viewport.dataset.videoPreview='false';
  }
  function fail(error) {
    if(destroyed)return;
    failed=true;resetFrames();updateControl();onReady?.();
    // Keep diagnostics bounded and free of source-machine paths/credentials.
    controls.dataset.failure=error?.name==='AbortError'?'aborted':'frame-or-manifest-unavailable';
  }
  function validate(value) {
    if(!value||!['preview-only','approved'].includes(value.reviewStatus))throw Error('Unreviewed frame sequence');
    if(!Array.isArray(value.frames)||value.frames.length<2||value.frames.length>500)throw Error('Frame sequence bounds');
    let previous=-1;
    const frames=value.frames.map((f,order)=>{
      if(!Number.isFinite(f.time)||f.time<0||f.time<=previous||!Number.isInteger(f.index))throw Error('Non-monotonic actual frame timestamps');
      if(!/^[a-zA-Z0-9_-]+\.(?:jpg|jpeg|webp)$/.test(f.file||''))throw Error('Frame filename must be local');
      if(!(f.width>0&&f.width<=1280&&f.height>0&&f.height<=1280))throw Error('Web-frame dimension budget');
      previous=f.time;return {...f,order,url:new URL(f.file,baseURL).href};
    });
    return {...value,frames,lastTime:frames.at(-1).time};
  }
  function validateTracking(value, sequence) {
    const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);
    if(value?.reviewStatus!=='preview-only'||value.enabled!==true||value.method!=='measured-2d-flow')throw Error('Tracking is not enabled for preview');
    if(value.videoSha256!==sequence.source?.videoSha256)throw Error('Tracking source mismatch');
    const {width,height}=value.coordinateSpace||{};
    if(width!==sequence.source.nativeWidth||height!==sequence.source.nativeHeight)throw Error('Tracking coordinate mismatch');
    const m=value.initialMatrix;
    if(!Array.isArray(m)||m.length!==3||!m.every(r=>finiteArray(r,3))||m[2][0]!==0||m[2][1]!==0||m[2][2]!==1)throw Error('Initial affine registration unavailable');
    if(!Array.isArray(value.frames)||value.frames.length!==sequence.frames.length)throw Error('Tracking frame count mismatch');
    const frames=value.frames.map((frame,i)=>{
      if(frame.index!==sequence.frames[i].index||Math.abs(frame.time-sequence.frames[i].time)>1e-6)throw Error('Tracking timestamp mismatch');
      if(!Array.isArray(frame.groups)||frame.groups.length!==5)throw Error('Missing depth groups');
      const depths=new Set();
      for(const group of frame.groups){
        if(!Number.isInteger(group.depth)||group.depth<1||group.depth>5||depths.has(group.depth)||typeof group.valid!=='boolean')throw Error('Invalid depth mapping');
        depths.add(group.depth);
        if(group.valid&&(!finiteArray(group.affine,6)||Math.abs(group.affine[0]*group.affine[3]-group.affine[1]*group.affine[2])<1e-8))throw Error('Invalid measured affine');
        if(!group.valid&&group.affine!==null)throw Error('Failed tracking must not retain a matrix');
      }
      return frame;
    });
    return {...value,frames,initialAffine:[m[0][0],m[1][0],m[0][1],m[1][1],m[0][2],m[1][2]]};
  }
  async function loadManifest() {
    if(manifest)return manifest;
    if(manifestPromise)return manifestPromise;
    manifestAbort=new AbortController();
    manifestPromise=(async()=>{
      const options={signal:manifestAbort.signal,credentials:'same-origin'};
      const [response,trackResponse]=await Promise.all([fetch(baseURL,options),fetch(new URL(trackingURL,location.origin),options)]);
      if(!response.ok||!trackResponse.ok)throw Error('Frame or tracking manifest unavailable');
      const sequence=validate(await response.json());
      const measured=validateTracking(await trackResponse.json(),sequence);
      tracking=measured;manifest=sequence;
      return manifest;
    })();
    try{return await manifestPromise;}finally{manifestPromise=null;manifestAbort=null;}
  }
  function nearest(progress) {
    const time=progress*manifest.lastTime,frames=manifest.frames;
    let lo=0,hi=frames.length-1;
    while(lo<hi){const mid=Math.floor((lo+hi)/2);if(frames[mid].time<time)lo=mid+1;else hi=mid;}
    if(lo>0&&time-frames[lo-1].time<frames[lo].time-time)lo--;
    return lo;
  }
  function trim() {
    const disposable=[...cache.keys()].filter(i=>i!==committed&&i!==requested)
      .sort((a,b)=>Math.abs(b-requested)-Math.abs(a-requested));
    while(cache.size>MAX_CACHE&&disposable.length){const i=disposable.shift();release(cache.get(i));cache.delete(i);}
  }
  async function decode(order) {
    const frame=manifest.frames[order],abort=new AbortController(),epoch=generation;
    const job={abort};inFlight.set(order,job);
    let objectURL=null;
    try{
      const response=await fetch(frame.url,{signal:abort.signal,credentials:'same-origin'});
      if(!response.ok||!/^image\//.test(response.headers.get('content-type')||''))throw Error('Frame response unavailable');
      const blob=await response.blob();
      if(blob.size>1500000)throw Error('Web frame exceeds byte budget');
      objectURL=URL.createObjectURL(blob);
      const image=new Image();image.decoding='async';image.alt='';image.className='aisle-video-frame';
      image.setAttribute('aria-hidden','true');image.src=objectURL;await image.decode();
      if(image.naturalWidth!==frame.width||image.naturalHeight!==frame.height)throw Error('Decoded frame dimensions disagree');
      if(epoch!==generation||!isActive()){URL.revokeObjectURL(objectURL);return;}
      image.dataset.sourceFrame=String(frame.index);image.dataset.mediaTime=String(frame.mediaTime??frame.time);
      cache.set(order,{image,objectURL,frame});objectURL=null;trim();onReady?.();
    }catch(error){
      if(objectURL)URL.revokeObjectURL(objectURL);
      if(epoch===generation&&isActive()&&error.name!=='AbortError'){
        failedFrames.add(order);
        if(order===requested)fail(error);
      }
    }finally{
      if(inFlight.get(order)===job)inFlight.delete(order);
      if(epoch===generation&&isActive())pump();
    }
  }
  function pump() {
    if(!isActive()||!manifest||requested<0)return;
    const candidates=[requested,requested+direction,requested-direction,requested+2*direction];
    for(const order of candidates){
      if(inFlight.size>=MAX_IN_FLIGHT)break;
      if(order<0||order>=manifest.frames.length||cache.has(order)||inFlight.has(order)||failedFrames.has(order))continue;
      void decode(order);
    }
  }
  function request(progress) {
    desiredProgress=clamp(progress);
    if(!isActive()||!manifest)return;
    const next=nearest(desiredProgress);
    if(failedFrames.has(next)){fail(new Error('Requested frame unavailable'));return;}
    if(next!==requested){direction=next>requested?1:-1;requested=next;
      for(const [order,job]of inFlight)if(Math.abs(order-requested)>3)job.abort.abort();
    }
    pump();
  }
  function commit() {
    if(!isActive()||!manifest)return null;
    let changed=false;
    const entry=cache.get(requested);
    if(entry&&requested!==committed){
      // This swap and the owner's projected-quad update share one synchronous
      // render task. A late/out-of-order decode can never select a stale frame.
      currentImage?.remove();currentImage=entry.image;
      viewport.insertBefore(currentImage,poster.nextSibling);poster.hidden=true;
      committed=requested;commits++;changed=true;
      viewport.dataset.videoFrame=String(entry.frame.index);viewport.dataset.videoPreview='true';
      updateControl();trim();
    }
    if(committed<0)return null;
    const frame=manifest.frames[committed];
    return {changed,index:frame.index,time:frame.time,mediaTime:frame.mediaTime??frame.time,
      progress:frame.time/manifest.lastTime,requestedProgress:desiredProgress,
      width:frame.width,height:frame.height,url:frame.url,sha256:frame.sha256,
      tracking:{initialAffine:tracking.initialAffine,coordinateSpace:tracking.coordinateSpace,groups:tracking.frames[committed].groups},
      projectionMethod:'measured 2D flow × initial registration; approximate depth, not solved 3D'};
  }
  async function setEnabled(value) {
    enabled=Boolean(value);failed=false;failedFrames.clear();delete controls.dataset.failure;
    if(!enabled){manifestAbort?.abort();resetFrames();updateControl();onReady?.();return false;}
    updateControl();
    if(suppressed)return false;
    try{await loadManifest();if(!isActive())return false;request(desiredProgress);onReady?.();return true;}
    catch(error){if(error.name!=='AbortError')fail(error);else if(isActive())return setEnabled(true);return false;}
  }
  function setSuppressed(value) {
    value=Boolean(value);if(value===suppressed)return;
    suppressed=value;
    if(suppressed){manifestAbort?.abort();resetFrames();}
    else if(enabled)void setEnabled(true);
    updateControl();
  }
  button.addEventListener('click',()=>void setEnabled(!enabled));
  const getState=()=>({enabled,active:isActive(),suppressed,failed,
    status:failed?'unavailable':suppressed?'suppressed':!enabled?'off':committed<0?'loading':'ready',
    requestedFrame:manifest?.frames[requested]?.index??null,
    committedFrame:manifest?.frames[committed]?.index??null,
    committedTime:manifest?.frames[committed]?.time??null,
    requestedProgress:desiredProgress,decodedCacheSize:cache.size,inFlight:inFlight.size,
    maxDecodedCache:MAX_CACHE,maxInFlight:MAX_IN_FLIGHT,commits,
    videoSHA256:manifest?.source?.videoSha256??null,
    tracking:tracking?.method??'not loaded',
    invalidDepths:tracking?.frames[committed]?.groups.filter(g=>!g.valid).map(g=>g.depth)??[],
    frameURL:manifest?.frames[committed]?.url??null});
  function destroy(){destroyed=true;manifestAbort?.abort();resetFrames();controls.remove();}
  return {request,commit,getState,setEnabled,setSuppressed,destroy,controls};
}
