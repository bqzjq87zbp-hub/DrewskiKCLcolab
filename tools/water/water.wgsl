// Living water for the pier walk. Samples the current committed video frame and
// re-renders it with an animated ripple + shimmer band below the waterline.
// The camera holds a constant height above the water for the whole walk, so one
// normalized waterline works for every frame (measured on frames 0 and 240).
import { simplex2d } from "@vgpu/wgsl-std/noise/simplex";

struct Params {
  time: f32,
  travel: f32,   // smoothed camera walk time (s); scroll streams the water past
  strength: f32,     // ripple refraction amplitude, frame-uv units
  shimmer: f32,      // sparkle gain
  waterline: f32,    // frame-uv y where water begins (top-origin: water is high y)
  feather: f32,      // soft transition height
  coverScale: vec2f, // canvas-uv -> frame-uv cover transform
  coverOffset: vec2f,
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var frameTex: texture_2d<f32>;
@group(0) @binding(2) var frameSamp: sampler;

fn rippleField(p: vec2f, t: f32) -> f32 {
  // Two octaves drifting shoreward at different rates; reads as swell, not noise.
  return simplex2d(p * vec2f(9.0, 26.0) + vec2f(t * 0.18, t * 0.55))
       + 0.5 * simplex2d(p * vec2f(21.0, 60.0) - vec2f(t * 0.31, t * 0.85));
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let fuv = uv * params.coverScale + params.coverOffset;
  let depth = fuv.y - params.waterline;           // >0 inside the water

  // ~83% of fragments are above the waterline and provably passthrough; skip all
  // noise work there. Explicit-LOD sampling keeps WGSL uniformity rules satisfied
  // inside and after this non-uniform branch (one mip level, so output is identical).
  if (depth <= 0.0) {
    return vec4f(textureSampleLevel(frameTex, frameSamp, saturate(fuv), 0.0).rgb, 1.0);
  }

  // Water mask, eased so the nearest water moves the most.
  let band = smoothstep(0.0, params.feather, depth);
  let near = 0.35 + 0.65 * smoothstep(0.0, 1.0 - params.waterline, depth);
  let mask = band * near;

  // Perspective: features get finer toward the waterline, coarser near the camera.
  let persp = mix(3.2, 1.0, smoothstep(0.0, 0.18, depth));

  // Refraction: central-difference gradient of the ripple field bends the sample.
  let e = 0.012;
  // Monotone perspective y: the exact integral of persp over depth (slope == persp
  // everywhere, so it can never fold), with the linear tail past the 0.18 ramp.
  let pt = saturate(depth / 0.18);
  let rpY = 3.2 * min(depth, 0.18) - 0.396 * (pt * pt * pt - 0.5 * pt * pt * pt * pt) + max(depth - 0.18, 0.0);
  let flow = vec2f(0.0, params.travel * 0.18);
  let rp = vec2f(fuv.x * persp, rpY * 4.0) - flow;
  let gx = rippleField(rp + vec2f(e, 0.0), params.time) - rippleField(rp - vec2f(e, 0.0), params.time);
  let gy = rippleField(rp + vec2f(0.0, e), params.time) - rippleField(rp - vec2f(0.0, e), params.time);
  let edgeGuard = saturate(min(fuv, vec2f(1.0) - fuv) / 0.02);
  let offset = vec2f(gx, gy) * params.strength * mask * edgeGuard;

  var color = textureSampleLevel(frameTex, frameSamp, saturate(fuv + offset), 0.0).rgb;

  // Sparkle rides the photograph's own bright crests instead of painting over it:
  // weight by sampled luminance, keep it sparse with a high power.
  let luma = dot(color, vec3f(0.299, 0.587, 0.114));
  let crest = smoothstep(0.42, 0.75, luma);
  let sp = vec2f(fuv.x * persp, rpY * 4.0) - flow * 1.35;   // slightly faster: near-surface parallax
  let s1 = simplex2d(sp * vec2f(46.0, 120.0) + vec2f(params.time * 0.42, -params.time * 0.23));
  let s2 = simplex2d(sp * vec2f(73.0, 190.0) - vec2f(params.time * 0.27, params.time * 0.36));
  let sparkle = pow(saturate(s1 * s2 * 2.4), 5.0) * params.shimmer * mask * (0.25 + 0.75 * crest);
  color += vec3f(1.0, 0.97, 0.88) * sparkle;

  return vec4f(color, 1.0);
}
