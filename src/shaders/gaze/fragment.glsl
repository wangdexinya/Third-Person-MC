uniform sampler2D tDiffuse;
uniform float uTime;
uniform float uIntensity; // 0.0 to 1.0 (0 = safe, 1 = death)

varying vec2 vUv;

// Simple noise function
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    // Optimization: Early out if intensity is extremely low
    if (uIntensity < 0.005) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
    }

    // 1. Distance from center for Vignette and Aberration strength
    vec2 centerUv = vUv - 0.5;
    float distSq = dot(centerUv, centerUv); // Faster than length()
    float dist = sqrt(distSq);

    // 2. Chromatic Aberration (RGB Split)
    // Only apply split towards edges, scaling with intensity
    float splitAmount = uIntensity * 0.05 * dist; 
    vec2 offset = normalize(centerUv) * splitAmount;
    
    float r = texture2D(tDiffuse, vUv + offset).r;
    float g = texture2D(tDiffuse, vUv).g;
    float b = texture2D(tDiffuse, vUv - offset).b;
    vec3 baseColor = vec3(r, g, b);

    // 3. Pulsing Blood Vignette
    // Pulse frequency increases with intensity
    float pulse = sin(uTime * (3.0 + uIntensity * 10.0)) * 0.5 + 0.5; 
    // Base vignette shape
    float vignette = smoothstep(0.8 - uIntensity * 0.5, 1.2, dist * 2.0); 
    
    vec3 bloodColor = vec3(0.6, 0.0, 0.0);
    // Combine vignette with pulse and intensity
    float bloodMix = vignette * uIntensity * (0.6 + 0.4 * pulse);

    // 4. Noise in the dark areas
    float noise = hash(vUv + uTime * 0.1) * 0.1 * vignette * uIntensity;

    // Final Mix
    vec3 finalColor = mix(baseColor, bloodColor, bloodMix) - noise;

    gl_FragColor = vec4(finalColor, 1.0);
}
