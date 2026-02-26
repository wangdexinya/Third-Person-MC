// ===== Uniforms =====
uniform float uTime;
uniform float uOpacity;

// ===== Varyings =====
varying float vRandom;

// ===== Helper Functions =====

// Smoothstep-based ease in-out for breathing animation
float breathe(float t) {
  // Map t to [0, 1] triangle wave: rises 0→1 then falls 1→0
  float tri = 1.0 - abs(2.0 * fract(t) - 1.0);
  // Apply smoothstep for ease-in-out
  return tri * tri * (3.0 - 2.0 * tri);
}

void main() {
  // ----- Square pixel particle (no circle clipping) -----
  // gl_PointCoord is already the square UV of the point sprite

  // ----- Breathing color animation -----
  // Each firefly has its own phase offset from aRandom
  float breathSpeed = 0.4;
  float phase = vRandom * 6.2831; // unique phase per particle
  float breathT = breathe(uTime * breathSpeed + phase);

  // Color: #000000 -> #aaf644 -> #000000
  vec3 glowColor = vec3(0.667, 0.965, 0.267); // #aaf644 in linear-ish
  vec3 color = glowColor * breathT;

  // ----- Soft glow: brightest at center, fades at edges -----
  vec2 center = gl_PointCoord - 0.5;
  float dist = max(abs(center.x), abs(center.y)); // Chebyshev distance (square shape)
  float glow = 1.0 - smoothstep(0.25, 0.5, dist);

  // Final alpha: glow shape * breath brightness * night opacity
  float alpha = glow * breathT * uOpacity;

  // Discard fully transparent fragments
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(color, alpha);

  // Three.js color space correction
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
