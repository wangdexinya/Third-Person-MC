# Enemy System (Zombie) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a simple zombie enemy system using a directional tracking algorithm with obstacle jumping, reusing the existing `steve.glb` model and player collision logic. 

**Architecture:** We will create a `Zombie` entity class which is similar to `Player`. It will use an `EntityCollisionSystem` (abstracted from `PlayerCollisionSystem`), a `ZombieMovementController` (which computes direction towards the player, manages aggro/attack ranges, and jumps over obstacles), and a `ZombieAnimationController` (reusing Steve's animations for Idle, Run, and Attack).

**Tech Stack:** Three.js, Vite, Vue (Game UI), custom voxel collision system.

---

### Pre-Task: Verify Steve Model Animations
Run the game and check the console or debugger to verify the animations inside `steve.glb`:
```javascript
// Run in browser console after game loads:
console.log(window.Experience.resources.items.steveModel.animations)
```
Verify animations include: idle, run, punch_right (or similar names).

### Task 1: Add Zombie Resource

**Files:**
- Modify: `src/js/sources.js`

**Step 1: Add zombieModel to sources**
```javascript
// Add to the exported array in src/js/sources.js
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

### Task 2: Abstract PlayerCollisionSystem to EntityCollisionSystem

**Files:**
- Rename: `src/js/world/player/player-collision.js` -> `src/js/world/entity-collision.js`
- Modify: `src/js/world/player/player-movement-controller.js`

**Step 1: Rename the file and class**
Rename `src/js/world/player/player-collision.js` to `src/js/world/entity-collision.js`.
Change `class PlayerCollisionSystem` to `class EntityCollisionSystem`.
Update any comments from "玩家" to "实体".

**Step 2: Update PlayerMovementController imports**
```javascript
// In src/js/world/player/player-movement-controller.js
// Change:
// import PlayerCollisionSystem from './player-collision.js'
// To:
import EntityCollisionSystem from '../entity-collision.js'

// In constructor, change:
// this.collision = new PlayerCollisionSystem()
// To:
this.collision = new EntityCollisionSystem()
```

**Step 3: Test to ensure player still collides correctly**
(Run the dev server and verify player collision still works.)

**Step 4: Commit**
```bash
git rm src/js/world/player/player-collision.js
git add src/js/world/entity-collision.js src/js/world/player/player-movement-controller.js
git commit -m "refactor(physics): abstract PlayerCollisionSystem to EntityCollisionSystem for reuse"
```

### Task 3: Create Zombie Base Class

**Files:**
- Create: `src/js/world/enemies/zombie.js`

**Step 1: Write minimal Zombie class with health and destroy**
```javascript
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
    this.health = 20
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
  }
  
  setSafeSpawn(x, z) {
    const provider = this.experience.terrainDataManager
    const groundY = provider?.getTopSolidYWorld?.(Math.floor(x), Math.floor(z))
    this.group.position.set(x, (groundY ?? 80) + 1, z)
  }

  takeDamage(amount) {
    this.health -= amount
    if (this.health <= 0) {
        this.destroy()
    }
  }

  update() {
    // To be implemented
  }

  destroy() {
    this.scene.remove(this.group)
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        child.material?.dispose()
      }
    })
    if (this.animation && this.animation.mixer) {
        this.animation.mixer.stopAllAction()
    }
    // Also remove from world updates if managed in an array later
  }
}
```

**Step 2: Commit**
```bash
git add src/js/world/enemies/zombie.js
git commit -m "feat(enemies): add base Zombie class with health and cleanup"
```

### Task 4: Implement ZombieMovementController (Distance, States, Cooldown, Terrain Fallback)

**Files:**
- Create: `src/js/world/enemies/zombie-movement-controller.js`
- Modify: `src/js/world/enemies/zombie.js`

**Step 1: Create the controller logic with aggro, attack ranges, and attack cooldown**
```javascript
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
    this.terrainProvider = this.experience.terrainDataManager // May be undefined initially
    
    // Distances
    this.AGGRO_RANGE = 20.0
    this.LOSE_AGGRO_RANGE = 25.0
    this.ATTACK_RANGE = 1.5
    
    this.attackCooldown = 0
  }

  update(playerPos, currentState) {
    const dt = this.experience.time.delta * 0.001
    this.collision.prepareFrame()
    
    this.attackCooldown -= dt

    // 1. Calculate direction and distance to player
    const direction = new THREE.Vector3().subVectors(playerPos, this.position)
    direction.y = 0 // Ignore height for horizontal movement
    let distanceToPlayer = direction.length()
    
    let newState = currentState

    // 2. Determine State based on distance and cooldown
    if (currentState === ZombieState.IDLE) {
        if (distanceToPlayer <= this.AGGRO_RANGE) {
            newState = ZombieState.CHASE
        }
    } else if (currentState === ZombieState.CHASE || currentState === ZombieState.ATTACK) {
        if (distanceToPlayer > this.LOSE_AGGRO_RANGE) {
            newState = ZombieState.IDLE
        } else if (distanceToPlayer <= this.ATTACK_RANGE && this.attackCooldown <= 0) {
            newState = ZombieState.ATTACK
            this.attackCooldown = 1.0 // 1 second between attacks
        } else if (distanceToPlayer > this.ATTACK_RANGE) {
            newState = ZombieState.CHASE
        } else {
            // Wait for cooldown while in range
            newState = ZombieState.IDLE // Or a specific 'wait' state, IDLE is fine for now
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
    } else {
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
    const playerState = {
      basePosition: nextPosition,
      center: nextPosition.clone().add(this.capsule.offset),
      halfHeight: this.capsule.halfHeight,
      radius: this.capsule.radius,
      worldVelocity: this.worldVelocity,
      isGrounded: this.isGrounded,
    }

    const provider = this.experience.terrainDataManager || this.terrainProvider
    if(provider) {
        const candidates = this.collision.broadPhase(playerState, provider)
        const collisions = this.collision.narrowPhase(candidates, playerState)
        this.collision.resolveCollisions(collisions, playerState)
    }

    this.isGrounded = playerState.isGrounded
    this.position.copy(playerState.basePosition)
    this.worldVelocity.copy(playerState.worldVelocity)

    return newState // Return updated state to Zombie class
  }
}
```

**Step 2: Connect to Zombie**
Instantiate this in `Zombie` class and update state.
```javascript
// In src/js/world/enemies/zombie.js constructor
import { ZombieMovementController } from './zombie-movement-controller.js'
// ...
this.movement = new ZombieMovementController(this.group)

// In src/js/world/enemies/zombie.js update()
if (this.player && this.player.movement) {
    this.state = this.movement.update(this.player.movement.position, this.state)
}
```

**Step 3: Commit**
```bash
git add src/js/world/enemies/zombie-movement-controller.js src/js/world/enemies/zombie.js
git commit -m "feat(enemies): implement zombie tracking, ranges, cooldown, and terrain fallback"
```

### Task 5: Implement Zombie Obstacle Jumping (Simple Block Check)

**Files:**
- Modify: `src/js/world/enemies/zombie-movement-controller.js`

**Step 1: Check block ahead without raycaster**
```javascript
  // In update, right after newState velocity setup (before gravity):
  if (this.isGrounded && newState === ZombieState.CHASE) {
      const dir = new THREE.Vector3(this.worldVelocity.x, 0, this.worldVelocity.z).normalize()
      if (dir.lengthSq() > 0.01) { // Only if moving
          const checkPos = this.position.clone().add(new THREE.Vector3(0, 0.5, 0)).add(dir.multiplyScalar(0.8))
          const provider = this.experience.terrainDataManager || this.terrainProvider
          const block = provider?.getBlockWorld?.(Math.floor(checkPos.x), Math.floor(checkPos.y), Math.floor(checkPos.z))
          
          if (block && block.id !== 0) { // Obstacle exists
              this.worldVelocity.y = 5.5 // Jump velocity
              this.isGrounded = false
          }
      }
  }
```

**Step 2: Commit**
```bash
git add src/js/world/enemies/zombie-movement-controller.js
git commit -m "feat(enemies): add block-based jump logic over obstacles for zombie"
```

### Task 6: Implement ZombieAnimationController (Mapping States)

**Files:**
- Create: `src/js/world/enemies/zombie-animation.js`
- Modify: `src/js/world/enemies/zombie.js`

**Step 1: Create state-based animation logic**
```javascript
import * as THREE from 'three'
import { ZombieState } from './zombie.js'

export class ZombieAnimationController {
  constructor(model, animations) {
    this.mixer = new THREE.AnimationMixer(model)
    this.actions = {}
    
    // Map existing Steve animations to Zombie actions
    animations.forEach(clip => {
        const name = clip.name.toLowerCase()
        if(name.includes('run') || name.includes('walk')) {
            this.actions[ZombieState.CHASE] = this.mixer.clipAction(clip)
        }
        if(name.includes('idle')) {
            this.actions[ZombieState.IDLE] = this.mixer.clipAction(clip)
        }
        if(name.includes('punch') || name.includes('attack')) {
            this.actions[ZombieState.ATTACK] = this.mixer.clipAction(clip)
        }
    })
    
    // Default fallback
    this.currentAction = this.actions[ZombieState.IDLE]
    if(this.currentAction) this.currentAction.play()
  }

  update(dt, state) {
    this.mixer.update(dt)
    
    // Play animation corresponding to current state
    const targetAction = this.actions[state] || this.actions[ZombieState.IDLE]
    
    if (targetAction && this.currentAction !== targetAction) {
        if(this.currentAction) this.currentAction.fadeOut(0.2)
        targetAction.reset().fadeIn(0.2).play()
        this.currentAction = targetAction
    }
  }
}
```

**Step 2: Connect in Zombie class**
```javascript
// In src/js/world/enemies/zombie.js
import { ZombieAnimationController } from './zombie-animation.js'

// In Zombie constructor, after setModel
this.animation = new ZombieAnimationController(this.model, this.resource.animations)

// In Zombie update
if (this.animation) {
    this.animation.update(this.time.delta * 0.001, this.state)
}
```

**Step 3: Commit**
```bash
git add src/js/world/enemies/zombie-animation.js src/js/world/enemies/zombie.js
git commit -m "feat(enemies): add zombie animation switching based on states (Idle, Chase, Attack)"
```

### Task 7: Integrate Zombie into World (Init, Update, Destroy)

**Files:**
- Modify: `src/js/world/world.js`

**Step 1: Add integration logic to World.js**
```javascript
// Import
import Zombie from './enemies/zombie.js'

// In constructor, inside emitter.on('core:ready'):
this._initEnemies()

// Add new method:
_initEnemies() {
  this.zombie = new Zombie()
  this.zombie.setSafeSpawn(10, 10) // Spawn at chunk 0,0 roughly
}

// In update():
update() {
  // ... existing code ...
  if (this.zombie) {
    this.zombie.update()
  }
}

// In destroy():
destroy() {
  // ... existing cleanup ...
  this.zombie?.destroy()
}
```

**Step 2: Commit**
```bash
git add src/js/world/world.js
git commit -m "feat(world): integrate zombie init, update, safe spawn, and destroy"
```