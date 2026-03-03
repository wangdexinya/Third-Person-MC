# Enemy System & Gaze Shader Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a centralized EnemyManager for zombie lifecycle (night spawning, distance despawning) and a high-performance "Gaze" Post-Processing Shader to simulate the dread of being chased.

**Architecture:** 
1. `EnemyManager`: A central class that listens to environment time, spawns zombies within a "sweet spot" radius during the night, and aggressively despawns zombies that are too far or when daylight breaks.
2. `GazePass`: A custom Three.js ShaderPass added to `EffectComposer`. It uses distance-based intensity to render a pulsing blood vignette, RGB chromatic aberration, and noise. It employs aggressive early-outs to ensure zero performance cost when the player is safe.

**Tech Stack:** Three.js, EffectComposer, GLSL (vite-plugin-glsl), JavaScript

---

### Task 1: Create Gaze Shader Files

**Files:**
- Create: `src/shaders/gaze/vertex.glsl`
- Create: `src/shaders/gaze/fragment.glsl`

**Step 1: Write Vertex Shader**
Create the vertex shader that passes `uv` coordinates to the fragment shader.

```glsl
// src/shaders/gaze/vertex.glsl
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

**Step 2: Write Fragment Shader with performance optimizations**
Implement the pulsing vignette, RGB split, and noise. Use `uIntensity` as the master control and add an early return for zero-cost when inactive.

```glsl
// src/shaders/gaze/fragment.glsl
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
```

**Step 3: Commit**
```bash
git add src/shaders/gaze/vertex.glsl src/shaders/gaze/fragment.glsl
git commit -m "feat(shader): add gaze post-processing shader for dread effect"
```

---

### Task 2: Integrate GazePass into Renderer

**Files:**
- Modify: `src/js/renderer.js`

**Step 1: Import Shaders**
At the top of `src/js/renderer.js`:
```javascript
import gazeVertexShader from '../shaders/gaze/vertex.glsl'
import gazeFragmentShader from '../shaders/gaze/fragment.glsl'
```

**Step 2: Add Config and ShaderPass**
In `constructor` postProcessConfig:
```javascript
      // 凝视恐惧参数
      gaze: {
        enabled: true,
        intensity: 0.0, // 由 EnemyManager 控制
      },
```

In `setPostProcess` (after SpeedLinePass):
```javascript
    // GazePass - 被追逐时的凝视恐惧效果
    this.gazePass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uIntensity: { value: this.postProcessConfig.gaze.intensity },
      },
      vertexShader: gazeVertexShader,
      fragmentShader: gazeFragmentShader,
    })
    this.gazePass.enabled = this.postProcessConfig.gaze.enabled
    this.composer.addPass(this.gazePass)
```

**Step 3: Update uTime and Listen for Intensity Events**
In the `constructor()` or a setup method, listen for the event:
```javascript
import emitter from './utils/event/event-bus.js'

// ... in constructor or setup function:
emitter.on('gaze:intensity-changed', (intensity) => {
  this.postProcessConfig.gaze.intensity = intensity
  if (this.gazePass) {
    this.gazePass.uniforms.uIntensity.value = intensity
  }
})
```

In the `update()` method:
```javascript
    this.gazePass.uniforms.uTime.value = this.experience.time.elapsed * 0.001
    // 性能优化：只有当强度大于0时才启用该 Pass
    this.gazePass.enabled = this.postProcessConfig.gaze.enabled && this.gazePass.uniforms.uIntensity.value > 0.005
```

**Step 4: Add Debug UI**
In `debugInit()`:
```javascript
    // ===== 凝视恐惧控制 =====
    const gazeFolder = postProcessFolder.addFolder({
      title: 'Gaze 凝视恐惧',
      expanded: true,
    })
    gazeFolder.addBinding(this.postProcessConfig.gaze, 'enabled', { label: '启用' }).on('change', ev => this.gazePass.enabled = ev.value && this.gazePass.uniforms.uIntensity.value > 0.005)
    gazeFolder.addBinding(this.postProcessConfig.gaze, 'intensity', { label: '当前强度', min: 0, max: 1, step: 0.01 }).on('change', ev => this.gazePass.uniforms.uIntensity.value = ev.value)
```

**Step 5: Commit**
```bash
git add src/js/renderer.js
git commit -m "feat(renderer): integrate GazePass into post-processing pipeline"
```

---

### Task 3: Implement EnemyManager

**Files:**
- Create: `src/js/world/enemies/enemy-manager.js`

**Step 1: Create the basic class structure**
```javascript
// src/js/world/enemies/enemy-manager.js
import * as THREE from 'three'
import Experience from '../../experience.js'
import Zombie, { ZombieState } from './zombie.js'

export default class EnemyManager {
  constructor() {
    this.experience = new Experience()
    this.world = this.experience.world
    this.time = this.experience.time
    this.player = this.world?.player
    
    this.activeEnemies = []
    
    this.config = {
      maxZombies: 5,
      spawnInterval: 5.0, // seconds
      spawnRadiusMin: 25,
      spawnRadiusMax: 45,
      despawnRadius: 60,
    }
    
    this.spawnTimer = 0
    this.gazeIntensity = 0 // Lerped value
    this.targetGazeIntensity = 0
  }

  update() {
    const dt = this.time.delta * 0.001
    if (!this.player) {
      this.player = this.experience.world?.player
      return
    }

    this._handleSpawningAndDespawning(dt)
    this._updateEnemiesAndCalculateGaze()
    this._updateGazeShader(dt)
  }

  _handleSpawningAndDespawning(dt) {
    const playerPos = this.player.movement.position
    // TODO: Connect to Environment time later. Assume night for now.
    const isNight = true; 

    // Despawn check
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const zombie = this.activeEnemies[i]
      const dist = zombie.movement.position.distanceTo(playerPos)
      
      if (!isNight || dist > this.config.despawnRadius) {
        zombie.destroy()
        this.activeEnemies.splice(i, 1)
      }
    }

    // Spawn check
    if (isNight && this.activeEnemies.length < this.config.maxZombies) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.config.spawnInterval
        this._attemptSpawn(playerPos)
      }
    }
  }

  _attemptSpawn(playerPos) {
    const angle = Math.random() * Math.PI * 2
    const radius = this.config.spawnRadiusMin + Math.random() * (this.config.spawnRadiusMax - this.config.spawnRadiusMin)
    
    const spawnX = playerPos.x + Math.cos(angle) * radius
    const spawnZ = playerPos.z + Math.sin(angle) * radius

    const zombie = new Zombie()
    zombie.setSafeSpawn(spawnX, spawnZ)
    this.activeEnemies.push(zombie)
  }

  _updateEnemiesAndCalculateGaze() {
    let maxThreat = 0

    for (const zombie of this.activeEnemies) {
      zombie.update()
      
      // Calculate threat for Gaze effect
      if (zombie.state === ZombieState.CHASE || zombie.state === ZombieState.ATTACK) {
        const dist = zombie.movement.position.distanceTo(this.player.movement.position)
        // Threat formula: 1.0 at 3 blocks, 0.0 at 20 blocks
        let threat = 1.0 - ((dist - 3.0) / 17.0)
        threat = THREE.MathUtils.clamp(threat, 0.0, 1.0)
        if (threat > maxThreat) {
          maxThreat = threat
        }
      }
    }

    this.targetGazeIntensity = maxThreat
  }

  _updateGazeShader(dt) {
    // Smooth Lerp for visual stability
    const newIntensity = THREE.MathUtils.lerp(this.gazeIntensity, this.targetGazeIntensity, dt * 5.0)
    
    // Only emit if value has changed significantly to avoid spamming
    if (Math.abs(newIntensity - this.gazeIntensity) > 0.001) {
       this.gazeIntensity = newIntensity
       // 解耦：通过事件总线通知 renderer 更新 Shader 强度
       // Note: make sure to import emitter from '../../utils/event/event-bus.js'
       import('../../utils/event/event-bus.js').then(module => {
           module.default.emit('gaze:intensity-changed', this.gazeIntensity)
       })
    }
  }

  destroy() {
    for (const zombie of this.activeEnemies) {
      zombie.destroy()
    }
    this.activeEnemies = []
  }
}
```

**Step 2: Commit**
```bash
git add src/js/world/enemies/enemy-manager.js
git commit -m "feat(enemies): add EnemyManager for distance-based spawning and despawning"
```

---

### Task 4: Hook EnemyManager into World

**Files:**
- Modify: `src/js/world/world.js`

**Step 1: Replace hardcoded Zombie with EnemyManager**
Import EnemyManager:
```javascript
// Remove: import Zombie from './enemies/zombie.js'
import EnemyManager from './enemies/enemy-manager.js'
```

In `_initEnemies()`:
```javascript
  _initEnemies() {
    this.enemyManager = new EnemyManager()
  }
```

In `update()`:
```javascript
    // Remove: if (this.zombie) this.zombie.update()
    if (this.enemyManager)
      this.enemyManager.update()
```

In `destroy()`:
```javascript
    // Remove: this.zombie?.destroy()
    this.enemyManager?.destroy()
```

**Step 2: Remove old Zombie reference from world**
Check that `this.zombie` is no longer used in `world.js`.

**Step 3: Commit**
```bash
git add src/js/world/world.js
git commit -m "refactor(world): replace static zombie with dynamic EnemyManager"
```
