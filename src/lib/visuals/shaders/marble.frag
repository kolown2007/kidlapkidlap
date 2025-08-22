precision highp float;

varying vec2 vUV;

// Uniforms (edit these from TS or adapt names):
// - iTime: seconds (animation)
// - iResolution: vec2(pixelWidth, pixelHeight)
// - iMouse: optional vec2 mouse coords (not used heavily here)
uniform float iTime;
uniform vec2 iResolution;
uniform vec2 iMouse;

// -----------------------------
// Helper: pseudo-random hash
// -----------------------------
// Returns a deterministic pseudo-random float in [0,1) for a given input.
// Tweak: change the constant multiplier to alter noise character (rarely needed).
float hash(float n) { return fract(sin(n) * 43758.5453123); }


// -----------------------------
// 2D value noise (grid-based)
// -----------------------------
// Inputs: x is 2D sample position.
// Steps:
//  - split into integer cell `p` and fractional `f`.
//  - apply a smoothstep-like curve to `f` for interpolation ease (f = f*f*(3-2f)).
//  - compute a cell index `n` and mix the 4 corner hashes using bilinear interpolation.
// Tweak points:
//  - Change the lattice offset multiplier (57.0) to use a different cell hashing scheme.
//  - Replace with a different hash/noise if you want smoother derivatives (Perlin, Simplex).
float noise(in vec2 x) {
  vec2 p = floor(x);
  vec2 f = fract(x);
  // fade curve (smoothstep-like) for smoother interpolation
  f = f*f*(3.0-2.0*f);
  float n = p.x + p.y*57.0;
  float res = mix(mix(hash(n+0.0), hash(n+1.0), f.x), mix(hash(n+57.0), hash(n+58.0), f.x), f.y);
  return res;
}


// -----------------------------
// fbm: fractional Brownian motion (layered noise)
// -----------------------------
// Produces fractal noise by summing multiple octaves of `noise`.
// Tweak points:
//  - Number of octaves (loop count) controls detail vs cost. Increase for more detail.
//  - Initial amplitude (a) and frequency multiplier (p *= 2.0) control roughness.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5; // amplitude for the first octave
  // Loop count = octave count. Edit 5 -> 6/7 for more detail (more GPU work).
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;    // frequency multiplier per octave
    a *= 0.5;    // amplitude falloff per octave
  }
  return v;
}


// -----------------------------
// main(): assemble the marble pattern
// -----------------------------
// Key editable knobs (quick list):
//  - uv scale factors (uv * 3.0 / 6.0 / 4.0) control vein frequency/scale
//  - time multipliers (iTime * 0.2, t*1.2) control animation speed
//  - sinus frequency (10.0) controls how tight the vein stripes are
//  - warp strength (warp*0.2) controls how distorted veins become
//  - smoothstep thresholds (-0.6, 0.6) control contrast of veins
//  - base / veinColor define marble colors
void main() {
  vec2 uv = vUV;
  // center the UVs around (0,0) and correct for aspect ratio so marble looks consistent
  uv -= 0.5;
  uv.x *= iResolution.x / iResolution.y;

  // base veins - two fbm layers combined to create larger and smaller features
  float t = iTime * 0.2;                         // overall time scale (slower motion)
  float q = fbm(uv * 3.0 + vec2(0.0, t));       // low-frequency structure
  float r = fbm(uv * 6.0 + vec2(5.2, t * 1.2)); // higher-frequency detail
  // `veins` creates stripe-like bands; tweak `10.0` to change stripe density
  float veins = sin((uv.y + q * 0.5 + r * 0.25) * 10.0);

  // perturb for organic look: warp stripes by additional fbm
  float warp = fbm(uv * 4.0 + veins);
  // mix the original stripes with warped stripes; 0.6 is blend amount, warp*0.2 is warp strength
  float marble = mix(veins, veins + warp * 0.2, 0.6);
  // smoothstep sharpens / thresholds the result into clear veins; adjust the range for contrast
  marble = smoothstep(-0.6, 0.6, marble);

  // colorization - 3-color gradient (pink -> light blue -> orange)
  // marble is in [0,1] after smoothstep; split into two halves for a 3-way blend
  vec3 c0 = vec3(0.96, 0.50, 0.70); // pink
  vec3 c1 = vec3(0.50, 0.80, 0.95); // light blue
  vec3 c2 = vec3(1.00, 0.67, 0.30); // orange
  vec3 color;
  if (marble < 0.5) {
    float u = smoothstep(0.0, 0.5, marble) * 2.0; // 0..1 over first half
    color = mix(c0, c1, u);
  } else {
    float u = smoothstep(0.5, 1.0, marble) * 2.0; // 0..1 over second half
    color = mix(c1, c2, u);
  }

  // simple lighting tint using another fbm layer (adds subtle shading)
  float light = 0.5 + 0.5 * fbm(uv * 2.0 + vec2(t));
  color *= 0.6 + 0.6 * light; // overall brightness modulation

  // Output - fully opaque
  gl_FragColor = vec4(color, 1.0);
}
