precision highp float;

// Attributes
attribute vec3 position;
attribute vec2 uv;

// Uniforms
uniform mat4 worldViewProjection;
uniform float time;
uniform float amplitude;
uniform float frequency;
uniform float speed;

// Varying
varying vec2 vUV;

void main(void) {
  // compute simple wave along Y using X coordinate (object space)
  vec3 pos = position;
  float wave = sin(position.x * frequency + time * speed) * amplitude;
  pos.y += wave;
  gl_Position = worldViewProjection * vec4(pos, 1.0);
  vUV = uv;
}
