import {WATER_WAVES_GLSL} from './water-surface.js';

/**
 * Continuous original-photograph scenery behind a physical gallery.
 * One finite-depth photographic surface keeps recorded posts, barnacles and
 * surf connected during a guided walk. Hidden pier depths are not reconstructed.
 */
export const PHOTO_CALIBRATION = Object.freeze({
  // Conditional source directions and authored metric height; not a survey.
  focalRatio: 2035.5912627203365 / 4000, principalX: .5, principalY: .5,
  objectPositionX: .52, objectPositionY: .86,
  cameraHeight: .15,
  farDepth: 120, maximumTravel: 7.5,
});

/** Configure a real perspective lens and the source-image cover crop together. */
export function configurePhotographicCamera({
  THREE, camera, width, height, sourceWidth = 4000, sourceHeight = 2667,
  distance = 0, focalZoom = 1, lookYaw = 0, viewPitchOffset = 0, calibration = PHOTO_CALIBRATION,
}) {
  if (!(width > 0 && height > 0 && sourceWidth > 0 && sourceHeight > 0)) {
    throw new TypeError('Photographic camera requires positive source and viewport dimensions');
  }
  const cover = Math.max(width / sourceWidth, height / sourceHeight);
  const focal = sourceWidth * calibration.focalRatio * cover * focalZoom;
  const offsetX = (width - sourceWidth * cover) * calibration.objectPositionX;
  const offsetY = (height - sourceHeight * cover) * calibration.objectPositionY;
  const principalX = sourceWidth * calibration.principalX * cover + offsetX;
  const principalY = sourceHeight * calibration.principalY * cover + offsetY;
  camera.aspect = width / height;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * focal)));
  camera.near = .04; camera.far = calibration.farDepth + 20;
  camera.position.set(0, calibration.cameraHeight, -distance);
  // Conditional single-view fit: square-pixel centered lens,
  // approximately orthogonal deck/upright directions. Not EXIF/survey data.
  const r = [
    [.9999543155771464, .008915187487212442, -.003447635524336695],
    [.006689924278027343, -.9103656352231642, -.41375071615391695],
    [-.006827274111611309, .4137087497706481, -.9103836876237471],
  ];
  const orientation = new THREE.Matrix4().set(
    r[0][0], -r[1][0], -r[2][0], 0,
    r[0][1], -r[1][1], -r[2][1], 0,
    r[0][2], -r[1][2], -r[2][2], 0,
    0, 0, 0, 1,
  );
  camera.quaternion.setFromRotationMatrix(orientation);
  // Viewing direction may move independently of the fixed source projector.
  camera.rotateX(viewPitchOffset);
  camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0), lookYaw));
  camera.up.set(0, 1, 0);
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[8] = 1 - 2 * principalX / width;
  camera.projectionMatrix.elements[9] = 2 * principalY / height - 1;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld(true);
  return { focal, principalX, principalY, cover, offsetX, offsetY, distance, focalZoom, lookYaw, viewPitchOffset };
}

export function createPhotographicEnvironment({
  THREE, scene, sourceImage, calibration: overrides = {},
}) {
  if (!sourceImage?.naturalWidth || !sourceImage?.naturalHeight) {
    throw new TypeError('Photographic environment requires a decoded original image');
  }
  const scale=Number(overrides.pierScale)||1.772646110625515;
  const backdropDepth=80;
  const calibration=Object.freeze({...PHOTO_CALIBRATION,...overrides,
    cameraHeight:PHOTO_CALIBRATION.cameraHeight*scale,authoredPierScale:scale});
  const sourceWidth = sourceImage.naturalWidth, sourceHeight = sourceImage.naturalHeight;
  const referenceCamera = new THREE.PerspectiveCamera();
  configurePhotographicCamera({ THREE, camera: referenceCamera,
    width: sourceWidth, height: sourceHeight, sourceWidth, sourceHeight, calibration });
  const sourceProjection = new THREE.Matrix4().multiplyMatrices(
    referenceCamera.projectionMatrix, referenceCamera.matrixWorldInverse,
  );
  const backdropNormal=referenceCamera.getWorldDirection(new THREE.Vector3());
  const backdropCenter=referenceCamera.position.clone().addScaledVector(backdropNormal,backdropDepth);
  const guardCamera = new THREE.PerspectiveCamera();
  const sourceGuard = .0025; // Includes the maximum animated water displacement.
  let viewProfile = null;
  function sourceBounds(width, height, focalZoom, lookYaw, viewPitchOffset = 0, distance = 0) {
    configurePhotographicCamera({ THREE, camera: guardCamera, width, height,
      sourceWidth, sourceHeight, calibration, focalZoom, lookYaw, viewPitchOffset, distance });
    const corners = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const ray = new THREE.Vector3(x, y, .5).unproject(guardCamera)
        .sub(guardCamera.position).normalize();
      if (ray.z >= 0) return { inside: false };
      let sample;
      {
        const denominator=ray.dot(backdropNormal);
        if(denominator<=0)return {inside:false};
        const depth=backdropCenter.clone().sub(guardCamera.position).dot(backdropNormal)/denominator;
        if(depth<=0)return {inside:false};
        sample=guardCamera.position.clone().addScaledVector(ray,depth);
      }
      const source = sample.project(referenceCamera);
      corners.push([(source.x + 1) / 2, (source.y + 1) / 2]);
    }
    const minU = Math.min(...corners.map(p => p[0])), maxU = Math.max(...corners.map(p => p[0]));
    const minV = Math.min(...corners.map(p => p[1])), maxV = Math.max(...corners.map(p => p[1]));
    return { minU, maxU, minV, maxV,
      inside: minU >= sourceGuard && minV >= sourceGuard
        && maxU <= 1 - sourceGuard && maxV <= 1 - sourceGuard };
  }
  function profileFor(width, height, viewPitchOffset = 0) {
    const key = width + 'x' + height + ':' + viewPitchOffset;
    if (viewProfile?.key === key) return viewProfile;
    const sideLookSupported = width < 600 && width < height;
    const maximumYaw = sideLookSupported ? .39 : 0;
    const angles = sideLookSupported ? [-maximumYaw, 0, maximumYaw] : [0];
    const fits = zoom => angles.every(yaw => [0,calibration.maximumTravel].every(distance=>sourceBounds(width, height, zoom, yaw, viewPitchOffset,distance).inside));
    let low = 1, high = 1;
    while (!fits(high) && high < 8) high *= 2;
    if (!fits(high)) throw new RangeError('Viewport cannot fit the source photograph');
    for (let i = 0; i < 24; i++) {
      const middle = (low + high) / 2;
      if (fits(middle)) high = middle; else low = middle;
    }
    // Reserve both side views at once. Turning changes yaw, never print scale
    // or lens magnification. Desktop already displays the source's full width
    // and therefore supports Ahead only, including after a portrait resize.
    viewProfile = { key, focalZoom: high + .00001, maximumYaw, sideLookSupported, viewPitchOffset };
    return viewProfile;
  }
  const waterPhase={value:0},waterMotion={value:0};
  const photoCameraPosition={value:referenceCamera.position.clone()};
  const reflectionMaskUniforms={photoCameraPosition,photoPlaneCenter:{value:backdropCenter},
    photoPlaneNormal:{value:backdropNormal},photoSourceProjection:{value:sourceProjection}};
  const texture=new THREE.Texture(sourceImage);texture.name='Unchanged original pier photograph';
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.anisotropy=4;texture.needsUpdate=true;
  const group=new THREE.Group();group.name='Continuous photographic surroundings';
  group.userData.isPhotographicEnvironment=true;
  const geometries=[],materials=[];
    // One fixed UV image keeps photographed timber, surf and contact contours
    // connected. Its finite authored depth gives gentle whole-image perspective;
    // it does not pretend to recover the photograph's hidden structural depth.
    const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{
      const ray=new THREE.Vector3(x,y,.5).unproject(referenceCamera).sub(referenceCamera.position).normalize();
      return referenceCamera.position.clone().addScaledVector(ray,backdropDepth/ray.dot(backdropNormal));
    });
    const indices=[0,1,2,0,2,3],uvs=[[0,0],[1,0],[1,1],[0,1]],geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(indices.flatMap(i=>points[i].toArray()),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(indices.flatMap(i=>uvs[i]),2));
    geometry.computeBoundingSphere();geometries.push(geometry);
    const material=new THREE.ShaderMaterial({name:'Continuous original photograph with foreground-water motion',depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,
      uniforms:{sourcePhoto:{value:texture},waterPhase,waterMotion,photoCameraPosition},
      vertexShader:`varying vec2 photoUV;varying vec3 photoWorld;void main(){photoUV=uv;photoWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D sourcePhoto;uniform float waterPhase;uniform float waterMotion;uniform vec3 photoCameraPosition;varying vec2 photoUV;varying vec3 photoWorld;
      ${WATER_WAVES_GLSL}
      void main(){
        vec2 uv=photoUV;
        float waterMask=(1.0-smoothstep(.065,.105,uv.y))*waterMotion;
        vec3 direction=photoWorld-photoCameraPosition;
        float travel=-photoCameraPosition.y/min(-.0001,direction.y);
        vec2 surfacePoint=(photoCameraPosition+direction*travel).xz;
        vec4 waves=waterWaves(surfacePoint,waterPhase);
        float swell=waves.x,crossWave=waves.y;
        waterMask*=step(direction.y,-.0001);
        vec2 offset=vec2(.00145*swell+.00055*crossWave,.00075*crossWave)*waterMask;
        vec3 color=texture2D(sourcePhoto,clamp(uv+offset,vec2(.0002),vec2(.9998))).rgb;
        float crest=pow(max(0.0,.5+.5*swell),20.0)*(.55+.45*crossWave);
        color*=1.0+waterMask*swell*.015;
        color+=vec3(.70,.86,1.0)*crest*waterMask*.045;
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }`,
    });materials.push(material);
    const backdrop=new THREE.Mesh(geometry,material);backdrop.name='Continuous original photograph at authored finite depth';backdrop.renderOrder=-1000;backdrop.frustumCulled=false;group.add(backdrop);
  scene?.add(group);
  let current=null,disposed=false;
  function setReflectionPass(enabled){group.visible=!enabled;}
  function update({ camera, width, height, distance = 0, enabled = true, time = 0, reduced = false, lookYaw = 0, viewPitchOffset = 0 }) {
    group.visible = Boolean(enabled);
    waterPhase.value = reduced ? 0 : (Number.isFinite(time) ? time : 0) * .8;
    waterMotion.value = reduced ? 0 : 1;
    const boundedDistance = Math.max(0, Math.min(calibration.maximumTravel, distance));
    const boundedPitch = Math.max(-.35,Math.min(.35,Number.isFinite(viewPitchOffset)?viewPitchOffset:0));
    const profile = profileFor(width, height, boundedPitch);
    const boundedYaw = Math.max(-profile.maximumYaw,
      Math.min(profile.maximumYaw, Number.isFinite(lookYaw) ? lookYaw : 0));
    current = configurePhotographicCamera({ THREE, camera, width, height,
      sourceWidth, sourceHeight, calibration, distance: boundedDistance,
      focalZoom: profile.focalZoom, lookYaw: boundedYaw, viewPitchOffset: boundedPitch });
    current.sideLookSupported = profile.sideLookSupported;
    current.sourceEnvelope = sourceBounds(width, height, profile.focalZoom, boundedYaw, boundedPitch, boundedDistance);
    photoCameraPosition.value.copy(camera.position);
    return current;
  }
  function dispose(){if(disposed)return;disposed=true;group.removeFromParent();texture.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  return {group,calibration,update,dispose,setReflectionPass,reflectionMaskUniforms,ready:Promise.resolve(),
    getState:()=>({method:'Continuous original photograph at finite authored depth',source:[sourceWidth,sourceHeight],camera:current,
      backdropDepth,continuous:true,
      waterMotion:{enabled:waterMotion.value>0,phase:waterPhase.value,method:'Original foreground-water pixels and shared world-space wave phases; real y=0 easel reflections'},
      calibration:'Conditional source directions; authored gallery height and scenic depth',
      limitations:'Guided photographic scenery with shallow whole-image parallax, not reconstructed pier geometry or measured depth'})};
}
