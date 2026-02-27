import * as THREE from 'three'
import Experience from '../../experience.js'
import EntityCollisionSystem from '../entity-collision.js'
import { ZombieState } from './zombie.js'

export class ZombieMovementController {
  constructor(zombieGroup) {
    this.experience = new Experience()
    this.group = zombieGroup

    this.walkSpeed = 1.3
    this.runSpeed = 3.5
    this.gravity = -9.81 * 0.7
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
    this.wanderTimer = 0
    this.wanderDirection = new THREE.Vector3()
  }

  update(playerPos, currentState) {
    const dt = this.experience.time.delta * 0.001
    this.collision.prepareFrame()

    this.attackCooldown -= dt
    this.wanderTimer -= dt

    // 1. Calculate direction and distance to player
    const directionToPlayer = new THREE.Vector3().subVectors(playerPos, this.position)
    directionToPlayer.y = 0 // Ignore height for horizontal movement
    const distanceToPlayer = directionToPlayer.length()

    let newState = currentState

    // 2. Determine State based on distance and cooldown
    if (currentState === ZombieState.IDLE || currentState === ZombieState.WANDER) {
      if (distanceToPlayer <= this.ATTACK_RANGE && this.attackCooldown <= 0) {
        newState = ZombieState.ATTACK
        this.attackCooldown = 1.0
      }
      else if (distanceToPlayer <= this.AGGRO_RANGE && distanceToPlayer > this.ATTACK_RANGE) {
        newState = ZombieState.CHASE
      }
      else {
        // Wander logic: switch between IDLE and WANDER randomly
        if (this.wanderTimer <= 0) {
          if (Math.random() < 0.5) {
            newState = ZombieState.IDLE
            this.wanderTimer = 2.0 + Math.random() * 3.0 // Idle for 2-5s
          }
          else {
            newState = ZombieState.WANDER
            this.wanderTimer = 2.0 + Math.random() * 3.0 // Walk for 2-5s
            const angle = Math.random() * Math.PI * 2
            this.wanderDirection.set(Math.sin(angle), 0, Math.cos(angle))
          }
        }
      }
    }
    else if (currentState === ZombieState.CHASE || currentState === ZombieState.ATTACK) {
      if (distanceToPlayer > this.LOSE_AGGRO_RANGE) {
        newState = ZombieState.IDLE
      }
      else if (distanceToPlayer <= this.ATTACK_RANGE) {
        if (this.attackCooldown <= 0) {
          newState = ZombieState.ATTACK
          this.attackCooldown = 1.0
        }
        else {
          newState = ZombieState.IDLE
        }
      }
      else {
        newState = ZombieState.CHASE
      }
    }

    // 3. Apply Velocity based on State
    if (newState === ZombieState.CHASE) {
      directionToPlayer.normalize()
      this.worldVelocity.x = directionToPlayer.x * this.runSpeed
      this.worldVelocity.z = directionToPlayer.z * this.runSpeed

      // Rotate model to face player
      const angle = Math.atan2(directionToPlayer.x, directionToPlayer.z)
      this.group.rotation.y = angle
    }
    else if (newState === ZombieState.WANDER) {
      this.worldVelocity.x = this.wanderDirection.x * this.walkSpeed
      this.worldVelocity.z = this.wanderDirection.z * this.walkSpeed

      // Rotate model to walk direction
      const angle = Math.atan2(this.wanderDirection.x, this.wanderDirection.z)
      this.group.rotation.y = angle
    }
    else {
      // IDLE or ATTACK -> Stop moving
      this.worldVelocity.x = 0
      this.worldVelocity.z = 0

      // Still face the player if attacking or idle in range
      if ((newState === ZombieState.ATTACK || (newState === ZombieState.IDLE && distanceToPlayer <= this.ATTACK_RANGE)) && distanceToPlayer > 0) {
        const angle = Math.atan2(directionToPlayer.x, directionToPlayer.z)
        this.group.rotation.y = angle
      }
    }

    // 4. Gravity
    this.worldVelocity.y += this.gravity * dt

    // 5. Collision Resolution & Obstacle Jumping
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

      // Obstacle Jumping: 借助 collision 的粗判断，如果前方有障碍（超过10个方块候选）则跳跃
      if (this.isGrounded && (newState === ZombieState.CHASE || newState === ZombieState.WANDER)) {
        const dir = new THREE.Vector3(this.worldVelocity.x, 0, this.worldVelocity.z)

        if (dir.lengthSq() > 0.01 && candidates.length > 10) {
          // console.log(true)

          this.worldVelocity.y = 3.5// Jump velocity
          playerState.worldVelocity.y = 3.5
          this.isGrounded = false
          playerState.isGrounded = false

          // 根据新的跳跃速度重新计算下一帧位置
          nextPosition.copy(this.position).addScaledVector(this.worldVelocity, dt)
          playerState.basePosition.copy(nextPosition)
          playerState.center.copy(nextPosition).add(this.capsule.offset)
        }
      }

      const collisions = this.collision.narrowPhase(candidates, playerState)
      this.collision.resolveCollisions(collisions, playerState)

      if (collisions.length >= 13 || playerState.basePosition.y < -10) {
        this.needsRespawn = true
      }
    }

    this.isGrounded = playerState.isGrounded
    this.position.copy(playerState.basePosition)
    this.worldVelocity.copy(playerState.worldVelocity)

    return newState // Return updated state to Zombie class
  }
}
