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
  constructor() {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.time = this.experience.time
    this.resources = this.experience.resources
    // world depends on initialization order, but experience.world might be accessed here
    // It's better to fetch player lazily in update if world isn't fully built yet
    this.player = this.experience.world?.player

    this.resource = this.resources.items.zombieModel
    this.state = ZombieState.IDLE
    this.health = 20
    this.setModel()

    this.movement = new ZombieMovementController(this.group)
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
    if (this.health <= 0) {
      this.destroy()
    }
  }

  update() {
    // Lazy load player
    if (!this.player) {
      this.player = this.experience.world?.player
    }

    if (this.player && this.player.movement) {
      this.state = this.movement.update(this.player.movement.position, this.state)
      if (this.movement.needsRespawn) {
        this.setSafeSpawn(this.movement.position.x, this.movement.position.z)
        this.movement.needsRespawn = false
      }
    }

    if (this.animation) {
      this.animation.update(this.time.delta * 0.001, this.state)
    }
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
