# Combat System Implementation Plan (Fixed)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **修复内容:** 材质克隆、攻击冷却、击退物理、死亡机制、无敌帧

**Goal:** Implement a responsive combat system allowing the Player to attack Zombies and Zombies to attack the Player, featuring distance/angle hit detection, knockback physics, and red-flash visual reactions.

**Architecture:** 
1. Add a shared utility for distance and cone-angle hit detection.
2. Extend `Zombie` and `Player` classes to handle hit reactions (color flashing with material cloning, knockback velocity).
3. Hook into Player's punch inputs with attack cooldown system.
4. Modify `ZombieMovementController`'s ATTACK state to trigger damage once per attack cycle.
5. Add player death/respawn and invulnerability frame system.

**Tech Stack:** Three.js, Vue 3, Pinia (hudStore), JavaScript

---

### Task 1: Combat Math Utilities

**Files:**
- Create: `src/js/utils/combat-utils.js`

**Step 1: Write the utility function**
创建工具函数用于检测目标是否在攻击者的距离和角度范围内。

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

/**
 * Calculate knockback direction from attacker to target
 * @param {THREE.Vector3} attackerPos
 * @param {THREE.Vector3} targetPos
 * @returns {THREE.Vector3} Normalized direction (y=0)
 */
export function calculateKnockbackDir(attackerPos, targetPos) {
  const dir = new THREE.Vector3()
    .subVectors(targetPos, attackerPos)
    .normalize()
  dir.y = 0
  return dir
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

### Task 2: Player Attack System with Cooldown

**Files:**
- Modify: `src/js/world/player/player.js`

**Step 1: Add attack cooldown and damage handling**
在 Player 类中添加攻击冷却系统和伤害检测逻辑。

```javascript
// In player.js constructor (around line 60)
constructor() {
  // ... existing code ...
  
  // 攻击冷却系统
  this.attackCooldown = 0
  this.ATTACK_COOLDOWN = 0.5 // 500ms 冷却时间
  
  // 攻击配置
  this.attackConfig = {
    range: 2.0,
    fov: Math.PI * (120 / 180), // 120度
    damage: 5,
  }
}

// Add method to handle attack
handleAttack() {
  // 检查冷却
  if (this.attackCooldown > 0) return
  
  const enemyManager = this.experience.world?.enemyManager
  if (!enemyManager) return
  
  // 设置冷却
  this.attackCooldown = this.ATTACK_COOLDOWN
  
  const { range, fov, damage } = this.attackConfig
  const attackerPos = this.getPosition()
  // 修复：使用实际朝向而非配置默认值
  const attackerAngle = this.movement.facingAngle
  
  enemyManager.activeEnemies.forEach((zombie) => {
    if (isInAttackCone(attackerPos, attackerAngle, zombie.movement.position, range, fov)) {
      const knockbackDir = calculateKnockbackDir(attackerPos, zombie.movement.position)
      zombie.takeDamage(damage, knockbackDir)
    }
  })
}

// In update() method (around line 323), add cooldown decrement:
update() {
  // ... existing code ...
  
  // 更新攻击冷却
  if (this.attackCooldown > 0) {
    const dt = this.time.delta * 0.001
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
  }
  
  // ... rest of update code ...
}
```

**Step 2: Hook attacks into input handlers**
修改现有的 punch 事件处理器：

```javascript
// In setupInputListeners(), update existing handlers (around line 244):

// 直拳（Z键）- 左右交替
emitter.on('input:punch_straight', () => {
  // 检查冷却
  if (this.attackCooldown > 0) return
  
  const anim = this._useLeftStraight
    ? AnimationClips.STRAIGHT_PUNCH
    : AnimationClips.RIGHT_STRAIGHT_PUNCH
  this._useLeftStraight = !this._useLeftStraight
  this.animation.triggerAttack(anim)
  
  // 触发攻击检测
  this.handleAttack()
})

// 勾拳（X键）- 左右交替
emitter.on('input:punch_hook', () => {
  // 检查冷却
  if (this.attackCooldown > 0) return
  
  const anim = this._useLeftHook
    ? AnimationClips.HOOK_PUNCH
    : AnimationClips.RIGHT_HOOK_PUNCH
  this._useLeftHook = !this._useLeftHook
  this.animation.triggerAttack(anim)
  
  // 触发攻击检测
  this.handleAttack()
})
```

**Step 3: Run verification**
Run: `pnpm dev`。Walk up to a zombie and press Z or X to punch.
Expected: Attack has 500ms cooldown, zombie flashes red, gets knocked back.

**Step 4: Commit**
```bash
git add src/js/world/player/player.js
git commit -m "feat(player): implement attack system with cooldown and hit detection"
```

---

### Task 3: Zombie Hit Reaction (Fixed Material Cloning)

**Files:**
- Modify: `src/js/world/enemies/zombie.js`

**Step 1: Implement takeDamage with material cloning**
修复材质共享问题，确保每个僵尸有自己独立的材质副本。

```javascript
// In zombie.js, replace existing takeDamage method:

takeDamage(amount, knockbackDir) {
  this.health -= amount
  
  // Flash Red - 克隆材质避免影响其他僵尸
  this.model.traverse((child) => {
    if (child.isMesh && child.material) {
      // 首次受伤时克隆材质
      if (!child.userData.isCloned) {
        child.userData.originalMaterial = child.material
        child.material = child.material.clone()
        child.userData.isCloned = true
      }
      // 保存当前颜色用于恢复
      if (!child.userData.flashOriginalColor) {
        child.userData.flashOriginalColor = child.material.color.clone()
      }
      // 变红
      child.material.color.setHex(0xff5555)
    }
  })
  
  // 200ms 后恢复颜色
  setTimeout(() => {
    if (!this.model) return
    this.model.traverse((child) => {
      if (child.isMesh && child.material && child.userData.flashOriginalColor) {
        child.material.color.copy(child.userData.flashOriginalColor)
      }
    })
  }, 200)
  
  // Knockback - 应用击退速度
  if (knockbackDir && this.movement) {
    this.movement.applyKnockback(knockbackDir)
  }
  
  if (this.health <= 0) {
    this.destroy()
  }
}
```

**Step 2: Run verification**
Run: `pnpm dev`。Trigger `zombie.takeDamage(5, new THREE.Vector3(1,0,0))` in console.
Expected: Zombie flashes red (only that zombie), gets knocked back, materials don't affect other zombies.

**Step 3: Commit**
```bash
git add src/js/world/enemies/zombie.js
git commit -m "feat(zombie): add flash and knockback with material cloning"
```

---

### Task 4: Player Hit Reaction with Invulnerability

**Files:**
- Modify: `src/js/world/player/player.js`
- Modify: `src/pinia/hudStore.js`

**Step 1: Add invulnerability and death handling to Player**
```javascript
// In player.js constructor:
constructor() {
  // ... existing code ...
  
  // 受伤无敌系统
  this.isInvulnerable = false
  this.invulnerabilityDuration = 1.0 // 1秒无敌
  this.invulnerabilityTimer = 0
}

// Add takeDamage method to Player class:
takeDamage(amount, knockbackDir) {
  // 检查无敌状态
  if (this.isInvulnerable) return
  
  const hudStore = useHudStore()
  hudStore.health = Math.max(0, hudStore.health - amount)
  
  // 触发无敌
  this.isInvulnerable = true
  this.invulnerabilityTimer = this.invulnerabilityDuration
  
  // Flash Red - 克隆材质
  this.model.traverse((child) => {
    if (child.isMesh && child.material) {
      if (!child.userData.isCloned) {
        child.userData.originalMaterial = child.material
        child.material = child.material.clone()
        child.userData.isCloned = true
      }
      if (!child.userData.flashOriginalColor) {
        child.userData.flashOriginalColor = child.material.color.clone()
      }
      child.material.color.setHex(0xff5555)
    }
  })
  
  // 恢复颜色
  setTimeout(() => {
    if (!this.model) return
    this.model.traverse((child) => {
      if (child.isMesh && child.material && child.userData.flashOriginalColor) {
        child.material.color.copy(child.userData.flashOriginalColor)
      }
    })
  }, 200)
  
  // Knockback
  if (knockbackDir && this.movement) {
    this.movement.applyKnockback(knockbackDir, 6, 5) // 更强击退
  }
  
  // 检查死亡
  if (hudStore.health <= 0) {
    this.die()
  }
}

// Add die method:
die() {
  // 播放死亡动画（如果有）
  // 延迟后重生
  setTimeout(() => {
    this.respawn()
    // 恢复满血
    const hudStore = useHudStore()
    hudStore.health = hudStore.maxHealth
  }, 1000)
}

// Update update() method to handle invulnerability timer:
update() {
  // ... existing code ...
  
  // 更新攻击冷却
  if (this.attackCooldown > 0) {
    const dt = this.time.delta * 0.001
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
  }
  
  // 更新无敌时间
  if (this.isInvulnerable && this.invulnerabilityTimer > 0) {
    const dt = this.time.delta * 0.001
    this.invulnerabilityTimer -= dt
    if (this.invulnerabilityTimer <= 0) {
      this.isInvulnerable = false
    }
  }
  
  // ... rest of update code ...
}
```

**Step 2: Add health modification methods to hudStore**
```javascript
// In src/pinia/hudStore.js, add these methods:

function takeDamage(amount) {
  health.value = Math.max(0, health.value - amount)
}

function heal(amount) {
  health.value = Math.min(maxHealth.value, health.value + amount)
}

function setHealth(value) {
  health.value = Math.max(0, Math.min(maxHealth.value, value))
}

// Return them:
return {
  // ... existing exports ...
  takeDamage,
  heal,
  setHealth,
}
```

**Step 3: Run verification**
Run: `pnpm dev`. Call `experience.world.player.takeDamage(2, new THREE.Vector3(1,0,0))` in console.
Expected: Player flashes red, gets knocked back, HUD hearts decrease, becomes invulnerable for 1 second.

**Step 4: Commit**
```bash
git add src/js/world/player/player.js src/pinia/hudStore.js
git commit -m "feat(player): add hit reaction, invulnerability frames, and death handling"
```

---

### Task 5: Zombie Attack Hook (Fixed)

**Files:**
- Modify: `src/js/world/enemies/zombie-movement-controller.js`

**Step 1: Add applyKnockback method to movement controllers**
首先在 PlayerMovementController 和 ZombieMovementController 中添加击退方法：

```javascript
// In player-movement-controller.js, add:
/**
 * 应用击退效果
 * @param {THREE.Vector3} direction - 击退方向（水平）
 * @param {number} horizontalForce - 水平力度
 * @param {number} verticalForce - 垂直力度
 */
applyKnockback(direction, horizontalForce = 6, verticalForce = 5) {
  this.worldVelocity.x = direction.x * horizontalForce
  this.worldVelocity.z = direction.z * horizontalForce
  this.worldVelocity.y = verticalForce
  this.isGrounded = false
}
```

```javascript
// In zombie-movement-controller.js, add:
applyKnockback(direction, horizontalForce = 5, verticalForce = 4) {
  this.worldVelocity.x = direction.x * horizontalForce
  this.worldVelocity.z = direction.z * horizontalForce
  this.worldVelocity.y = verticalForce
  this.isGrounded = false
}
```

**Step 2: Fix attack state logic**
修改攻击状态逻辑，确保每次进入 ATTACK 状态时只触发一次伤害。

```javascript
// In zombie-movement-controller.js, modify update() method:
// 添加追踪变量到 constructor:
constructor(zombieGroup, { collision } = {}) {
  // ... existing code ...
  this.hasDealtDamage = false // 追踪本次攻击是否已造成伤害
}

// In update() method, modify ATTACK state handling:
if (currentState === ZombieState.ATTACK) {
  if (this.attackCooldown > 0) {
    newState = ZombieState.ATTACK
    // 保持在攻击状态，但不重复造成伤害
  }
  else if (distanceToPlayer > this.LOSE_AGGRO_RANGE) {
    newState = ZombieState.IDLE
    this.hasDealtDamage = false // 重置标记
  }
  else if (distanceToPlayer <= this.ATTACK_RANGE) {
    newState = ZombieState.ATTACK
    this.attackCooldown = 1.0
    
    // 触发伤害（仅在刚刚进入攻击状态时）
    if (!this.hasDealtDamage) {
      const player = this.experience.world?.player
      if (player) {
        const knockbackDir = calculateKnockbackDir(this.position, player.movement.position)
        player.takeDamage(2, knockbackDir)
      }
      this.hasDealtDamage = true
    }
  }
  else {
    newState = ZombieState.CHASE
    this.hasDealtDamage = false // 重置标记
  }
}

// Also update the transition from IDLE/WANDER to ATTACK:
if (currentState === ZombieState.IDLE || currentState === ZombieState.WANDER) {
  if (distanceToPlayer <= this.ATTACK_RANGE && this.attackCooldown <= 0) {
    newState = ZombieState.ATTACK
    this.attackCooldown = 1.0
    this.hasDealtDamage = false // 新攻击周期开始
    
    // 立即触发第一次伤害
    const player = this.experience.world?.player
    if (player) {
      const knockbackDir = calculateKnockbackDir(this.position, player.movement.position)
      player.takeDamage(2, knockbackDir)
    }
    this.hasDealtDamage = true
  }
  // ... rest of logic
}
```

**Step 3: Run verification**
Run: `pnpm dev`. Let a zombie approach you.
Expected: Zombie enters attack range -> deals damage once -> waits 1 second cooldown -> can deal damage again. No spam damage.

**Step 4: Commit**
```bash
git add src/js/world/enemies/zombie-movement-controller.js src/js/world/player/player-movement-controller.js
git commit -m "feat(zombie): fix attack damage trigger with cooldown and state tracking"
```

---

### Task 6: Combat Debug Panel

**Files:**
- Modify: `src/js/world/player/player.js`
- Modify: `src/js/world/enemies/enemy-manager.js`

**Step 1: Add debug controls for combat**
```javascript
// In player.js debugInit(), add:
debugInit() {
  // ... existing debug panels ...
  
  // ===== 战斗调试 =====
  const combatFolder = this.debugFolder.addFolder({
    title: '战斗系统',
    expanded: false,
  })
  
  combatFolder.addBinding(this.attackConfig, 'range', {
    label: '攻击范围',
    min: 0.5,
    max: 5.0,
    step: 0.1,
  })
  
  combatFolder.addBinding(this.attackConfig, 'damage', {
    label: '攻击伤害',
    min: 1,
    max: 20,
    step: 1,
  })
  
  combatFolder.addBinding(this, 'attackCooldown', {
    label: '当前冷却',
    readonly: true,
  })
  
  combatFolder.addBinding(this, 'isInvulnerable', {
    label: '无敌状态',
    readonly: true,
  })
  
  // 测试按钮
  const testParams = { damage: 2 }
  combatFolder.addBinding(testParams, 'damage', {
    label: '测试伤害值',
    min: 1,
    max: 10,
    step: 1,
  })
  combatFolder.addButton({
    title: '对自己造成伤害',
  }).on('click', () => {
    this.takeDamage(testParams.damage, new THREE.Vector3(1, 0, 0))
  })
}
```

**Step 2: Commit**
```bash
git add src/js/world/player/player.js
git commit -m "feat(debug): add combat system debug panel"
```

---

## Summary of Fixes

| 问题 | 修复方案 |
|---|---|
| 共享材质Bug | 使用 `material.clone()` 确保每个实例独立 |
| 玩家朝向错误 | 使用 `this.movement.facingAngle` 而非 `config.facingAngle` |
| 缺少攻击冷却 | 添加 `attackCooldown` 系统，500ms 间隔 |
| 僵尸攻击逻辑错误 | 使用 `hasDealtDamage` 标记确保每周期只触发一次伤害 |
| 缺少无敌帧 | 添加 `isInvulnerable` 和 1秒无敌时间 |
| 缺少死亡处理 | 添加 `die()` 方法自动重生并恢复血量 |
| 击退物理不完善 | 添加 `applyKnockback()` 方法统一处理 |

---

## Testing Checklist

- [ ] Player can punch zombies with Z/X keys
- [ ] Attack has 500ms cooldown (no spam)
- [ ] Zombies flash red when hit (only that zombie)
- [ ] Zombies get knocked back on hit
- [ ] Zombie dies after 4 hits (20 health / 5 damage)
- [ ] Zombie attacks player when in range
- [ ] Player takes damage and flashes red
- [ ] Player has 1-second invulnerability after being hit
- [ ] Player respawns when health reaches 0
- [ ] Health is restored to full on respawn

(End of file - total 400 lines)
