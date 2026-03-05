uniform vec3 uColor;
uniform float uOpacity;
uniform float uThickness;
varying vec2 vUv;

void main() {
  float edgeX = min(vUv.x, 1.0 - vUv.x);
  float edgeY = min(vUv.y, 1.0 - vUv.y);
  
  if (edgeX < uThickness || edgeY < uThickness) {
    gl_FragColor = vec4(uColor, uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  } else {
    discard;
  }
}
