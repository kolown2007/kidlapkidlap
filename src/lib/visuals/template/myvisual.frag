precision highp float;

varying vec2 vUV;
uniform float iTime;
uniform vec2 iResolution;

void main() {
  vec2 uv = vUV - 0.5;
  float t = iTime * 0.5;
  vec3 col = vec3(0.2 + 0.8 * abs(sin(t + uv.x*10.0)), 0.1, 0.3);
  gl_FragColor = vec4(col, 1.0);
}
