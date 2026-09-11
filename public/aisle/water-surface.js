// Shared phase and world-space wave directions for photographic water and
// the reflection on the physical y=0 surface. No camera or timber animation.
export const WATER_WAVES_GLSL=`
float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float waterNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),mix(waterHash(i+vec2(0,1)),waterHash(i+vec2(1,1)),f.x),f.y);}
vec4 waterWaves(vec2 p,float phase){
  float broad=waterNoise(p*1.8+vec2(phase*.035,-phase*.055));
  float detail=waterNoise(p*vec2(3.2,7.5)+vec2(-phase*.06,phase*.08));
  float wave=sin(p.y*4.8+p.x*2.2+phase+(broad-.5)*1.4);
  float crossWave=sin(p.y*7.2-p.x*1.4+phase*.73+1.7+(detail-.5)*1.1);
  return vec4(wave,crossWave,broad,detail);
}`;
