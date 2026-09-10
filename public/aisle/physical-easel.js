/**
 * Metre-scale easel, authored and rendered in Blender 5.2.1.
 * Exported timber/hardware geometry is shared; photographs remain independent.
 * See assets/PROVENANCE.md for online timber licenses and reproduction commands.
 */
import { easelParts, easelAssetInfo } from './assets/easel-geometry.js';

const assetCache = new WeakMap();
function acquireAssets(THREE) {
  let asset=assetCache.get(THREE);
  if (!asset) {
    const textures=[], pending=[];
    function map(file, color=false) {
      let resolve, reject;
      pending.push(new Promise((yes,no)=>{resolve=yes;reject=no;}));
      const texture=new THREE.TextureLoader().load(new URL('./assets/'+file,import.meta.url).href, resolve, undefined, reject);
      texture.name='CC0 Poly Haven Coated Pine '+file;
      texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.flipY=false; texture.anisotropy=8;
      textures.push(texture); return texture;
    }
    const woodMap=map('coated_pine_diff_1k.jpg',true);
    const woodNormal=map('coated_pine_nor_gl_1k.jpg');
    const woodRough=map('coated_pine_rough_1k.jpg');
    const geometries=easelParts.map(part=>{
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(part.position,3));
      geometry.setAttribute('normal',new THREE.BufferAttribute(part.normal,3));
      geometry.setAttribute('uv',new THREE.BufferAttribute(part.uv,2));
      geometry.setIndex(new THREE.BufferAttribute(part.indices,1));
      geometry.computeBoundingSphere(); geometry.computeBoundingBox();
      return geometry;
    });
    asset={textures,woodMap,woodNormal,woodRough,geometries,count:0,ready:Promise.all(pending)};
    assetCache.set(THREE,asset);
  }
  asset.count++;
  return {...asset,release() {
    if (--asset.count===0) {
      asset.textures.forEach(t=>t.dispose());asset.geometries.forEach(g=>g.dispose());assetCache.delete(THREE);
    }
  }};
}

// A tiny repeatable warp/weft height field. Its period is set in metres below;
// ordinary mip filtering removes unresolvable weave rather than shimmering it.
function canvasWeave(THREE,width,height) {
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*4,v=y/size*4;
    const a=Math.pow(Math.cos(u*Math.PI),4),b=Math.pow(Math.cos(v*Math.PI),4);
    const over=((Math.floor(u)+Math.floor(v))&1)?a*.7+b*.3:a*.3+b*.7;
    const value=Math.round(128+over*74);
    const at=(y*size+x)*4;data[at]=data[at+1]=data[at+2]=value;data[at+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.name='Woven cotton - 0.9 mm thread pitch';
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(width/.0036,height/.0036);
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.anisotropy=8;texture.needsUpdate=true;
  return texture;
}

export function createPhysicalEasel({ THREE, slot = {}, image, woodImage, sourceSize, index = 0 }) {
  if (!THREE?.Mesh || !image?.naturalWidth || !image?.naturalHeight) {
    throw new TypeError('createPhysicalEasel requires THREE and a decoded print image');
  }
  const group=new THREE.Group();
  group.name=`physical-easel-${slot.id??index}`;
  group.userData={slotId:slot.id??String(index),category:slot.category??null,asset:easelAssetInfo};
  const geometries=new Set(),materials=new Set(),asset=acquireAssets(THREE);
  const ownGeometry=g=>(geometries.add(g),g);
  const ownMaterial=m=>(materials.add(m),m);
  const timberFront=ownMaterial(new THREE.MeshStandardMaterial({
    name:'Blender timber - CC0 Coated Pine',map:asset.woodMap,normalMap:asset.woodNormal,
    normalScale:new THREE.Vector2(.20,.20),roughnessMap:asset.woodRough,
    roughness:.94,metalness:0,envMapIntensity:.35,color:0xe8dfcb
  }));
  const hardware=ownMaterial(new THREE.MeshStandardMaterial({
    name:'Machined steel hardware',color:0x777a77,roughness:.45,metalness:.72
  }));
  const brass=ownMaterial(new THREE.MeshStandardMaterial({
    name:'Aged brass washers and hinges',color:0x9a805c,roughness:.48,metalness:.66
  }));
  const dark=ownMaterial(new THREE.MeshStandardMaterial({
    name:'Recessed joint details',color:0x202423,roughness:.76,metalness:.20
  }));
  const materialMap={timber:timberFront,hardware,brass,dark_details:dark};
  const nativeWidth=sourceSize?.width||image.naturalWidth,nativeHeight=sourceSize?.height||image.naturalHeight;
  const metrePerPixel=1.05/Math.max(nativeWidth,nativeHeight);
  const printWidth=nativeWidth*metrePerPixel,printHeight=nativeHeight*metrePerPixel;
  const printBottom=.90,printTop=printBottom+printHeight,canvasDepth=.038;
  const printBackZ=.033,printFrontZ=printBackZ+canvasDepth;
  const footHalfSpan=.43,mastTop=Math.max(1.87,printTop+.23);
  const woodSample=Object.freeze({source:'Poly Haven Coated Pine',license:'CC0',physicalTileMetres:.7});
  easelParts.forEach((part,i)=>{
    const mesh=new THREE.Mesh(asset.geometries[i],materialMap[part.material]);
    mesh.name=part.role==='body'&&part.material==='timber'?'Blender front solid legs, rear kickstand and frame':`Blender ${part.role} ${part.material}`;
    mesh.userData={blenderParts:part.parts,partRole:part.role};
    mesh.position.y=part.role==='shelf'?printBottom:part.role==='clamp'?printTop:0;
    if(part.role==='mast'){mesh.scale.y=(mastTop-.35)/(2.20-.35);mesh.position.y=.35*(1-mesh.scale.y);}
    mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  });
  const weave=canvasWeave(THREE,printWidth,printHeight);

  const photoTexture = new THREE.Texture(image);
  photoTexture.name = `Uncropped photograph ${slot.id ?? index}`;
  photoTexture.colorSpace = THREE.SRGBColorSpace;
  photoTexture.wrapS = photoTexture.wrapT = THREE.ClampToEdgeWrapping;
  photoTexture.anisotropy = 4; photoTexture.needsUpdate = true;
  const frontMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    name: 'Full-frame woven photographic canvas', color: 0xffffff, map: photoTexture,
    roughness: .88, metalness: 0, bumpMap: weave, bumpScale: .42, envMapIntensity: .16,
  }));
  const edgeMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    name: 'Narrow actual-image canvas wrap', color: 0xffffff, map: photoTexture,
    roughness: .90, metalness: 0, envMapIntensity: .14, bumpMap: weave, bumpScale: .48,
  }));
  const backMaterial = ownMaterial(new THREE.MeshStandardMaterial({
    name: 'Unprinted canvas back', color: 0xcdcfd0, roughness: .96, metalness: 0,
  }));
  const printGeometry = ownGeometry(new THREE.BoxGeometry(printWidth, printHeight, canvasDepth));
  const position = printGeometry.attributes.position, uv = printGeometry.attributes.uv;
  const stripU = Math.min(.065, canvasDepth / printWidth), stripV = Math.min(.065, canvasDepth / printHeight);
  // BoxGeometry groups: +X, -X, +Y, -Y, +Z, -Z, four distinct vertices each.
  for (let i = 0; i < position.count; i++) {
    const face = Math.floor(i / 4), u = position.getX(i) / printWidth + .5;
    const t = position.getY(i) / printHeight + .5;
    const awayFromFace = (.5 * canvasDepth - position.getZ(i)) / canvasDepth;
    if (face === 0) uv.setXY(i, 1 - stripU * awayFromFace, t);
    else if (face === 1) uv.setXY(i, stripU * awayFromFace, t);
    else if (face === 2) uv.setXY(i, u, 1 - stripV * awayFromFace);
    else if (face === 3) uv.setXY(i, u, stripV * awayFromFace);
    // Keep BoxGeometry's exact 0/1 front UVs (no float-position renormalization).
    // The unprinted back keeps its original UVs too.
  }
  uv.needsUpdate = true;
  const printMesh = new THREE.Mesh(printGeometry, [edgeMaterial, edgeMaterial, edgeMaterial, edgeMaterial, frontMaterial, backMaterial]);
  printMesh.name = `Uncropped print · ${slot.id ?? index}`;
  printMesh.position.set(0, printBottom + printHeight / 2, printBackZ + canvasDepth / 2);
  printMesh.castShadow = printMesh.receiveShadow = true;
  printMesh.userData = { slot, index, isPhotograph: true };
  group.add(printMesh);

  // The full photo remains the immutable +Z face (vertices 16..19). A separate
  // rolled shell carries the image wrap, so edge construction never crops it.
  printGeometry.clearGroups();
  printGeometry.addGroup(24,6,4);
  const radius=.0013;
  const outline=new THREE.Shape();
  outline.moveTo(-printWidth/2,-printHeight/2);
  outline.lineTo(printWidth/2,-printHeight/2);
  outline.lineTo(printWidth/2,printHeight/2);
  outline.lineTo(-printWidth/2,printHeight/2);
  outline.closePath();
  const wrapGeometry=ownGeometry(new THREE.ExtrudeGeometry(outline,{
    depth:canvasDepth-radius*2,steps:1,bevelEnabled:true,
    bevelThickness:radius,bevelSize:radius,bevelSegments:3,curveSegments:1
  }));
  wrapGeometry.translate(0,0,-canvasDepth/2+radius);
  const wrapPos=wrapGeometry.attributes.position,wrapUV=wrapGeometry.attributes.uv;
  for(let i=0;i<wrapPos.count;i++){
    const x=wrapPos.getX(i),y=wrapPos.getY(i),z=wrapPos.getZ(i);
    const away=THREE.MathUtils.clamp((canvasDepth/2-z)/canvasDepth,0,1);
    let u=THREE.MathUtils.clamp(x/printWidth+.5,0,1);
    let v=THREE.MathUtils.clamp(y/printHeight+.5,0,1);
    if(Math.abs(x)/printWidth>Math.abs(y)/printHeight)
      u=x>0?1-stripU*away:stripU*away;
    else v=y>0?1-stripV*away:stripV*away;
    wrapUV.setXY(i,u,v);
  }
  wrapUV.needsUpdate=true;
  const sideGroups=wrapGeometry.groups.filter(g=>g.materialIndex===1);
  wrapGeometry.clearGroups();
  const sideIndices=[];sideGroups.forEach(g=>{for(let i=g.start;i<g.start+g.count;i++)sideIndices.push(i);});
  wrapGeometry.setIndex(sideIndices);
  const shell=new THREE.Mesh(wrapGeometry,edgeMaterial);
  shell.name='Rolled woven canvas sides - 38 mm depth, 1.3 mm edge radius';
  shell.position.copy(printMesh.position);shell.castShadow=shell.receiveShadow=true;group.add(shell);

  // Real recessed rear construction: four stretcher bars, folded cloth and
  // staples. Geometry is batched by material to keep repeated displays light.
  function boxesGeometry(boxes, woodUV=false) {
    const p=[],n=[],u=[],indices=[];
    for(const box of boxes){
      const [w,h,d,x,y,z]=box,g=new THREE.BoxGeometry(w,h,d);
      const gp=g.attributes.position,gn=g.attributes.normal,gu=g.attributes.uv,offset=p.length/3;
      for(let i=0;i<gp.count;i++){
        p.push(gp.getX(i)+x,gp.getY(i)+y,gp.getZ(i)+z);
        n.push(gn.getX(i),gn.getY(i),gn.getZ(i));
        u.push(woodUV?(w>h?(gp.getX(i)+x):gp.getY(i)+y)/.7:gu.getX(i),
          woodUV?(w>h?gp.getY(i):gp.getX(i))/.7+.34:gu.getY(i));
      }
      for(const i of g.index.array)indices.push(i+offset);
      g.dispose();
    }
    const g=ownGeometry(new THREE.BufferGeometry());
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));
    g.setIndex(indices);return g;
  }
  const centreY=printBottom+printHeight/2,bar=.038;
  const rearWoodBoxes=[
    [printWidth,bar,.027,0,printTop-bar/2,printBackZ+.0135],
    [printWidth,bar,.027,0,printBottom+bar/2,printBackZ+.0135],
    [bar,printHeight-bar*2,.027,-printWidth/2+bar/2,centreY,printBackZ+.0135],
    [bar,printHeight-bar*2,.027,printWidth/2-bar/2,centreY,printBackZ+.0135]
  ];
  const rearFrame=new THREE.Mesh(boxesGeometry(rearWoodBoxes,true),timberFront);
  rearFrame.name='Four visible rear wooden stretcher bars';
  rearFrame.castShadow=rearFrame.receiveShadow=true;group.add(rearFrame);
  const cloth=ownMaterial(new THREE.MeshStandardMaterial({
    name:'Unprinted cotton rear and folded selvedge',color:0xc9c2af,roughness:.96,metalness:0,
    bumpMap:weave,bumpScale:.35,side:THREE.DoubleSide
  }));
  const reverse=new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(printWidth-bar*2,printHeight-bar*2)),cloth);
  reverse.name='Recessed opaque canvas reverse';reverse.position.set(0,centreY,printFrontZ-.003);
  reverse.rotation.y=Math.PI;reverse.receiveShadow=true;group.add(reverse);
  const fold=.023;
  const folds=[
    [printWidth,fold,.0018,0,printTop-fold/2,printBackZ-.0009],
    [printWidth,fold,.0018,0,printBottom+fold/2,printBackZ-.0009],
    [fold,printHeight-fold*2,.0018,-printWidth/2+fold/2,centreY,printBackZ-.0009],
    [fold,printHeight-fold*2,.0018,printWidth/2-fold/2,centreY,printBackZ-.0009]
  ];
  // The extra corner layers are folded cloth thickness, not a drawn mark.
  for(const sx of [-1,1])for(const sy of [-1,1])
    folds.push([fold*.9,fold*1.2,.001,sx*(printWidth/2-fold*.52),centreY+sy*(printHeight/2-fold*.65),printBackZ-.002]);
  const folded=new THREE.Mesh(boxesGeometry(folds),cloth);folded.name='Folded rear canvas with doubled corners';group.add(folded);
  const stapleBoxes=[];
  for(const sy of [-1,1])for(let x=-printWidth/2+.06;x<printWidth/2-.04;x+=.11)
    stapleBoxes.push([.009,.0011,.0013,x,centreY+sy*(printHeight/2-.012),printBackZ-.0028]);
  for(const sx of [-1,1])for(let y=printBottom+.06;y<printTop-.04;y+=.11)
    stapleBoxes.push([.0011,.009,.0013,sx*(printWidth/2-.012),y,printBackZ-.0028]);
  const staples=new THREE.Mesh(boxesGeometry(stapleBoxes),hardware);staples.name='Rear canvas staple crowns';group.add(staples);


  const localCorners = Object.freeze([
    new THREE.Vector3(-printWidth / 2, printTop, printFrontZ),
    new THREE.Vector3(printWidth / 2, printTop, printFrontZ),
    new THREE.Vector3(printWidth / 2, printBottom, printFrontZ),
    new THREE.Vector3(-printWidth / 2, printBottom, printFrontZ),
  ]);
  const dimensions = Object.freeze({
    units: 'metres', width: printWidth, height: printHeight, depth: canvasDepth,
    printWidth, printHeight, canvasDepth, printBottom, printTop, printFrontZ,
    longEdge: 1.05, nativeWidth, nativeHeight, timberWidth: .056, timberDepth: .052,
    footBottom: -.10, footSpan: 2 * footHalfSpan + .056, rearDepth: .714, mastTop,
  });
  // Group-local centre-line intersections of the actual adjusted solid legs
  // with y=0; parent transforms these centres for contact ripples/reflections.
  const waterContacts = Object.freeze([
    new THREE.Vector3(-.41537,0,.08246),
    new THREE.Vector3(.41537,0,.08246),
    new THREE.Vector3(0,0,-.65920),
  ]);
  let disposed = false;
  function dispose() {
    if (disposed) return; disposed = true;
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    photoTexture.dispose(); weave.dispose(); asset.release();
  }
  return {
    group, printMesh, corners: localCorners, localCorners, dimensions, woodSample, waterContacts, ready: asset.ready,
    getWorldCorners() { group.updateWorldMatrix(true, false); return localCorners.map(p => p.clone().applyMatrix4(group.matrixWorld)); },
    dispose,
  };
}
