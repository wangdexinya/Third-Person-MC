import * as THREE from 'three'
import Experience from '../../experience.js'
import { calculateKnockbackDir, isInAttackBox } from '../../utils/combat-utils.js'
import { ZombieState } from './zombie.js'

export class ZombieMovementController {
  constructor(zombieGroup, { collision } = {}) {
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

    // Use shared collision system (injected from EnemyManager)
    this.collision = collision
    this.terrainProvider = this.experience.terrainDataManager

    // Distances
    this.AGGRO_RANGE = 20.0
    this.LOSE_AGGRO_RANGE = 25.0
    this.ATTACK_RANGE = 1.5

    this.attackCooldown = 0
    this.wanderTimer = 0
    this.wanderDirection = new THREE.Vector3()
    this.hasDealtDamage = false // Track if damage was dealt this attack cycle

    this.knockbackVelocity = new THREE.Vector3()
    this.knockbackTimer = 0

    // Zombie attack box config (width x depth)
    this.attackBoxWidth = 2.0
    this.attackBoxDepth = 1.0

    // Pre-allocated temp vectors to avoid per-frame GC pressure
    this._tempDir = new THREE.Vector3()
    this._tempNextPos = new THREE.Vector3()
    this._tempCenter = new THREE.Vector3()
    this._tempObstacleDir = new THREE.Vector3()

    // Pre-allocated player state object (reused every frame)
    this._playerState = {
      basePosition: new THREE.Vector3(),
      center: new THREE.Vector3(),
      halfHeight: this.capsule.halfHeight,
      radius: this.capsule.radius,
      worldVelocity: this.worldVelocity,
      isGrounded: false,
    }
  }

  applyKnockback(direction, horizontalForce = 3, verticalForce = 3) {
    // 强制脱离地面，允许抛物线运动
    if (verticalForce > 0) {
      this.isGrounded = false
      this.worldVelocity.y = verticalForce
    }
    this.knockbackVelocity.set(
      direction.x * horizontalForce,
      0, // verticalForce is handled by worldVelocity.y
      direction.z * horizontalForce,
    )
    this.knockbackTimer = 0.25 // 250ms knockback state
  }

  update(playerPos, currentState) {
    const dt = this.experience.time.delta * 0.001
    if (!this.collision)
      return currentState

    this.collision.prepareFrame()

    this.attackCooldown -= dt
    this.wanderTimer -= dt

    // 1. Calculate direction and distance to player (reuse temp vector)
    const directionToPlayer = this._tempDir.subVectors(playerPos, this.position)
    directionToPlayer.y = 0
    const distanceToPlayer = directionToPlayer.length()

    let newState = currentState

    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= dt
      this.worldVelocity.x = this.knockbackVelocity.x
      this.worldVelocity.z = this.knockbackVelocity.z

      // Apply friction to knockback
      this.knockbackVelocity.multiplyScalar(0.9)
    }
    else {
      // 2. Determine State based on distance and cooldown
      if (currentState === ZombieState.IDLE || currentState === ZombieState.WANDER) {
        if (distanceToPlayer <= this.ATTACK_RANGE && this.attackCooldown <= 0) {
          newState = ZombieState.ATTACK
          this.attackCooldown = 1.0
          this.hasDealtDamage = false // New attack cycle

          // Update rotation immediately before attacking
          if (distanceToPlayer > 0) {
            const angle = Math.atan2(directionToPlayer.x, directionToPlayer.z)
            this.group.rotation.y = angle
          }

          // Deal damage immediately on entering ATTACK (using box check)
          const player = this.experience.world?.player
          if (player) {
            const rot = this.group.rotation.y
            const fwd = { x: Math.sin(rot), z: Math.cos(rot) }
            if (isInAttackBox(this.position, fwd, player.movement.position, this.attackBoxWidth, this.attackBoxDepth)) {
              const knockbackDir = calculateKnockbackDir(this.position, player.movement.position)
              player.takeDamage(2, knockbackDir)
            }
          }
          this.hasDealtDamage = true
        }
        else if (distanceToPlayer <= this.AGGRO_RANGE && distanceToPlayer > this.ATTACK_RANGE) {
          newState = ZombieState.CHASE
        }
        else {
          if (this.wanderTimer <= 0) {
            if (Math.random() < 0.5) {
              newState = ZombieState.IDLE
              this.wanderTimer = 2.0 + Math.random() * 3.0
            }
            else {
              newState = ZombieState.WANDER
              this.wanderTimer = 2.0 + Math.random() * 3.0
              const angle = Math.random() * Math.PI * 2
              this.wanderDirection.set(Math.sin(angle), 0, Math.cos(angle))
            }
          }
        }
      }
      else if (currentState === ZombieState.ATTACK) {
      // 攻击尚未结束 — 保持 ATTACK 状态，等冷却走完再允许转换
        if (this.attackCooldown > 0) {
          newState = ZombieState.ATTACK
        }
        else if (distanceToPlayer > this.LOSE_AGGRO_RANGE) {
          newState = ZombieState.IDLE
          this.hasDealtDamage = false
        }
        else if (distanceToPlayer <= this.ATTACK_RANGE) {
          newState = ZombieState.ATTACK
          this.attackCooldown = 1.0

          // Update rotation immediately before attacking
          if (distanceToPlayer > 0) {
            const angle = Math.atan2(directionToPlayer.x, directionToPlayer.z)
            this.group.rotation.y = angle
          }

          // Deal damage once per new attack cycle (using box check)
          if (!this.hasDealtDamage) {
            const player = this.experience.world?.player
            if (player) {
              const rot = this.group.rotation.y
              const fwd = { x: Math.sin(rot), z: Math.cos(rot) }
              if (isInAttackBox(this.position, fwd, player.movement.position, this.attackBoxWidth, this.attackBoxDepth)) {
                const knockbackDir = calculateKnockbackDir(this.position, player.movement.position)
                player.takeDamage(2, knockbackDir)
              }
            }
            this.hasDealtDamage = true
          }
        }
        else {
          newState = ZombieState.CHASE
          this.hasDealtDamage = false
        }
      }
      else if (currentState === ZombieState.CHASE) {
        if (distanceToPlayer > this.LOSE_AGGRO_RANGE) {
          newState = ZombieState.IDLE
        }
        else if (distanceToPlayer <= this.ATTACK_RANGE && this.attackCooldown <= 0) {
          newState = ZombieState.ATTACK
          this.attackCooldown = 1.0
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

        const angle = Math.atan2(directionToPlayer.x, directionToPlayer.z)
        this.group.rotation.y = angle
      }
      else if (newState === ZombieState.WANDER) {
        this.worldVelocity.x = this.wanderDirection.x * this.walkSpeed
        this.worldVelocity.z = this.wanderDirection.z * this.walkSpeed

        const angle = Math.atan2(this.wanderDirection.x, this.wanderDirection.z)
        this.group.rotation.y = angle
      }
      else {
        this.worldVelocity.x = 0
        this.worldVelocity.z = 0

        if ((newState === ZombieState.ATTACK || (newState === ZombieState.IDLE && distanceToPlayer <= this.ATTACK_RANGE)) && distanceToPlayer > 0) {
          const angle = Math.atan2(directionToPlayer.x, directionToPlayer.z)
          this.group.rotation.y = angle
        }
      }
    }

    // 4. Gravity
    this.worldVelocity.y += this.gravity * dt

    // 5. Collision Resolution & Obstacle Jumping (reuse pre-allocated objects)
    const nextPosition = this._tempNextPos.copy(this.position).addScaledVector(this.worldVelocity, dt)
    const ps = this._playerState
    ps.basePosition.copy(nextPosition)
    ps.center.copy(nextPosition).add(this.capsule.offset)
    ps.worldVelocity = this.worldVelocity
    ps.isGrounded = this.isGrounded

    const provider = this.experience.terrainDataManager || this.terrainProvider
    if (provider) {
      const candidates = this.collision.broadPhase(ps, provider)

      // Obstacle Jumping
      if (this.isGrounded && (newState === ZombieState.CHASE || newState === ZombieState.WANDER)) {
        const dir = this._tempObstacleDir.set(this.worldVelocity.x, 0, this.worldVelocity.z)

        if (dir.lengthSq() > 0.01 && candidates.length > 10) {
          this.worldVelocity.y = 3.5
          ps.worldVelocity.y = 3.5
          this.isGrounded = false
          ps.isGrounded = false

          nextPosition.copy(this.position).addScaledVector(this.worldVelocity, dt)
          ps.basePosition.copy(nextPosition)
          ps.center.copy(nextPosition).add(this.capsule.offset)
        }
      }

      const collisions = this.collision.narrowPhase(candidates, ps)
      this.collision.resolveCollisions(collisions, ps)

      if (collisions.length >= 13 || ps.basePosition.y < -10) {
        this.needsRespawn = true
      }
    }

    this.isGrounded = ps.isGrounded
    this.position.copy(ps.basePosition)
    this.worldVelocity.copy(ps.worldVelocity)

    return newState
  }
}
