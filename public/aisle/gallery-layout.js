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
export const FOCUS_STOPS=Object.freeze([0,.25,.5,.75,1]);
export function galleryRowX(slot){return ROW_X[slot.depth]?.[slot.side==='left'?0:1]??(slot.side==='left'?-ROW_OFFSET:ROW_OFFSET);}
// Native scroll maps directly to forward distance. Equal scroll distances
// produce equal travel in either direction, with no reading pauses or yaw tour.
export function galleryDistance(progress){return TRAVEL*Math.max(0,Math.min(1,progress));}
// Retain the legacy export for cached callers, but never turn from scrolling.
export function galleryAutoYaw(){return 0;}
// Side-looking is explicit and holds its heading while walking. The scenery
// guard still bounds the requested angle to the original photograph's edges.
export function galleryLookYaw(progress,look){return LOOK_ANGLE*Math.max(-1,Math.min(1,look));}
