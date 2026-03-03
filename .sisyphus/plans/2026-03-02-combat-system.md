# Combat System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a responsive combat system allowing the Player to attack Zombies and Zombies to attack the Player, featuring distance/angle hit detection, knockback physics, and red-flash visual reactions.

**Architecture:** 
1. Add a shared utility for distance and cone-angle hit detection.
2. Extend `Zombie` and `Player` classes to handle hit reactions (color flashing and knockback velocity).
3. Hook into Player's punch inputs to check for Zombie hits.
4. Modify `ZombieMovementController`'s ATTACK state to periodically apply damage to the Player via `hudStore`.

**Tech Stack:** Three.js, Vue 3, Pinia (hudStore), JavaScript

---

### Task 1: Combat Math Utilities

**Files:**
- Create: `src/js/utils/combat-utils.js`

**Step 1: Write the utility function (No existing test, so we write the logic and a quick console test)**
Create a utility function to check if a target is within a certain distance and angle from an attacker.

```javascript
// src/js/utils/combat-utils.js
import * as THREE from 'three'

/**
 * Checks if target is within attack range and cone angle
 * @param {THREE.Vector3} attackerPos
 * @param {number} attackerFacingAngle (radians)
 * @param {THREE.Vector3} targetPos
 * @param {number} range
 * @param {number} fov (radians, e.g. Math.PI/2 for 90 degrees)
 * @returns {boolean}
 */
export function isInAttackCone(attackerPos, attackerFacingAngle, targetPos, range, fov = Math.PI / 2) {
  const dist = attackerPos.distanceTo(targetPos)
  if (dist > range) return false

  // Calculate angle to target
  const dx = targetPos.x - attackerPos.x
  const dz = targetPos.z - attackerPos.z
  let angleToTarget = Math.atan2(dx, dz)
  
  // Normalize angles to -PI to PI
  let angleDiff = angleToTarget - attackerFacingAngle
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

  return Math.abs(angleDiff) <= (fov / 2)
}
```

**Step 2: Run verification**
Run: `pnpm dev` and verify no compilation errors.

**Step 3: Commit**
```bash
git add src/js/utils/combat-utils.js
git commit -m "feat(combat): add distance and angle hit detection utility"
```

---

### Task 2: Zombie Hit Reaction (Flash & Knockback)

**Files:**
- Modify: `src/js/world/enemies/zombie.js`

**Step 1: Implement the minimal code**
Update `takeDamage` to apply a red flash material override and a knockback velocity.

```javascript
// Add to zombie.js takeDamage method
takeDamage(amount, knockbackDir) {
  this.health -= amount

  // Flash Red
  this.model.traverse((child) => {
    if (child.isMesh && child.material) {
      if (!child.userData.originalColor) {
        child.userData.originalColor = child.material.color.getHex()
      }
      child.material.color.setHex(0xffaaaa) // Reddish
    }
  })

  // Reset color after 200ms
  setTimeout(() => {
    if (!this.model) return // check if destroyed
    this.model.traverse((child) => {
      if (child.isMesh && child.material && child.userData.originalColor) {
        child.material.color.setHex(child.userData.originalColor)
      }
    })
  }, 200)

  // Knockback
  if (knockbackDir && this.movement) {
    // Add backward and upward velocity
    this.movement.worldVelocity.x = knockbackDir.x * 5
    this.movement.worldVelocity.z = knockbackDir.z * 5
    this.movement.worldVelocity.y = 4 // small jump
    this.movement.isGrounded = false
  }

  if (this.health <= 0) {
    this.destroy()
  }
}
```

**Step 2: Run verification**
Run: `pnpm dev` and manually trigger `zombie.takeDamage(5, new THREE.Vector3(1,0,0))` in console.
Expected: Zombie flashes red, jumps slightly, and moves back.

**Step 3: Commit**
```bash
git add src/js/world/enemies/zombie.js
git commit -m "feat(zombie): add flash and knockback on hit"
```

---

### Task 3: Player Attack Hook

**Files:**
- Modify: `src/js/world/player/player.js`

**Step 1: Implement the minimal code**
Hook into the punch event in `setupInputListeners` to detect and hit zombies.

```javascript
// In player.js, import the combat util
// import { isInAttackCone } from '../../utils/combat-utils.js'

// Inside setupInputListeners(), under 'input:punch_straight' and 'input:punch_hook'
const handleAttack = () => {
  const enemyManager = this.experience.world?.enemyManager
  if (!enemyManager) return

  const ATTACK_RANGE = 2.0
  const ATTACK_FOV = Math.PI * (120 / 180) // 120 degrees
  const damage = 5

  enemyManager.activeEnemies.forEach(zombie => {
    if (isInAttackCone(this.getPosition(), this.getFacingAngle(), zombie.movement.position, ATTACK_RANGE, ATTACK_FOV)) {
      // Calculate knockback direction
      const knockbackDir = zombie.movement.position.clone().sub(this.getPosition()).normalize()
      knockbackDir.y = 0
      zombie.takeDamage(damage, knockbackDir)
    }
  })
}

// Call handleAttack() inside both 'input:punch_straight' and 'input:punch_hook' event callbacks AFTER this.animation.triggerAttack()
```

**Step 2: Run verification**
Run: `pnpm dev`. Walk up to a zombie and press Z or X to punch.
Expected: The zombie flashes red, gets knocked back, and eventually dies after 4 hits (20 health / 5 damage).

**Step 3: Commit**
```bash
git add src/js/world/player/player.js
git commit -m "feat(player): implement player hitting and damaging zombies"
```

---

### Task 4: Player Hit Reaction

**Files:**
- Modify: `src/js/world/player/player.js`

**Step 1: Implement the minimal code**
Add `takeDamage` method to `Player` that flashes red, applies knockback, and reduces health via `hudStore`.

```javascript
// In player.js
import { useHudStore } from '../../../pinia/hudStore.js'

// Add method to Player class
takeDamage(amount, knockbackDir) {
  const hudStore = useHudStore()
  hudStore.health = Math.max(0, hudStore.health - amount)

  // Flash Red
  this.model.traverse((child) => {
    if (child.isMesh && child.material) {
      if (!child.userData.originalColor) {
        child.userData.originalColor = child.material.color.getHex()
      }
      child.material.color.setHex(0xffaaaa)
    }
  })

  setTimeout(() => {
    if (!this.model) return
    this.model.traverse((child) => {
      if (child.isMesh && child.material && child.userData.originalColor) {
        child.material.color.setHex(child.userData.originalColor)
      }
    })
  }, 200)

  // Knockback
  if (knockbackDir && this.movement) {
    this.movement.worldVelocity.x = knockbackDir.x * 6
    this.movement.worldVelocity.z = knockbackDir.z * 6
    this.movement.worldVelocity.y = 5
    this.movement.isGrounded = false
  }
}
```

**Step 2: Run verification**
Run: `pnpm dev`. In console, call `experience.world.player.takeDamage(2, new THREE.Vector3(1,0,0))`.
Expected: Player flashes red, gets knocked back, HUD hearts decrease.

**Step 3: Commit**
```bash
git add src/js/world/player/player.js
git commit -m "feat(player): add hit reaction and health reduction"
```

---

### Task 5: Zombie Attack Hook

**Files:**
- Modify: `src/js/world/enemies/zombie-movement-controller.js`

**Step 1: Implement the minimal code**
Modify the `ZombieMovementController` to actually trigger damage on the player when in the ATTACK state and cooldown expires.

```javascript
// In zombie-movement-controller.js
// Inside update() method, under the state determination logic where it sets newState = ZombieState.ATTACK:

// Update the exact block inside `if (currentState === ZombieState.ATTACK)`:
if (currentState === ZombieState.ATTACK) {
  if (this.attackCooldown > 0) {
    newState = ZombieState.ATTACK
  }
  else if (distanceToPlayer > this.LOSE_AGGRO_RANGE) {
    newState = ZombieState.IDLE
  }
  else if (distanceToPlayer <= this.ATTACK_RANGE) {
    newState = ZombieState.ATTACK
    this.attackCooldown = 1.0
    
    // --> TRIGGER DAMAGE ON PLAYER <--
    const player = this.experience.world?.player
    if (player) {
      const knockbackDir = player.movement.position.clone().sub(this.position).normalize()
      knockbackDir.y = 0
      player.takeDamage(2, knockbackDir) // 1 heart of damage
    }
  }
  else {
    newState = ZombieState.CHASE
  }
}

// Ensure the initial transition into ATTACK also triggers it:
if (currentState === ZombieState.IDLE || currentState === ZombieState.WANDER) {
  if (distanceToPlayer <= this.ATTACK_RANGE && this.attackCooldown <= 0) {
    newState = ZombieState.ATTACK
    this.attackCooldown = 1.0
    const player = this.experience.world?.player
    if (player) {
      const knockbackDir = player.movement.position.clone().sub(this.position).normalize()
      knockbackDir.y = 0
      player.takeDamage(2, knockbackDir)
    }
  }
  // ... rest of the logic
}
```

**Step 2: Run verification**
Run: `pnpm dev`. Let a zombie approach you.
Expected: When the zombie is near, you take damage, flash red, get knocked back, and lose health. This happens every 1 second while in range.

**Step 3: Commit**
```bash
git add src/js/world/enemies/zombie-movement-controller.js
git commit -m "feat(zombie): trigger player damage when attacking"
```
