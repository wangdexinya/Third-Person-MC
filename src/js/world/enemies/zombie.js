import * as THREE from 'three'
import Experience from '../../experience.js'
import { ZombieMovementController } from './zombie-movement-controller.js'
import { ZombieAnimationController } from './zombie-animation.js'

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
    // Lazy load player
    if (!this.player) {
      this.player = this.experience.world?.player
    }
    
    if (this.player && this.player.movement) {
        this.state = this.movement.update(this.player.movement.position, this.state)
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