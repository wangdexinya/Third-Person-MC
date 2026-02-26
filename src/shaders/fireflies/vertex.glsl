// ===== Uniforms =====
uniform float uTime;
uniform float uSize;
uniform float uPixelRatio;

// ===== Attributes =====
attribute float aRandom;

// ===== Varyings =====
varying float vRandom;

// ===== Helper Functions =====

// Pseudo-random hash for varied motion per particle
float hash(float n) {
  return fract(sin(n) * 43758.5453);
}

void main() {
  // Pass random seed to fragment shader
  vRandom = aRandom;

  // ----- Aimless wandering via layered sine waves -----
  // Each axis uses different frequencies/phases seeded by aRandom
  float seed = aRandom * 6.2831;
  float t = uTime;

  vec3 offset = vec3(0.0);

  // Layer 1: slow wide drift
  offset.x += sin(t * 0.3 + seed) * 2.0;
  offset.y += sin(t * 0.2 + seed * 1.3) * 1.5;
  offset.z += cos(t * 0.25 + seed * 0.7) * 2.0;

  // Layer 2: medium wobble
  offset.x += cos(t * 0.7 + seed * 2.1) * 0.8;
  offset.y += sin(t * 0.5 + seed * 1.7) * 0.6;
  offset.z += sin(t * 0.6 + seed * 2.5) * 0.8;

  // Layer 3: tiny jitter (makes it feel alive)
  offset.x += sin(t * 2.3 + seed * 4.1) * 0.15;
  offset.y += cos(t * 1.9 + seed * 3.3) * 0.10;
  offset.z += sin(t * 2.1 + seed * 5.0) * 0.15;

  // Apply offset to base position
  vec3 pos = position + offset;

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);

  // Size: world-space uSize projected to screen pixels
  // Dividing by -mvPosition.z gives perspective scaling
  gl_PointSize = uSize * uPixelRatio * (300.0 / -mvPosition.z);

  // Clamp minimum size so distant fireflies remain visible
  gl_PointSize = max(gl_PointSize, 1.5);

  gl_Position = projectionMatrix * mvPosition;
}
