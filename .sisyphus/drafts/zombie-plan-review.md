# Zombie Implementation Plan Review Report

## 📋 Executive Summary

**Status**: ⚠️ **Can be implemented with modifications**

The plan is architecturally sound but contains **critical gaps**, **missing dependencies**, and **incorrect assumptions** that must be addressed before execution.

---

## ✅ Verified Assumptions (Correct)

### 1. Resource System
- ✅ `src/js/sources.js` exists and uses correct format
- ✅ `steve.glb` exists at `public/models/character/steve.glb`
- ✅ Adding new resource entry format is correct

### 2. Terrain Data Access
- ✅ `terrainDataManager` is exposed via `experience.terrainDataManager`
- ✅ `getBlockWorld(x, y, z)` method exists in `ChunkManager`
- ✅ World.js properly assigns `this.experience.terrainDataManager = this.chunkManager`

### 3. Collision System
- ✅ `PlayerCollisionSystem` exists and is well-structured
- ✅ It uses generic `provider.getBlockWorld()` pattern, making abstraction viable
- ✅ `PlayerMovementController` already imports and uses collision system

---

## ❌ Critical Issues (Must Fix)

### Issue 1: EntityCollisionSystem File Location

**Problem**: Plan assumes file rename from `player-collision.js` to `entity-collision.js` in same directory.

**Current State**:
```
src/js/world/player/player-collision.js  (exists)
```

**Plan Proposes**:
```
src/js/world/entity-collision.js         (does NOT exist)
```

**Issues**:
1. Path change breaks all existing imports
2. PlayerMovementController imports from `./player-collision.js` - this must be updated
3. Plan doesn't account for updating **all** other files that import collision system

**Files that import PlayerCollisionSystem** (from grep):
- `src/js/world/player/player-movement-controller.js` (line 5)

**Fix Required**:
```javascript
// To:
import EntityCollisionSystem from '../entity-collision.js'
// In player-movement-controller.js, change:
import PlayerCollisionSystem from './player-collision.js'

// And in constructor:
this.collision = new EntityCollisionSystem()
```

---

### Issue 2: Missing Player Position Access in Zombie

**Problem**: Plan assumes `this.player.movement.position` exists, but actual property access may differ.

**Actual Player Movement Structure** (from player-movement-controller.js):
```javascript
this.movement = new PlayerMovementController(this.config)
this.movement.position // THREE.Vector3 - the position
this.movement.group.position // THREE.Group position (synced with position)
```

**Plan Uses**:
```javascript
this.player.movement.position // This should work
```

✅ **This is correct** - `Player.movement` is `PlayerMovementController` which has `.position`

---

### Issue 3: Terrain Provider Access Timing

**Problem**: ZombieMovementController tries to access `this.experience.terrainDataManager` directly.

**Current Pattern** (from player-movement-controller.js):
```javascript
// Line 31: Direct assignment in constructor
this.terrainProvider = this.experience.terrainDataManager

// Line 134: Fallback pattern in update
const provider = this.experience.terrainDataManager || this.terrainProvider
```

**Issue**: If zombie is created before `core:ready`, `terrainDataManager` will be `undefined`.

**Fix Required**: Use same fallback pattern in ZombieMovementController:
```javascript
constructor() {
  // ...
  this.terrainProvider = this.experience.terrainDataManager  // May be undefined initially
}

update() {
  const provider = this.experience.terrainDataManager || this.terrainProvider
  // ...
}
```

---

### Issue 4: Missing Import Path Updates

**Problem**: Plan doesn't list all files that need import updates when renaming collision system.

**Files Affected by Collision Rename**:
1. `src/js/world/player/player-movement-controller.js` - imports collision system

The plan mentions updating `player-movement-controller.js` but doesn't mention the need to update import path from relative `./player-collision.js` to `../entity-collision.js`.

---

### Issue 5: Zombie Animation - Resource.animations Access

**Problem**: Plan assumes zombie model has animations like player.

**Player Code** (player.js line 65):
```javascript
this.resource = this._getModelResource(skinStore.currentSkinId)
// resource has: scene, animations
this.animation = new PlayerAnimationController(this.model, this.resource.animations)
```

**Zombie Plan** (zombie.js line 86):
```javascript
this.resource = this.resources.items.zombieModel
// ...
this.animation = new ZombieAnimationController(this.model, this.resource.animations)
```

⚠️ **Potential Issue**: If `steve.glb` has animations, this works. But plan should verify animation names match.

From plan's zombie-animation.js:
```javascript
animations.forEach((clip) => {
  const name = clip.name.toLowerCase()
  if (name.includes('run')) { /* ... */ }
  if (name.includes('idle')) { /* ... */ }
  if (name.includes('punch_right')) { /* ... */ }
})
```

✅ **This is acceptable** - using string matching for animation names is flexible

---

## ⚠️ Logic Gaps (Recommend Improvements)

### Gap 1: No Zombie Death/Damage System

**Missing**: No mention of:
- How zombie takes damage
- How zombie dies
- Health system
- Hit detection from player attacks

**Impact**: Zombie is invincible - it's essentially a moving obstacle, not an enemy.

**Recommendation**: Add a Task 7 for basic health/damage:
```javascript
// In Zombie class
this.health = 20
this.takeDamage(amount) { this.health -= amount }
```

---

### Gap 2: No Attack Cooldown

**Current Implementation**:
```javascript
if (distanceToPlayer <= this.ATTACK_RANGE) {
  newState = ZombieState.ATTACK
}
```

**Problem**: Zombie will spam ATTACK state every frame while in range.

**Missing**: Attack cooldown timer to prevent instant kill.

**Recommendation**: Add attack cooldown:
```javascript
this.attackCooldown = 0
// In update:
if (distanceToPlayer <= this.ATTACK_RANGE && this.attackCooldown <= 0) {
  newState = ZombieState.ATTACK
  this.attackCooldown = 1.0 // 1 second between attacks
}
this.attackCooldown -= dt
```

---

### Gap 3: No Spawn System

**Current**: Hardcoded spawn position:
```javascript
this.group.position.set(10, 80, 10)
```

**Problem**:
- May spawn in air or inside blocks
- No way to spawn multiple zombies
- No respawn mechanism

**Recommendation**: Add spawn validation:
```javascript
// Find ground Y at spawn location
const spawnX = 10; const spawnZ = 10
const groundY = provider.getTopSolidYWorld(spawnX, spawnZ)
this.group.position.set(spawnX, groundY + 1, spawnZ)
```

---

### Gap 4: Jump Logic Uses Raycaster Incorrectly

**Current Jump Code**:
```javascript
this.raycaster = new THREE.Raycaster()
this.raycaster.far = 1.0
// ...
const origin = this.position.clone().add(new THREE.Vector3(0, 0.5, 0))
const dir = new THREE.Vector3(this.worldVelocity.x, 0, this.worldVelocity.z).normalize()
this.raycaster.set(origin, dir)

const checkPos = origin.clone().add(dir.multiplyScalar(0.8))
const block = provider?.getBlockWorld?.(checkPos.x, checkPos.y, checkPos.z)
```

**Problem**: Creates Raycaster but doesn't actually use it for raycasting. It uses `getBlockWorld` directly.

**Fix**: Either:
1. Remove unused Raycaster (simpler):
```javascript
// Just check block ahead without raycaster
const dir = new THREE.Vector3(this.worldVelocity.x, 0, this.worldVelocity.z).normalize()
const checkPos = this.position.clone().add(new THREE.Vector3(0, 0.5, 0)).add(dir.multiplyScalar(0.8))
```

2. Or use actual raycasting (more accurate but requires terrain mesh):
```javascript
const intersects = this.raycaster.intersectObjects(terrainMeshes)
if (intersects.length > 0 && intersects[0].distance < 0.8) {
  // Jump
}
```

**Recommendation**: Option 1 - simpler and consistent with existing codebase.

---

### Gap 5: Missing Enemy Manager

**Problem**: World.js update() has no zombie update call.

**Current World.update()**:
```javascript
update() {
  if (this.player) this.player.update()
  // ... no zombie update
}
```

**Plan Says**: "Update it in World.update()" but doesn't show code.

**Missing Code**:
```javascript
// In world.js
_initEnemies() {
  this.zombie = new Zombie()
}

update() {
  // ... existing updates ...
  if (this.zombie) this.zombie.update()
}
```

---

### Gap 6: No Cleanup/Destroy

**Missing**: Zombie class has no `destroy()` method.

**World.destroy()** needs:
```javascript
destroy() {
  // ... existing cleanup ...
  this.zombie?.destroy()
}
```

**Zombie needs**:
```javascript
destroy() {
  this.scene.remove(this.group)
  this.model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      child.material?.dispose()
    }
  })
  this.animation?.mixer?.stopAllAction()
}
```

---

## 📊 Implementation Risk Assessment

| Component | Risk Level | Notes |
|-----------|------------|-------|
| EntityCollisionSystem | 🟡 Medium | File rename affects imports, but straightforward |
| Zombie Base Class | 🟢 Low | Simple class structure, follows existing patterns |
| ZombieMovementController | 🟡 Medium | Terrain access timing, jump logic has unused raycaster |
| ZombieAnimationController | 🟢 Low | Straightforward state-to-animation mapping |
| Integration | 🔴 High | Missing enemy update in World, missing cleanup, missing spawn validation |

---

## 🔧 Recommended Plan Modifications

### Before Task 1: Add Pre-Task Validation
```markdown
### Pre-Task: Verify Steve Model Animations
Run the game and check console for:
```javascript
console.log(experience.resources.items.steveModel.animations)
```
Verify animations include: idle, run, punch_right (or similar)
```

### Modify Task 2: Explicit Import Updates
Add explicit instruction:
```javascript
// In src/js/world/player/player-movement-controller.js
// Line 5: Change from:
import PlayerCollisionSystem from './player-collision.js'
// To:
import EntityCollisionSystem from '../entity-collision.js'

// Line 29: Change from:
this.collision = new PlayerCollisionSystem()
// To:
this.collision = new EntityCollisionSystem()
```

### After Task 3: Add Missing World Integration Code
Show exact code to add to World.js:
```javascript
// In constructor, add to emitter.on('core:ready'):
this._initEnemies()

// Add method:
_initEnemies() {
  this.zombie = new Zombie()
}

// In update(), add:
if (this.zombie) this.zombie.update()

// In destroy(), add:
this.zombie?.destroy()
```

### Modify Task 5: Fix Jump Logic
Replace raycaster with simple block check:
```javascript
// Remove Raycaster creation
// In update():
if (this.isGrounded && newState === ZombieState.CHASE) {
  const dir = new THREE.Vector3(this.worldVelocity.x, 0, this.worldVelocity.z).normalize()
  if (dir.length() > 0.1) { // Only if moving
    const checkPos = this.position.clone().add(new THREE.Vector3(0, 0.5, 0)).add(dir.multiplyScalar(0.8))
    const block = provider?.getBlockWorld?.(Math.floor(checkPos.x), Math.floor(checkPos.y), Math.floor(checkPos.z))
    if (block && block.id !== 0) {
      this.worldVelocity.y = 5.5
      this.isGrounded = false
    }
  }
}
```

### Add Task 7: Cleanup and Spawn Validation
```markdown
### Task 7: Add Cleanup and Spawn Safety

**Files:**
- Modify: `src/js/world/enemies/zombie.js`
- Modify: `src/js/world/world.js`

**Step 1: Add destroy method to Zombie**
```javascript
destroy() {
  this.scene.remove(this.group)
  this.model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose()
      child.material?.dispose()
    }
  })
  this.animation?.mixer?.stopAllAction()
}
```

**Step 2: Update World.destroy()**
```javascript
destroy() {
  // ... existing cleanup ...
  this.zombie?.destroy()
}
```

**Step 3: Add safe spawn logic**
Instead of hardcoded (10, 80, 10), find ground level:
```javascript
setSafeSpawn(x, z) {
  const provider = this.experience.terrainDataManager
  const groundY = provider?.getTopSolidYWorld?.(Math.floor(x), Math.floor(z))
  this.group.position.set(x, (groundY ?? 80) + 1, z)
}
```
```

---

## ✅ Final Verdict

**Can this plan be implemented?**

**YES**, but with the following **mandatory changes**:

1. **Fix import paths** when renaming collision system
2. **Add missing World.js integration** (init, update, destroy)
3. **Fix unused Raycaster** in jump logic
4. **Add terrain provider fallback pattern** for timing safety
5. **Add cleanup/destroy methods**

**Optional but Recommended**:
1. Add spawn validation (don't spawn in air/blocks)
2. Add attack cooldown system
3. Add basic health/damage system

**Estimated Implementation Time**: 2-3 hours (with fixes)
**Without fixes**: Will break build and runtime

---

## 📝 Appendix: File Structure After Implementation

```
src/js/world/
├── entity-collision.js              (renamed from player/player-collision.js)
├── player/
│   ├── player-collision.js          (should NOT exist - consolidated)
│   ├── player-movement-controller.js (updated import)
│   └── ...
├── enemies/
│   ├── zombie.js                    (new)
│   ├── zombie-movement-controller.js (new)
│   └── zombie-animation.js          (new)
└── world.js                         (modified - add zombie init/update/destroy)
```

---

**Report Generated**: 2026-02-26
**Analyzed Plan**: docs/plans/2026-02-26-enemy-system-zombie-design.md
