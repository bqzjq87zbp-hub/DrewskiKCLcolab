/**
 * Original-photo corridor projection. No replacement/generated image pixels.
 * A single photograph cannot recover pier depths or unseen timber surfaces.
 * These ceiling/side/water proxies provide coherent camera-driven parallax,
 * with increasing texture stretch during a long walk; this is not a 3D scan.
 */
export const PHOTO_CALIBRATION = Object.freeze({
  // Visual estimates, not EXIF intrinsics or a solved survey. Keep these in one
  // place so prints, water and the photographed environment share one camera.
  focalRatio: .72, principalX: .525, principalY: .835,
  objectPositionX: .52, objectPositionY: .86,
  cameraHeight: .15, halfWidth: 3.2, ceilingHeight: 4.8,
  farDepth: 120, maximumTravel: 7.5,
});

/** Configure a real perspective lens and the source-image cover crop together. */
export function configurePhotographicCamera({
  THREE, camera, width, height, sourceWidth = 4000, sourceHeight = 2667,
  distance = 0, focalZoom = 1, lookYaw = 0, calibration = PHOTO_CALIBRATION,
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
  camera.rotation.set(0, lookYaw, 0); camera.up.set(0, 1, 0);
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[8] = 1 - 2 * principalX / width;
  camera.projectionMatrix.elements[9] = 2 * principalY / height - 1;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld(true);
  return { focal, principalX, principalY, cover, offsetX, offsetY, distance, focalZoom, lookYaw };
}

/**
 * sourceImage must be decoded. Add the returned group to the same scene as the
 * easels. Call update() before projecting print corners. Hide the group during
 * the easel-only reflection pass, and while the optional video is displayed.
 * The water proxy does not write depth: the owning renderer composites its
 * actual submerged-leg and reflection passes over the photographed water.
 */
export function createPhotographicEnvironment({
  THREE, scene, sourceImage, calibration: overrides = {},
}) {
  if (!sourceImage?.naturalWidth || !sourceImage?.naturalHeight) {
    throw new TypeError('Photographic environment requires a decoded original image');
  }
  const calibration = Object.freeze({ ...PHOTO_CALIBRATION, ...overrides });
  const sourceWidth = sourceImage.naturalWidth, sourceHeight = sourceImage.naturalHeight;
  const referenceCamera = new THREE.PerspectiveCamera();
  configurePhotographicCamera({ THREE, camera: referenceCamera,
    width: sourceWidth, height: sourceHeight, sourceWidth, sourceHeight, calibration });
  const sourceProjection = new THREE.Matrix4().multiplyMatrices(
    referenceCamera.projectionMatrix, referenceCamera.matrixWorldInverse,
  );
  const guardCamera = new THREE.PerspectiveCamera();
  const sourceGuard = .0025; // Includes the maximum animated water displacement.
  let viewProfile = null;
  function sourceBounds(width, height, focalZoom, lookYaw) {
    configurePhotographicCamera({ THREE, camera: guardCamera, width, height,
      sourceWidth, sourceHeight, calibration, focalZoom, lookYaw });
    const corners = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      const ray = new THREE.Vector3(x, y, .5).unproject(guardCamera)
        .sub(guardCamera.position).normalize();
      if (ray.z >= 0) return { inside: false };
      const source = ray.add(referenceCamera.position).project(referenceCamera);
      corners.push([(source.x + 1) / 2, (source.y + 1) / 2]);
    }
    const minU = Math.min(...corners.map(p => p[0])), maxU = Math.max(...corners.map(p => p[0]));
    const minV = Math.min(...corners.map(p => p[1])), maxV = Math.max(...corners.map(p => p[1]));
    return { minU, maxU, minV, maxV,
      inside: minU >= sourceGuard && minV >= sourceGuard
        && maxU <= 1 - sourceGuard && maxV <= 1 - sourceGuard };
  }
  function profileFor(width, height) {
    const key = width + 'x' + height;
    if (viewProfile?.key === key) return viewProfile;
    const sideLookSupported = width < 600 && width < height;
    const maximumYaw = sideLookSupported ? .39 : 0;
    const angles = sideLookSupported ? [-maximumYaw, 0, maximumYaw] : [0];
    const fits = zoom => angles.every(yaw => sourceBounds(width, height, zoom, yaw).inside);
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
    viewProfile = { key, focalZoom: high + .00001, maximumYaw, sideLookSupported };
    return viewProfile;
  }
  const waterReferenceCamera = referenceCamera.clone();
  const waterProjection = sourceProjection.clone();
  const waterPhase = { value: 0 }, waterMotion = { value: 0 };
  const texture = new THREE.Texture(sourceImage);
  texture.name = 'Unchanged original pier photograph, projected on corridor proxies';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4; texture.needsUpdate = true;
  const group = new THREE.Group();
  group.name = 'Photographic pier environment proxies';
  group.userData.isPhotographicEnvironment = true;
  const geometries = [], materials = [];
  function surface(name, points, water = false) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(
      [0, 1, 2, 0, 2, 3].flatMap(i => points[i]), 3,
    ));
    geometry.computeBoundingSphere(); geometries.push(geometry);
    const material = new THREE.ShaderMaterial({
      name: 'Original photograph projective texture', side: THREE.DoubleSide,
      depthTest: true, depthWrite: !water, toneMapped: false,
      defines: { WATER_SURFACE: water ? 1 : 0 },
      uniforms: { sourcePhoto: { value: texture },
        sourceProjection: { value: water ? waterProjection : sourceProjection },
        fixedSourceProjection: { value: sourceProjection },
        waterBounds: { value: new THREE.Vector2(calibration.halfWidth, calibration.farDepth) },
        waterPhase, waterMotion },
      vertexShader: `
        uniform mat4 sourceProjection;
        uniform mat4 fixedSourceProjection;
        varying vec4 sourceClip;
        varying vec4 fixedSourceClip;
        varying vec3 waterWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          waterWorld = world.xyz;
          sourceClip = sourceProjection * world;
          fixedSourceClip = fixedSourceProjection * world;
          gl_Position = projectionMatrix * viewMatrix * world;
        }`,
      fragmentShader: `
        uniform sampler2D sourcePhoto;
        uniform float waterPhase;
        uniform float waterMotion;
        uniform vec2 waterBounds;
        varying vec4 sourceClip;
        varying vec4 fixedSourceClip;
        varying vec3 waterWorld;
        void main() {
          if (sourceClip.w <= 0.0) discard;
          vec2 uv = sourceClip.xy / sourceClip.w * 0.5 + 0.5;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
          #if WATER_SURFACE == 1
            // Side and back proxies use the fixed projector. Meet their exact
            // source sample at the shared floor edge, then restore stabilized
            // moving water over a bounded interior band. This is a color blend,
            // not a change to pier geometry or to the source photograph.
            vec2 fixedUV = fixedSourceClip.xy / fixedSourceClip.w * .5 + .5;
            float distanceToEdge = min(waterBounds.x - abs(waterWorld.x),
              min(-waterWorld.z, waterWorld.z + waterBounds.y));
            // Hold a useful feather width at shallow viewing angles, without
            // taking more than two metres from the foreground-water interior.
            float edgeFeather = clamp(fwidth(distanceToEdge) * 16.0, .65, 2.0);
            float interiorBlend = smoothstep(0.0, edgeFeather, max(0.0, distanceToEdge));
            vec3 fixedColor = texture2D(sourcePhoto, fixedUV).rgb;
            // Source-image Y > .895 is foreground water, below all solid pier
            // feet. Feather to full motion at Y=.935 so no photographed timber
            // or sky wobbles. The photograph remains the water's color source.
            float waterMask = (1.0 - smoothstep(.065, .105, uv.y))
              * waterMotion * interiorBlend;
            float swell = sin(waterWorld.z * 4.8 + waterWorld.x * 2.2 + waterPhase);
            float crossWave = sin(waterWorld.z * 7.2 - waterWorld.x * 1.4 + waterPhase * .73 + 1.7);
            vec2 displacement = vec2(.00145 * swell + .00055 * crossWave,
              .00075 * crossWave) * waterMask;
            vec3 color = texture2D(sourcePhoto,
              clamp(uv + displacement, vec2(.0002), vec2(.9998))).rgb;
            // Small light-catching crests move in world space with the waves;
            // they supplement the real photographed highlights, not an ocean
            // replacement or an animated rectangle laid across the whole view.
            float crest = pow(max(0.0, .5 + .5 * swell), 20.0)
              * (.55 + .45 * crossWave);
            color *= 1.0 + waterMask * swell * .015;
            color += vec3(.70, .86, 1.0) * crest * waterMask * .045;
            gl_FragColor = vec4(mix(fixedColor, color, interiorBlend), 1.0);
          #else
            gl_FragColor = vec4(texture2D(sourcePhoto, uv).rgb, 1.0);
          #endif
          #include <colorspace_fragment>
        }`,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name; mesh.renderOrder = -100;
    mesh.userData.isPhotographicEnvironment = true;
    group.add(mesh);
  }
  const x = calibration.halfWidth, y = calibration.ceilingHeight, z = -calibration.farDepth;
  surface('Photographed water plane y=0', [[-x,0,0],[x,0,0],[x,0,z],[-x,0,z]], true);
  surface('Photographed underside of pier proxy', [[-x,y,0],[-x,y,z],[x,y,z],[x,y,0]]);
  surface('Photographed left pier and sky proxy', [[-x,0,0],[-x,0,z],[-x,y,z],[-x,y,0]]);
  surface('Photographed right pier and sky proxy', [[x,0,0],[x,y,0],[x,y,z],[x,0,z]]);
  surface('Photographed distant vanishing-point closure', [[-x,0,z],[x,0,z],[x,y,z],[-x,y,z]]);
  scene?.add(group);
  let current = null, disposed = false;
  function update({ camera, width, height, distance = 0, enabled = true, time = 0, reduced = false, lookYaw = 0 }) {
    group.visible = Boolean(enabled);
    waterPhase.value = reduced ? 0 : (Number.isFinite(time) ? time : 0) * .8;
    waterMotion.value = reduced ? 0 : 1;
    const boundedDistance = Math.max(0, Math.min(calibration.maximumTravel, distance));
    const profile = profileFor(width, height);
    const boundedYaw = Math.max(-profile.maximumYaw,
      Math.min(profile.maximumYaw, Number.isFinite(lookYaw) ? lookYaw : 0));
    current = configurePhotographicCamera({ THREE, camera, width, height,
      sourceWidth, sourceHeight, calibration, distance: boundedDistance,
      focalZoom: profile.focalZoom, lookYaw: boundedYaw });
    current.sideLookSupported = profile.sideLookSupported;
    current.sourceEnvelope = sourceBounds(width, height, profile.focalZoom, boundedYaw);
    // A low-angle photo contains almost no distant water texels. Reprojecting
    // them over a long dolly turns waves into radial streaks. Keep the wave
    // scale by letting this texture projector follow the camera with a small
    // residual drift; the receiving geometry, contacts and reflections remain
    // on world y=0. This is stabilized water imagery, not measured water flow.
    waterReferenceCamera.position.z = -boundedDistance * .99;
    waterReferenceCamera.updateMatrixWorld(true);
    waterProjection.multiplyMatrices(waterReferenceCamera.projectionMatrix,
      waterReferenceCamera.matrixWorldInverse);
    return current;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; group.removeFromParent(); texture.dispose();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  }
  return {
    group, calibration, update, dispose,
    getState: () => ({
      method: 'Original photograph projected on five camera-shared corridor proxies',
      source: [sourceWidth, sourceHeight], camera: current,
      waterMotion: { enabled: waterMotion.value > 0, phase: waterPhase.value,
        method: 'Bounded foreground-water refraction and world-space moving crests' },
      calibration: 'visual estimate; not a solved physical camera',
      limitations: 'Single-view depth approximation; stabilized photographic water; side structures and long-travel texture stretching need review',
    }),
  };
}
