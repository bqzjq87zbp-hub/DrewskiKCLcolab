// Metres. Room for each rear leg; the final pair remains four metres ahead at
// the last stop, after the preceding pair has left the camera's near region.
export const DEPTHS=Object.freeze([0,4,5.3,6.6,7.9,11.5]);
export const TRAVEL=7.5;
export const ROW_OFFSET=1.8;
export const LOOK_ANGLE=.39;
export const FOCUS_STOPS=Object.freeze(DEPTHS.slice(1).map(depth=>(depth-4)/TRAVEL));
