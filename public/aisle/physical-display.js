import * as THREE from '/vendor/three.module.js';
import {createPhysicalEasel} from './physical-easel.js';
import {createPhotographicEnvironment} from './photographic-environment.js';
import {DEPTHS,TRAVEL,ROW_OFFSET,LOOK_ANGLE} from './gallery-layout.js';

// Metres, one camera, one water plane. No per-print image-space stretching.
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const image = async src => {const im=new Image();im.src=src;await im.decode();return im;};

export function createPhysicalDisplay({viewport,slots,onReady}) {
  let renderer;
  try {renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}
  catch {return {ready:false,error:'WebGL unavailable; photographic fallback retained',render:()=>null,destroy:()=>{}};}
  renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NoToneMapping;
  renderer.localClippingEnabled=true;
  renderer.domElement.className='aisle-dimensional-display';
  renderer.domElement.setAttribute('aria-hidden','true');
  viewport.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.06,90);
  // Open blue sky from the sides; warm bounced light under the timber ceiling.
  scene.add(new THREE.HemisphereLight(0xc4d7e2,0x394e50,1.5));
  const sun=new THREE.DirectionalLight(0xffeed7,1.7);sun.position.set(-8,9,6);scene.add(sun);
  const fill=new THREE.DirectionalLight(0x91bad5,.85);fill.position.set(7,4,-8);scene.add(fill);
  // Broad neutral artwork fill preserves bright whites and skin tones while
  // the rough woven canvas still responds to light. It is not emissive.
  const artworkFill=new THREE.DirectionalLight(0xffffff,1.35);artworkFill.position.set(0,4,12);artworkFill.layers.set(1);scene.add(artworkFill);
  scene.traverse(o=>{if(o.isLight&&o!==artworkFill)o.layers.enable(1);});
  function renderLitScene(viewCamera){
    // Three.js light layers are camera-scoped, not per-object. First draw the
    // normal scene, then only canvas meshes with added fill and existing depth.
    viewCamera.layers.set(0);renderer.render(scene,viewCamera);
    const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles;
    renderer.autoClear=false;viewCamera.layers.set(1);renderer.render(scene,viewCamera);
    viewCamera.layers.set(0);renderer.autoClear=true;
    return {calls:calls+renderer.info.render.calls,triangles:triangles+renderer.info.render.triangles};
  }
  const surface=new THREE.Plane(new THREE.Vector3(0,1,0),.022);
  const below=new THREE.Plane(new THREE.Vector3(0,-1,0),0);
  const contactGeometries=new Set();
  const models=[],effects=[],uniforms={phase:{value:0}},diagnostics={ready:false,error:null};
  let size='',cameraDistance=0,disposed=false,environment=null;
  function wetTimber(material) {
    if(material.userData.waterContact)return;
    material.userData.waterContact=true;
    material.onBeforeCompile=shader=>{
      shader.uniforms.waterPhase=uniforms.phase;
      shader.vertexShader='varying vec3 wetWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nwetWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader='varying vec3 wetWorld;\nuniform float waterPhase;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
        #include <clipping_planes_fragment>
        float localWater=sin(wetWorld.x*37.0+wetWorld.z*49.0+waterPhase)*.009+sin(wetWorld.z*83.0-wetWorld.x*17.0)*.005;
        if(wetWorld.y<localWater)discard;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float dry=smoothstep(localWater+.012,localWater+.09,wetWorld.y);
        diffuseColor.rgb*=mix(vec3(.42,.49,.48),vec3(1.0),dry);`);
    };
  }
  // Render the real scene from a reflected camera into one water-plane texture.
  // Distortion acts on the complete reflection, including its silhouette.
  const reflectionTarget=new THREE.WebGLRenderTarget(768,512,{depthBuffer:true});
  const reflectionCamera=new THREE.PerspectiveCamera(),textureMatrix=new THREE.Matrix4();
  const reflectionContacts=Array.from({length:slots.length*3},()=>new THREE.Vector2(1e4,1e4));
  const water=new THREE.Mesh(new THREE.PlaneGeometry(28,42),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    defines:{CONTACT_COUNT:reflectionContacts.length},
    uniforms:{reflectionMap:{value:reflectionTarget.texture},textureMatrix:{value:textureMatrix},waterPhase:uniforms.phase,
      reflectionContacts:{value:reflectionContacts},reflectionTexel:{value:new THREE.Vector2(1/768,1/512)}},
    vertexShader:`uniform mat4 textureMatrix; varying vec4 reflectedUV; varying vec3 worldPoint;
      void main(){vec4 w=modelMatrix*vec4(position,1.0);worldPoint=w.xyz;reflectedUV=textureMatrix*w;
      gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform sampler2D reflectionMap;uniform mat4 textureMatrix;uniform float waterPhase;
      uniform vec2 reflectionContacts[CONTACT_COUNT];uniform vec2 reflectionTexel;
      varying vec4 reflectedUV;varying vec3 worldPoint;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
      vec2 p=worldPoint.xz;
      float contactDistance2=1e6;
      for(int i=0;i<CONTACT_COUNT;i++){
        vec2 d=p-reflectionContacts[i];contactDistance2=min(contactDistance2,dot(d,d));
      }
      // Hold the reflection at the measured water crossings, then let the
      // same broad wave directions as the photographic water move its body.
      float freedom=smoothstep(.0081,.09,contactDistance2);
      float broad=noise(p*1.8+vec2(waterPhase*.035,-waterPhase*.055));
      float detail=noise(p*vec2(3.2,7.5)+vec2(-waterPhase*.06,waterPhase*.08));
      float wave=sin(p.y*4.8+p.x*2.2+waterPhase+(broad-.5)*1.4);
      float crossWave=sin(p.y*7.2-p.x*1.4+waterPhase*.73+1.7+(detail-.5)*1.1);
      vec2 displacement=vec2(wave*.025+crossWave*.012+(detail-.5)*.016,
        crossWave*.011+(broad-.5)*.014)*freedom;
      vec4 projected=textureMatrix*vec4(worldPoint+vec3(displacement.x,0.0,displacement.y),1.0);
      vec2 uv=reflectedUV.xy/reflectedUV.w;
      vec2 bend=projected.xy/projected.w-uv;
      // Perspective must not magnify a centimetre of wave displacement into
      // a wide ribbon at the near edge of the water plane.
      bend/=1.0+length(bend/(reflectionTexel*vec2(2.2,1.0)));
      uv+=bend;
      if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0)discard;
      // A small, resolution-aware footprint softens displaced silhouettes;
      // filtering alpha with colour keeps empty water transparent.
      vec2 footprint=reflectionTexel*mix(.25,1.4,freedom);
      vec4 reflected=texture2D(reflectionMap,uv)*.5;
      reflected+=(texture2D(reflectionMap,uv+vec2(footprint.x,0.0))+
        texture2D(reflectionMap,uv-vec2(footprint.x,0.0)))*.16;
      reflected+=(texture2D(reflectionMap,uv+vec2(0.0,footprint.y*.5))+
        texture2D(reflectionMap,uv-vec2(0.0,footprint.y*.5)))*.09;
      float crest=wave*.6+crossWave*.4+(detail-.5)*.75;
      float breakup=mix(1.0,mix(.12,1.0,smoothstep(-.55,.55,crest)),freedom);
      gl_FragColor=vec4(reflected.rgb*vec3(.68,.80,.84),reflected.a*mix(.34,.26,freedom)*breakup);
      #include <colorspace_fragment>
      }`
  }));
  water.rotation.x=-Math.PI/2;water.position.set(0,0,-15);water.renderOrder=2;scene.add(water);

  function waterMaterial(base,reflection=false) {
    const m=base.clone();m.transparent=true;m.depthWrite=false;
    m.opacity=reflection?.30:.32;m.clippingPlanes=[below];
    if(m.color)m.color.multiply(new THREE.Color(reflection?0x6e8e98:0x304f5b));
    m.onBeforeCompile=shader=>{
      shader.uniforms.waterPhase=uniforms.phase;
      shader.vertexShader='varying vec3 waterPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nwaterPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader='varying vec3 waterPosition;\nuniform float waterPhase;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>', `
        float wave=sin(waterPosition.z*53.0+waterPosition.x*31.0+waterPhase)*.5+.5;
        float crossWave=sin(waterPosition.z*103.0-waterPosition.x*19.0)*.5+.5;
        // Beer-Lambert-like falloff hides the bottom of immersed timber in
        // turbid water; the upper contact remains connected to the dry leg.
        gl_FragColor.a*=exp(min(0.0,waterPosition.y)*18.0)*(.65+.35*wave)*(.82+.18*crossWave);
        #include <dithering_fragment>`);
    };
    return m;
  }
  function waterCopy(group,reflection) {
    const copy=group.clone(true);
    copy.traverse(o=>{if(!o.isMesh)return;
      // Only timber that actually crosses y=0 needs an underwater pass.
      if(!reflection&&!/solid leg|kickstand|front.*leg|rear.*leg/i.test(o.name)){o.visible=false;return;}
      o.material=Array.isArray(o.material)?o.material.map(m=>waterMaterial(m,reflection)):waterMaterial(o.material,reflection);
      o.castShadow=false;o.receiveShadow=false;o.renderOrder=reflection?0:1;
    });
    if(reflection){copy.scale.y=-1;copy.position.y=-group.position.y;}
    scene.add(copy);effects.push(copy);return copy;
  }
  function contactRipples(model) {
    // The ring is ON the same y=0 water plane as the leg crossing, not a screen sticker.
    const contacts=model.waterContacts||[[-.4,0,0],[.4,0,0],[0,0,-.65]];
    const group=new THREE.Group();
    for(const point of contacts){
      const rippleGeometry=new THREE.PlaneGeometry(.48,.48);contactGeometries.add(rippleGeometry);
      const ring=new THREE.Mesh(rippleGeometry,new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,side:THREE.DoubleSide,
        uniforms:{phase:uniforms.phase},
        vertexShader:`varying vec2 contactUV;void main(){contactUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader:`varying vec2 contactUV;uniform float phase;
          void main(){vec2 q=(contactUV-.5)*2.0;float r=length(q);
          float angle=atan(q.y,q.x);float wobble=sin(angle*5.0+phase)*.012;
          float meniscus=exp(-pow((r-.15-wobble)/.032,2.0));
          float wave=exp(-pow((r-.40-wobble)/.026,2.0))*.34+exp(-pow((r-.72+wobble)/.032,2.0))*.15;
          float broken=.6+.4*sin(angle*3.0+phase*.4);
          float alpha=(meniscus*.28+wave*.35)*broken*(1.0-smoothstep(.8,1.0,r));
          gl_FragColor=vec4(mix(vec3(.16,.25,.27),vec3(.63,.76,.78),step(meniscus,wave)),alpha);
          #include <colorspace_fragment>
          }`
      }));
      ring.rotation.x=-Math.PI/2;ring.position.set(point.x??point[0],.002,point.z??point[2]);
      ring.renderOrder=3;group.add(ring);
    }
    group.position.copy(model.group.position);group.rotation.copy(model.group.rotation);scene.add(group);effects.push(group);return group;
  }
  Promise.all([image('/media/underpier-photograph.jpg'),image('/media/easel-composition-reference.jpg'),...slots.map(s=>image(s.src))]).then(([source,wood,...images])=>{
    if(disposed)return;
    environment=createPhotographicEnvironment({THREE,scene,sourceImage:source});
    slots.forEach((slot,index)=>{
      const m=createPhysicalEasel({THREE,slot,image:images[index],woodImage:wood,index});
      m.group.position.set(slot.side==='left'?-ROW_OFFSET:ROW_OFFSET,0,-DEPTHS[slot.depth]);
      m.group.rotation.y=slot.side==='left'?.22:-.22;
      m.group.traverse(o=>{if(o.isMesh){for(const material of Array.isArray(o.material)?o.material:[o.material]){material.clippingPlanes=[surface];wetTimber(material);if(/canvas|photographic/i.test(material.name))o.layers.enable(1);}}});
      scene.add(m.group);m.group.updateMatrixWorld(true);
      m.waterContacts.forEach((point,contactIndex)=>{
        const world=point.clone().applyMatrix4(m.group.matrixWorld);
        reflectionContacts[index*3+contactIndex].set(world.x,world.z);
      });
      const submerged=waterCopy(m.group,false),ripples=contactRipples(m);
      models.push({...m,slot,submerged,ripples,imageSize:[images[index].naturalWidth,images[index].naturalHeight]});
    });
    Promise.all(models.map(m=>m.ready)).then(()=>{if(!disposed){diagnostics.ready=true;onReady?.();}}).catch(e=>{diagnostics.error=e.message;renderer.domElement.hidden=true;onReady?.();});
  }).catch(e=>{diagnostics.error=e.message;renderer.domElement.hidden=true;onReady?.();});

  // The generated video has no validated 3D camera solve. Its measured 2D
  // groups contain severe shear and discontinuities; do not drive a camera
  // from those per-frame fits. A bounded authored dolly is deterministic in
  // both directions, while this separate mode remains explicitly approximate.
  const videoDistance=committed=>committed.progress*TRAVEL;
  function render({width,height,progress,committed,reduced,time=0,look=0}) {
    if(!diagnostics.ready)return null;
    const key=width+'x'+height;
    if(key!==size){size=key;renderer.setPixelRatio(Math.min(devicePixelRatio||1,width<600?1.5:2));renderer.setSize(width,height,false);reflectionTarget.setSize(Math.min(1024,width),Math.round(Math.min(1024,width)*height/width));water.material.uniforms.reflectionTexel.value.set(1/reflectionTarget.width,1/reflectionTarget.height);}
    cameraDistance=committed?videoDistance(committed):progress*TRAVEL;
    environment.update({camera,width,height,distance:cameraDistance,enabled:!committed,time,reduced,lookYaw:look*LOOK_ANGLE});
    uniforms.phase.value=reduced?0:time*.8;
    const projected=models.map(m=>{
      const distance=DEPTHS[m.slot.depth]-cameraDistance;
      const passed=distance<.55;
      m.group.visible=!passed;m.submerged.visible=!passed;m.ripples.visible=!passed;
      const quad=m.localCorners.map(v=>{
        const p=Array.isArray(v)?new THREE.Vector3(...v):v.clone();m.group.localToWorld(p);p.project(camera);
        return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};
      });
      const uv=m.printMesh.geometry.attributes.uv;
      const frontUV=Array.from({length:4},(_,i)=>[uv.getX(16+i),uv.getY(16+i)]);
      const vertices=m.printMesh.geometry.attributes.position;
      const frontVertices=Array.from({length:4},(_,i)=>[vertices.getX(16+i),vertices.getY(16+i),vertices.getZ(16+i)]);
      return {id:m.slot.id,quad,passed,distance,physical:m.dimensions,source:m.imageSize,
        frontUV,frontVertices,meshScale:m.printMesh.scale.toArray(),groupScale:m.group.scale.toArray(),waterPlaneY:0};
    });
    reflectionCamera.copy(camera);reflectionCamera.position.y=-camera.position.y;
    const direction=camera.getWorldDirection(new THREE.Vector3());direction.y*=-1;
    reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(reflectionCamera.position.clone().add(direction));
    reflectionCamera.updateMatrixWorld(true);
    textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
    textureMatrix.multiply(reflectionCamera.projectionMatrix).multiply(reflectionCamera.matrixWorldInverse);
    water.visible=false;environment.group.visible=false;models.forEach(m=>{m.submerged.visible=false;m.ripples.visible=false;});
    renderer.setRenderTarget(reflectionTarget);renderer.clear();const reflectedStats=renderLitScene(reflectionCamera);
    const reflectionCalls=reflectedStats.calls;
    water.visible=true;environment.group.visible=!committed;models.forEach(m=>{m.submerged.visible=m.group.visible;m.ripples.visible=m.group.visible;});
    renderer.setRenderTarget(null);const frameStats=renderLitScene(camera);
    diagnostics.calls=frameStats.calls;diagnostics.triangles=frameStats.triangles;
    diagnostics.reflectionCalls=reflectionCalls;diagnostics.water='single y=0 projective planar reflection with wave distortion; submerged timber pass';
    diagnostics.cameraDistance=cameraDistance;diagnostics.projection='fixed physical geometry, single perspective camera';
    diagnostics.videoCamera=committed?'authored preview dolly; unregistered generated footage':null;
    diagnostics.lookYaw=camera.rotation.y;diagnostics.waterPhase=uniforms.phase.value;
    diagnostics.environment=environment.getState();
    diagnostics.printInvariants=projected.map(({id,physical,source,frontUV,frontVertices,meshScale,groupScale})=>({id,physical,source,frontUV,frontVertices,meshScale,groupScale}));
    return projected;
  }
  function destroy(){disposed=true;environment?.dispose();models.forEach(m=>m.dispose?.());effects.forEach(g=>g.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}));contactGeometries.forEach(g=>g.dispose());reflectionTarget.dispose();water.geometry.dispose();water.material.dispose();renderer.dispose();renderer.domElement.remove();}
  return {get ready(){return diagnostics.ready;},getState:()=>({...diagnostics}),render,destroy};
}
