precision highp float;

// Attributes
attribute vec3 position;
attribute vec2 uv;

// Uniforms
uniform mat4 worldViewProjection;
uniform float iTime; // exposed in case subtle vertex-based motion is desired

// Varyings
varying vec2 vUV;

void main(void) {
  vUV = uv;
  // keep vertex simple - passthrough. iTime available for subtle effects if needed.
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
