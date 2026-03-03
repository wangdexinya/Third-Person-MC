# Enemy System (Zombie) Implementation Plan [FIXED VERSION]

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Note:** This is a FIXED version of the original plan with critical bugs corrected.

**Goal:** Implement a simple zombie enemy system using a directional tracking algorithm with obstacle jumping, reusing the existing `steve.glb` model and player collision logic.

**Architecture:** We will create a `Zombie` entity class which is similar to `Player`. It will use an `EntityCollisionSystem` (abstracted from `PlayerCollisionSystem`), a `ZombieMovementController` (which computes direction towards the player, manages aggro/attack ranges, and jumps over obstacles), and a `ZombieAnimationController` (reusing Steve's animations for Idle, Run, and Attack).

**Tech Stack:** Three.js, Vite, Vue (Game UI), custom voxel collision system.

---

## Critical Fixes from Original Plan

| Issue | Original Plan | Fixed Version |
|-------|--------------|---------------|
| Import paths | Did not specify updating import path in player-movement-controller.js | **Fixed:** Explicitly shows changing from `./player-collision.js` to `../entity-collision.js` |
| World.js integration | Only described verbally, no code provided | **Fixed:** Complete code for `_initEnemies()`, `update()`, and `destroy()` |
| Jump logic | Used Raycaster that was never actually used | **Fixed:** Simple position-based block check without unused Raycaster |
| Terrain access | Direct access without fallback | **Fixed:** Uses fallback pattern `this.experience.terrainDataManager \|\| this.terrainProvider` |
| Attack cooldown | Missing - zombie would attack every frame | **Fixed:** Added `attackCooldown` system |
| Safe spawn | Hardcoded (10, 80, 10) could spawn in air/blocks | **Fixed:** Added `setSafeSpawn()` using `getTopSolidYWorld()` |
| Block coordinates | Passed floats to `getBlockWorld` | **Fixed:** Added `Math.floor()` for integer block coordinates |
| Cleanup | Missing destroy methods | **Fixed:** Complete cleanup in Zombie.destroy() and World.destroy() |

---

### Pre-Task: Verify Steve Model Animations

Before implementing, verify the Steve model has the required animations:

**Check:**
```javascript
// In browser console after game loads
console.log(experience.resources.items.steveModel.animations.map(a => a.name))
// Expected: animations containing 'idle', 'run', 'punch' or similar
```

**If animations don't exist:** The plan assumes Steve model has animations. If not present, you may need to use a different model or create simple procedural animations.

---

### Task 1: Add Zombie Resource

**Files:**
- Modify: `src/js/sources.js`

**Step 1: Add zombieModel to sources**
```javascript
// Add to the exported array in src/js/sources.js (after playerModel)
  {
    name: 'zombieModel',
    type: 'gltfModel',
    path: 'models/character/steve.glb', // Temporarily using steve model
  },
```

**Step 2: Commit**
```bash
git add src/js/sources.js
git commit -m "feat(resources): add zombieModel resource temporarily using steve.glb"
```

---

### Task 2: Abstract PlayerCollisionSystem to EntityCollisionSystem

**Files:**
- Create: `src/js/world/entity-collision.js` (from `src/js/world/player/player-collision.js`)
- Modify: `src/js/world/player/player-movement-controller.js`

**Step 1: Copy and rename the file and class**
```bash
# Copy the file to new location
cp src/js/world/player/player-collision.js src/js/world/entity-collision.js
```

In `src/js/world/entity-collision.js`:
- Change `class PlayerCollisionSystem` to `class EntityCollisionSystem`
- Update comment on line 6: Change "玩家胶囊体" to "实体胶囊体"
- Update comment on line 58: Change "玩家状态" to "实体状态"
- Update comment on line 143: Change "玩家状态" to "实体状态"

**Step 2: Update PlayerMovementController imports (CRITICAL FIX)**
```javascript
// TO:
import EntityCollisionSystem from '../entity-collision.js'
// src/js/world/player/player-movement-controller.js
// Line 5: Change FROM:
import PlayerCollisionSystem from './player-collision.js'

// Line 29: Change FROM:
this.collision = new PlayerCollisionSystem()
// TO:
this.collision = new EntityCollisionSystem()
```

**Step 3: Delete old file**
```bash
rm src/js/world/player/player-collision.js
```

**Step 4: Test to ensure player still collides correctly**
(Run the dev server and verify player collision still works - walk around, jump, check no console errors.)

**Step 5: Commit**
```bash
git add src/js/world/entity-collision.js src/js/world/player/player-movement-controller.js
git commit -m "refactor(physics): abstract PlayerCollisionSystem to EntityCollisionSystem for reuse"
```

---

### Task 3: Create Zombie Base Class

**Files:**
- Create: `src/js/world/enemies/zombie.js`
- Modify: `src/js/world/world.js`

**Step 1: Create the directory and Zombie class**
```bash
mkdir -p src/js/world/enemies
```

```javascript
// src/js/world/enemies/zombie.js
import * as THREE from 'three'
import Experience from '../../experience.js'

export const ZombieState = {
  IDLE: 'idle',
  CHASE: 'chase',
  ATTACK: 'attack'
}

export default class Zombie {
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.resources = this.experience.resources
    this.player = this.experience.world.player

    this.resource = this.resources.items.zombieModel
    this.state = ZombieState.IDLE
    this.setModel()
  }

  setModel() {
    // Clone the scene to allow multiple zombies
    this.model = this.resource.scene.clone()
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.material = child.material.clone() // Clone materials to prevent shared color bugs later
      }
    })

    // Create a group to handle positioning
    this.group = new THREE.Group()
    this.group.add(this.model)
    this.scene.add(this.group)

    // Set initial position (will be overridden by safe spawn later)
    this.group.position.set(10, 80, 10) // Temporary spawn point
  }

  update() {
    // To be implemented in next tasks
  }

  destroy() {
    // Cleanup resources
    if (this.group) {
      this.scene.remove(this.group)
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m?.dispose())
          }
          else {
            child.material?.dispose()
          }
        }
      })
    }
  }
}
```

**Step 2: Integrate Zombie into World (with proper lifecycle)**

In `src/js/world/world.js`, make these changes:

**A. Add to constructor's `core:ready` handler (after _initPlayerAndCamera):**
```javascript
emitter.on('core:ready', () => {
  this._initTerrain()
  this._initPlayerAndCamera()
  this._initEnemies() // ADD THIS LINE
  this._initEnvironment()
  this._initBlockInteraction()
  this._initEffects()
  this._setupSettingsListeners()
})
```

**B. Add new method `_initEnemies`:**
```javascript
import Zombie from './enemies/zombie.js'

// ... in class ...

/** 敌人系统初始化 */
_initEnemies() {
  this.zombie = new Zombie()
}
```

**C. Add to `update()` method (after player update):**
```javascript
update() {
  // ... existing updates ...
  if (this.player)
    this.player.update()

  if (this.zombie) // ADD THESE 2 LINES
    this.zombie.update()

  if (this.environment)
    this.environment.update()
  // ... rest of updates ...
}
```

**D. Add to `destroy()` method (at the end):**
```javascript
destroy() {
  // ... existing cleanup ...
  this.zombie?.destroy() // ADD THIS LINE

  // Clear terrainDataManager reference
  if (this.experience.terrainDataManager === this.chunkManager) {
    this.experience.terrainDataManager = null
  }
}
```

**Step 3: Commit**
```bash
git add src/js/world/enemies/zombie.js src/js/world/world.js
git commit -m "feat(enemies): add base Zombie class and integrate into World lifecycle"
```

---

### Task 4: Implement ZombieMovementController (Distance & States)

**Files:**
- Create: `src/js/world/enemies/zombie-movement-controller.js`
- Modify: `src/js/world/enemies/zombie.js`

**Step 1: Create the controller logic with aggro and attack ranges**

The zombie will start chasing if the player is within 20 blocks. It will stop and attack if within 1.5 blocks. If the player runs away further than 25 blocks, it returns to IDLE.

```javascript
// src/js/world/enemies/zombie-movement-controller.js
import * as THREE from 'three'
import Experience from '../../experience.js'
import EntityCollisionSystem from '../entity-collision.js'
import { ZombieState } from './zombie.js'

export class ZombieMovementController {
  constructor(zombieGroup) {
    this.experience = new Experience()
    this.group = zombieGroup

    this.speed = 3.5
    this.gravity = -9.81
    this.worldVelocity = new THREE.Vector3()
    this.position = this.group.position
    this.isGrounded = false

    this.capsule = {
      radius: 0.3,
      halfHeight: 0.55,
      offset: new THREE.Vector3(0, 0.85, 0),
    }

    this.collision = new EntityCollisionSystem()

    // Cache terrain provider reference (may be undefined initially)
    this.terrainProvider = this.experience.terrainDataManager

    // Distances
    this.AGGRO_RANGE = 20.0
    this.LOSE_AGGRO_RANGE = 25.0
    this.ATTACK_RANGE = 1.5

    // Attack cooldown to prevent spam
    this.attackCooldown = 0
    this.ATTACK_COOLDOWN_TIME = 1.0 // 1 second between attacks
  }

  update(playerPos, currentState) {
    const dt = this.experience.time.delta * 0.001
    this.collision.prepareFrame()

    // Update attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= dt
    }

    // 1. Calculate direction and distance to player
    const direction = new THREE.Vector3().subVectors(playerPos, this.position)
    direction.y = 0 // Ignore height for horizontal movement
    const distanceToPlayer = direction.length()

    let newState = currentState

    // 2. Determine State based on distance
    if (currentState === ZombieState.IDLE) {
      if (distanceToPlayer <= this.AGGRO_RANGE) {
        newState = ZombieState.CHASE
      }
    }
    else if (currentState === ZombieState.CHASE || currentState === ZombieState.ATTACK) {
      if (distanceToPlayer > this.LOSE_AGGRO_RANGE) {
        newState = ZombieState.IDLE
      }
      else if (distanceToPlayer <= this.ATTACK_RANGE && this.attackCooldown <= 0) {
        newState = ZombieState.ATTACK
        this.attackCooldown = this.ATTACK_COOLDOWN_TIME
      }
      else {
        newState = ZombieState.CHASE
      }
    }

    // 3. Apply Velocity based on State
    if (newState === ZombieState.CHASE) {
      direction.normalize()
      this.worldVelocity.x = direction.x * this.speed
      this.worldVelocity.z = direction.z * this.speed

      // Rotate model to face player
      const angle = Math.atan2(direction.x, direction.z)
      this.group.rotation.y = angle
    }
    else {
      // IDLE or ATTACK -> Stop moving
      this.worldVelocity.x = 0
      this.worldVelocity.z = 0

      // Still face the player if attacking
      if (newState === ZombieState.ATTACK && distanceToPlayer > 0) {
        const angle = Math.atan2(direction.x, direction.z)
        this.group.rotation.y = angle
      }
    }

    // 4. Gravity
    this.worldVelocity.y += this.gravity * dt

    // 5. Collision Resolution
    const nextPosition = new THREE.Vector3().copy(this.position).addScaledVector(this.worldVelocity, dt)
    const entityState = {
      basePosition: nextPosition,
      center: nextPosition.clone().add(this.capsule.offset),
      halfHeight: this.capsule.halfHeight,
      radius: this.capsule.radius,
      worldVelocity: this.worldVelocity,
      isGrounded: this.isGrounded,
    }

    // Use fallback pattern for terrain provider (may not be ready at construction time)
    const provider = this.experience.terrainDataManager || this.terrainProvider
    if (provider) {
      const candidates = this.collision.broadPhase(entityState, provider)
      const collisions = this.collision.narrowPhase(candidates, entityState)
      this.collision.resolveCollisions(collisions, entityState)
    }

    this.isGrounded = entityState.isGrounded
    this.position.copy(entityState.basePosition)
    this.worldVelocity.copy(entityState.worldVelocity)

    return newState // Return updated state to Zombie class
  }

  /** Set a safe spawn position on top of terrain */
  setSafeSpawn(x, z) {
    const provider = this.experience.terrainDataManager || this.terrainProvider
    if (provider?.getTopSolidYWorld) {
      const groundY = provider.getTopSolidYWorld(Math.floor(x), Math.floor(z))
      if (groundY !== null) {
        this.position.set(x, groundY + 1.5, z) // Spawn 1.5 blocks above ground
        return
      }
    }
    // Fallback: use provided coordinates with default height
    this.position.set(x, 80, z)
  }
}
```

**Step 2: Update Zombie class to use movement controller**

In `src/js/world/enemies/zombie.js`:

```javascript
import { ZombieMovementController } from './zombie-movement-controller.js'

export default class Zombie {
  constructor() {
    // ... existing constructor code ...

    this.movement = new ZombieMovementController(this.group)

    // Set safe spawn position
    this.movement.setSafeSpawn(10, 10) // Spawn at (10, 10) world coordinates
  }

  update() {
    const playerPos = this.player.movement.position
    this.state = this.movement.update(playerPos, this.state)
  }

  // destroy() method remains the same
}
```

**Step 3: Commit**
```bash
git add src/js/world/enemies/zombie-movement-controller.js src/js/world/enemies/zombie.js
git commit -m "feat(enemies): implement zombie tracking, ranges, state transitions and safe spawn"
```

---

### Task 5: Implement Zombie Obstacle Jumping

**Files:**
- Modify: `src/js/world/enemies/zombie-movement-controller.js`

**Step 1: Add obstacle detection and jumping logic (FIXED - no unused Raycaster)**

Add this code inside the `update()` method, right after the state-based velocity application (Step 3) and before gravity (Step 4):

```javascript
// 3.5 Jump over obstacles when chasing (FIXED: using position-based check instead of Raycaster)
if (newState === ZombieState.CHASE && this.isGrounded) {
  const horizontalSpeed = Math.sqrt(
    this.worldVelocity.x * this.worldVelocity.x
    + this.worldVelocity.z * this.worldVelocity.z
  )

  // Only check for obstacles if we're actually moving
  if (horizontalSpeed > 0.1) {
    // Direction of movement
    const dir = new THREE.Vector3(
      this.worldVelocity.x / horizontalSpeed,
      0,
      this.worldVelocity.z / horizontalSpeed
    )

    // Check for block ahead at knee/waist height
    const checkOrigin = this.position.clone().add(new THREE.Vector3(0, 0.5, 0))
    const checkPos = checkOrigin.clone().add(dir.multiplyScalar(0.8))

    const provider = this.experience.terrainDataManager || this.terrainProvider
    if (provider?.getBlockWorld) {
      // FIXED: Use Math.floor for integer block coordinates
      const blockX = Math.floor(checkPos.x)
      const blockY = Math.floor(checkPos.y)
      const blockZ = Math.floor(checkPos.z)
      const block = provider.getBlockWorld(blockX, blockY, blockZ)

      // If obstacle exists ahead, jump!
      if (block && block.id !== 0) {
        this.worldVelocity.y = 5.5 // Jump velocity
        this.isGrounded = false
      }
    }
  }
}
```

**Key Fixes from Original:**
1. **Removed unused Raycaster** - Using simple position-based block check
2. **Added floor() for block coordinates** - `getBlockWorld` expects integer coordinates
3. **Added movement check** - Only check for obstacles when actually moving

**Step 2: Commit**
```bash
git add src/js/world/enemies/zombie-movement-controller.js
git commit -m "feat(enemies): add obstacle jumping logic for zombie when chasing"
```

---

### Task 6: Implement ZombieAnimationController

**Files:**
- Create: `src/js/world/enemies/zombie-animation.js`
- Modify: `src/js/world/enemies/zombie.js`

**Step 1: Create state-based animation logic**

We map the Steve animations to the zombie states: `idle` -> IDLE, `run` -> CHASE, `punch_right` -> ATTACK.

```javascript
// src/js/world/enemies/zombie-animation.js
import * as THREE from 'three'
import { ZombieState } from './zombie.js'

export class ZombieAnimationController {
  constructor(model, animations) {
    this.mixer = new THREE.AnimationMixer(model)
    this.actions = {}

    // Map existing Steve animations to Zombie actions
    // Animation names may vary - we use flexible string matching
    animations.forEach((clip) => {
      const name = clip.name.toLowerCase()
      if (name.includes('run')) {
        this.actions[ZombieState.CHASE] = this.mixer.clipAction(clip)
      }
      if (name.includes('idle')) {
        this.actions[ZombieState.IDLE] = this.mixer.clipAction(clip)
      }
      if (name.includes('punch') || name.includes('attack')) {
        // Use punch for attack (could be punch_right, punch_left, etc.)
        this.actions[ZombieState.ATTACK] = this.mixer.clipAction(clip)
      }
    })

    // Default fallback
    this.currentAction = this.actions[ZombieState.IDLE]
    if (this.currentAction) {
      this.currentAction.play()
    }
    else {
      console.warn('[ZombieAnimation] No idle animation found')
    }
  }

  update(dt, state) {
    this.mixer.update(dt)

    // Play animation corresponding to current state
    const targetAction = this.actions[state] || this.actions[ZombieState.IDLE]

    if (targetAction && this.currentAction !== targetAction) {
      this.currentAction.fadeOut(0.2)
      targetAction.reset().fadeIn(0.2).play()
      this.currentAction = targetAction
    }
  }

  /** Stop all animations and cleanup */
  dispose() {
    this.mixer.stopAllAction()
  }
}
```

**Step 2: Connect in Zombie class**

In `src/js/world/enemies/zombie.js`:

```javascript
import { ZombieAnimationController } from './zombie-animation.js'

export default class Zombie {
  constructor() {
    // ... existing constructor code ...

    this.movement = new ZombieMovementController(this.group)

    // Initialize animation controller
    this.animation = new ZombieAnimationController(this.model, this.resource.animations)

    // Set safe spawn position
    this.movement.setSafeSpawn(10, 10)
  }

  update() {
    const playerPos = this.player.movement.position
    this.state = this.movement.update(playerPos, this.state)

    // Update animations
    if (this.animation) {
      this.animation.update(this.time.delta * 0.001, this.state)
    }
  }

  destroy() {
    // Cleanup animation mixer
    if (this.animation) {
      this.animation.dispose()
    }

    // Cleanup model and scene
    if (this.group) {
      this.scene.remove(this.group)
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m?.dispose())
          }
          else {
            child.material?.dispose()
          }
        }
      })
    }
  }
}
```

**Step 3: Commit**
```bash
git add src/js/world/enemies/zombie-animation.js src/js/world/enemies/zombie.js
git commit -m "feat(enemies): add zombie animation switching based on states (Idle, Chase, Attack)"
```

---

### Task 7: Add Basic Health/Damage System (Optional but Recommended)

**Files:**
- Modify: `src/js/world/enemies/zombie.js`

**Step 1: Add health properties and methods**

Add to Zombie class:

```javascript
export default class Zombie {
  constructor() {
    // ... existing code ...

    // Health system
    this.maxHealth = 20
    this.health = this.maxHealth
    this.isDead = false
  }

  /** Apply damage to zombie */
  takeDamage(amount) {
    if (this.isDead)
      return

    this.health -= amount
    console.log(`[Zombie] Took ${amount} damage, health: ${this.health}/${this.maxHealth}`)

    if (this.health <= 0) {
      this.die()
    }
  }

  /** Handle zombie death */
  die() {
    this.isDead = true
    this.state = ZombieState.IDLE

    // Play death animation if available, or just fade out
    console.log('[Zombie] Died!')

    // Optional: Remove from scene after delay
    setTimeout(() => {
      this.destroy()
    }, 2000)
  }

  update() {
    if (this.isDead)
      return

    // ... existing update code ...
  }

  // ... destroy method ...
}
```

**Step 2: Commit**
```bash
git add src/js/world/enemies/zombie.js
git commit -m "feat(enemies): add basic health and damage system to zombie"
```

---

## Verification Checklist

After completing all tasks, verify:

- [ ] **Task 1**: `zombieModel` resource loads without errors
- [ ] **Task 2**: Player movement and collision still work correctly
- [ ] **Task 3**: Zombie spawns in world at safe position (not in air/blocks)
- [ ] **Task 4**: Zombie follows player when within 20 blocks
- [ ] **Task 4**: Zombie attacks with cooldown (not every frame)
- [ ] **Task 4**: Zombie returns to IDLE when player is >25 blocks away
- [ ] **Task 5**: Zombie jumps over 1-block high obstacles while chasing
- [ ] **Task 6**: Zombie plays correct animations for each state
- [ ] **Task 7**: Zombie can take damage and die (if implemented)
- [ ] **Cleanup**: No console errors when leaving/returning to game
- [ ] **Performance**: No noticeable FPS drop with zombie active

---

## Final File Structure

```
src/js/world/
├── entity-collision.js              (renamed from player/player-collision.js)
├── player/
│   ├── player-movement-controller.js (updated import)
│   └── ...
├── enemies/
│   ├── zombie.js                    (new - main zombie class)
│   ├── zombie-movement-controller.js (new - movement logic)
│   └── zombie-animation.js          (new - animation controller)
└── world.js                         (modified - zombie lifecycle)
```

---

## Troubleshooting Guide

**Issue: "Cannot find module '../entity-collision.js'"**
- Ensure `src/js/world/player/player-collision.js` was deleted
- Verify import path uses `../` not `./`

**Issue: Zombie spawns underground or in air**
- Check `setSafeSpawn()` is being called with valid coordinates
- Verify `terrainDataManager.getTopSolidYWorld()` returns valid Y
- Check console for errors during spawn

**Issue: Zombie animations not playing**
- Check browser console: `experience.resources.items.zombieModel.animations`
- Ensure animation names contain 'idle', 'run', or 'punch'
- Check that `this.resource.animations` is passed to controller

**Issue: Zombie doesn't chase player**
- Verify player position access: `this.player.movement.position`
- Check AGGRO_RANGE (20 blocks) - player may be too far
- Check console for errors in `update()`

**Issue: Memory leaks on scene change**
- Ensure `destroy()` is called on zombie
- Verify World.js calls `this.zombie?.destroy()`
- Check materials and geometries are disposed

---

*Plan Version: 2.0 (FIXED)*
*Fixes Applied: Import paths, World.js integration, terrain fallback, jump logic, attack cooldown, safe spawn, cleanup methods*
