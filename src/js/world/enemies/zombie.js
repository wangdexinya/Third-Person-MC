import * as THREE from 'three'
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js'
import Experience from '../../experience.js'
import { ZombieAnimationController } from './zombie-animation.js'
import { ZombieMovementController } from './zombie-movement-controller.js'

export const ZombieState = {
  IDLE: 'idle',
  WANDER: 'wander',
  CHASE: 'chase',
  ATTACK: 'attack',
}

export default class Zombie {
  constructor({ collision } = {}) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.resources = this.experience.resources
    this.player = this.experience.world?.player

    this.resource = this.resources.items.zombieModel
    this.state = ZombieState.IDLE
    this.health = 20
    this.isDead = false
    this.setModel()

    this.movement = new ZombieMovementController(this.group, { collision })
    this.animation = new ZombieAnimationController(this.model, this.resource.animations)
  }

  setModel() {
    // Clone the scene to allow multiple zombies (SkeletonUtils preserves skeleton bindings)
    this.model = SkeletonUtils.clone(this.resource.scene)

    // Create a group to handle positioning
    this.group = new THREE.Group()
    this.group.add(this.model)
    this.scene.add(this.group)
  }

  setSafeSpawn(x, z) {
    const provider = this.experience.terrainDataManager
    let targetX = Math.floor(x)
    let targetZ = Math.floor(z)
    let groundY = provider?.getTopSolidYWorld?.(targetX, targetZ)

    if (groundY === null || groundY === undefined) {
      if (this.player && this.player.movement) {
        targetX = Math.floor(this.player.movement.position.x)
        targetZ = Math.floor(this.player.movement.position.z)
        groundY = provider?.getTopSolidYWorld?.(targetX, targetZ)
      }
    }

    this.group.position.set(targetX, (groundY ?? 80) + 1.5, targetZ)
    if (this.movement) {
      this.movement.position.copy(this.group.position)
      this.movement.worldVelocity.set(0, 0, 0)
    }
  }

  takeDamage(amount) {
    this.health -= amount

    // Flash Red - clone materials to avoid affecting other zombies
    this.model.traverse((child) => {
      if (child.isMesh && child.material) {
        // Clone material on first hit
        if (!child.userData.isCloned) {
          child.userData.originalMaterial = child.material
          child.material = child.material.clone()
          child.userData.isCloned = true
        }
        // Save current color for restore
        if (!child.userData.flashOriginalColor) {
          child.userData.flashOriginalColor = child.material.color.clone()
        }
        child.material.color.setHex(0xFF5555)
      }
    })

    // Restore color after 200ms
    setTimeout(() => {
      if (!this.model)
        return
      this.model.traverse((child) => {
        if (child.isMesh && child.material && child.userData.flashOriginalColor) {
          child.material.color.copy(child.userData.flashOriginalColor)
        }
      })
    }, 200)

    // Knockback
    if (this.movement) {
      // 根据受击时自身的面朝方向，向后小幅击退
      const rot = this.group.rotation.y
      const backDir = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot)).normalize()
      // 参数：方向, 水平击退力, 垂直击退力
      this.movement.applyKnockback(backDir, 4, 3)
    }

    if (this.health <= 0) {
      this.die()
    }
  }

  /**
   * Play death animation then destroy after it finishes
   */
  die() {
    if (this.isDead)
      return
    this.isDead = true

    // Stop movement
    if (this.movement) {
      this.movement.worldVelocity.set(0, 0, 0)
    }

    // Play death animation
    const duration = this.animation?.playDeath() ?? 0

    // Destroy after animation finishes
    setTimeout(() => {
      // Remove from EnemyManager right before destroy
      const enemyManager = this.experience.world?.enemyManager
      if (enemyManager) {
        const idx = enemyManager.activeEnemies.indexOf(this)
        if (idx !== -1)
          enemyManager.activeEnemies.splice(idx, 1)
      }
      this.destroy()
    }, duration * 1000 + 200) // small buffer
  }

  update() {
    if (this.isDead) {
      // Only update animation mixer during death
      if (this.animation) {
        this.animation.update(this.time.delta * 0.001, this.state)
      }
      return
    }

    // Lazy load player
    if (!this.player) {
      this.player = this.experience.world?.player
    }

    const prevState = this.state
    if (this.player && this.player.movement) {
      this.state = this.movement.update(this.player.movement.position, this.state)
      if (this.movement.needsRespawn) {
        this.setSafeSpawn(this.movement.position.x, this.movement.position.z)
        this.movement.needsRespawn = false
      }
    }

    // Trigger random attack animation when entering ATTACK state
    if (this.state === ZombieState.ATTACK && prevState !== ZombieState.ATTACK) {
      this.animation?.playRandomAttack()
    }

    if (this.animation) {
      this.animation.update(this.time.delta * 0.001, this.state)
    }
  }

  destroy() {
    if (this.isDestroyed)
      return
    this.isDestroyed = true

    this.scene.remove(this.group)
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        // Dispose cloned materials but NOT textures (shared with original resource)
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          }
          else {
            child.material.dispose()
          }
        }
      }
    })
    if (this.animation?.mixer) {
      this.animation.mixer.stopAllAction()
      this.animation.mixer.uncacheRoot(this.model)
    }
    this.group = null
    this.model = null
    this.movement = null
    this.animation = null
  }
}
