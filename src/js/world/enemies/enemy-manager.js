import * as THREE from 'three'
import Experience from '../../experience.js'
import EntityCollisionSystem from '../entity-collision.js'
import Zombie, { ZombieState } from './zombie.js'

export default class EnemyManager {
  constructor() {
    this.experience = new Experience()
    this.world = this.experience.world
    this.time = this.experience.time
    this.player = this.world?.player

    this.activeEnemies = []

    // Shared collision system for all zombies (avoids duplicating GPU debug resources)
    this.sharedCollision = new EntityCollisionSystem()

    this.config = {
      maxZombies: 3,
      spawnInterval: 5.0, // seconds
      spawnRadiusMin: 25,
      spawnRadiusMax: 45,
      despawnRadius: 60,
    }

    this.spawnTimer = 0
    this.gazeIntensity = 0 // Lerped value
    this.targetGazeIntensity = 0
  }

  update() {
    const dt = this.time.delta * 0.001
    if (!this.player) {
      this.player = this.experience.world?.player
      return
    }

    this._handleSpawningAndDespawning(dt)
    this._updateEnemiesAndCalculateGaze()
    this._updateGazeShader(dt)
  }

  _handleSpawningAndDespawning(dt) {
    const playerPos = this.player.movement.position

    // Check night via DayCycle phase
    const dayCycle = this.world?.environment?.dayCycle
    const phase = dayCycle?._getPhaseInfo()?.phase ?? 'noon'
    const isNight = phase === 'midnight' || phase === 'dusk' || phase === 'sunset'

    // Despawn check
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      const zombie = this.activeEnemies[i]
      const dist = zombie.movement.position.distanceTo(playerPos)

      if (!isNight || dist > this.config.despawnRadius) {
        zombie.destroy()
        this.activeEnemies.splice(i, 1)
      }
    }

    // Spawn check
    if (isNight && this.activeEnemies.length < this.config.maxZombies) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.config.spawnInterval
        this._attemptSpawn(playerPos)
      }
    }
  }

  _attemptSpawn(playerPos) {
    const angle = Math.random() * Math.PI * 2
    const radius = this.config.spawnRadiusMin + Math.random() * (this.config.spawnRadiusMax - this.config.spawnRadiusMin)

    const spawnX = playerPos.x + Math.cos(angle) * radius
    const spawnZ = playerPos.z + Math.sin(angle) * radius

    const zombie = new Zombie({ collision: this.sharedCollision })
    zombie.setSafeSpawn(spawnX, spawnZ)
    this.activeEnemies.push(zombie)
  }

  _updateEnemiesAndCalculateGaze() {
    let maxThreat = 0

    for (const zombie of this.activeEnemies) {
      zombie.update()

      // Calculate threat for Gaze effect
      if (zombie.state === ZombieState.CHASE || zombie.state === ZombieState.ATTACK) {
        const dist = zombie.movement.position.distanceTo(this.player.movement.position)
        // Threat formula: 1.0 at 3 blocks, 0.0 at 20 blocks
        let threat = 1.0 - ((dist - 3.0) / 17.0)
        threat = THREE.MathUtils.clamp(threat, 0.0, 1.0)
        if (threat > maxThreat) {
          maxThreat = threat
        }
      }
    }

    this.targetGazeIntensity = maxThreat
  }

  _updateGazeShader(dt) {
    // Smooth Lerp for visual stability
    this.gazeIntensity = THREE.MathUtils.lerp(this.gazeIntensity, this.targetGazeIntensity, dt * 5.0)

    if (this.experience.renderer && this.experience.renderer.gazePass) {
      this.experience.renderer.gazePass.uniforms.uIntensity.value = this.gazeIntensity
      // Update config for debug UI sync
      this.experience.renderer.postProcessConfig.gaze.intensity = this.gazeIntensity
    }
  }

  destroy() {
    for (const zombie of this.activeEnemies) {
      zombie.destroy()
    }
    this.activeEnemies = []
    this.sharedCollision = null
  }
}
