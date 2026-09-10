// Metres. Fixed-size canvases retain clear reading intervals between pairs.
export const DEPTHS=Object.freeze([0,3.2,4.95,6.7,8.45,10.2]);
export const TRAVEL=7;
export const ROW_OFFSET=1.3;
export const LOOK_ANGLE=.39;
export const ROW_YAW=.10;
export const PHONE_PITCH=-8*Math.PI/180;
// Authored metric scale; source intrinsics/pitch and entrance projection stay fixed.
export const PIER_SCENE_SCALE=1.772646110625515;
export const ROW_X=Object.freeze([
 Object.freeze([0,0]),Object.freeze([-1.3,1.3]),Object.freeze([-1.3,1.3]),
 Object.freeze([-1.3,1.3]),Object.freeze([-1.3,1.3]),Object.freeze([-.9,.9]),
]);
export const FOCUS_STOPS=Object.freeze([0,.2,.4,.6,.8]);
export function galleryRowX(slot){return ROW_X[slot.depth]?.[slot.side==='left'?0:1]??(slot.side==='left'?-ROW_OFFSET:ROW_OFFSET);}
// Progress, forward metres, phone yaw. Reading spans retain slight forward
// motion; the bridges do most of the travel. No timers or stationary intervals.
// Both directions evaluate the same path, including after a viewport resize.
const PATH_KEYS=Object.freeze([
 [0,0,.39],[.035,.045,.39],[.10,.09,-.39],[.14,.135,-.39],
 [.2,1.75,.39],[.235,1.795,.39],[.30,1.84,-.39],[.34,1.885,-.39],
 [.4,3.5,.39],[.435,3.545,.39],[.50,3.59,-.39],[.54,3.635,-.39],
 [.6,5.25,.39],[.635,5.295,.39],[.70,5.34,-.39],[.74,5.385,-.39],
 [.8,6.85,.27],[.835,6.895,.27],[.90,6.94,-.25],[.94,6.985,-.25],
 [1,7,-.25],
].map(Object.freeze));
const smoothstep=t=>t*t*(3-2*t);
function pathValue(progress,column){
 const p=Math.max(0,Math.min(1,progress));
 let i=0;while(i<PATH_KEYS.length-2&&p>PATH_KEYS[i+1][0])i++;
 const a=PATH_KEYS[i],b=PATH_KEYS[i+1];
 const t=Math.max(0,Math.min(1,(p-a[0])/(b[0]-a[0])));
 return a[column]+(b[column]-a[column])*smoothstep(t);
}
export function galleryDistance(progress){return pathValue(progress,1);}
export function galleryAutoYaw(progress){return pathValue(progress,2);}
// Manual side views retain the current pair through its reading spans. Targets
// interpolate only on a bridge, so a menu override never snaps to a new row.
export function galleryLookYaw(progress,look){
 const p=Math.max(0,Math.min(1,progress));
 const row=Math.min(4,Math.floor(p/.2));
 const next=Math.min(4,row+1);
 const t=smoothstep(Math.max(0,Math.min(1,(p-FOCUS_STOPS[row]-.14)/.06)));
 const lerp=(a,b)=>a+(b-a)*t;
 const distance=Math.max(.55,lerp(DEPTHS[row+1],DEPTHS[next+1])-galleryDistance(p));
 const x=lerp(ROW_X[row+1][look>=0?0:1],ROW_X[next+1][look>=0?0:1]);
 const yaw=Math.max(-LOOK_ANGLE,Math.min(LOOK_ANGLE,Math.atan2(-x,distance)));
 return Math.min(1,Math.abs(look))*yaw;
}
