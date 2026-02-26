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
    const distanceToPlayer = direction.length()

    let newState = currentState

    // 2. Determine State based on distance and cooldown
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
        this.attackCooldown = 1.0 // 1 second between attacks
      }
      else if (distanceToPlayer > this.ATTACK_RANGE) {
        newState = ZombieState.CHASE
      }
      else {
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

    // 4. Obstacle Jumping (Task 5)
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

    // 5. Gravity
    this.worldVelocity.y += this.gravity * dt

    // 6. Collision Resolution
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
    if (provider) {
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
