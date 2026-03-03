import * as THREE from 'three'
import { ZombieState } from './zombie.js'

export class ZombieAnimationController {
  constructor(model, animations) {
    this.mixer = new THREE.AnimationMixer(model)
    this.actions = {}
    this.attackActions = [] // Store multiple attack animations
    this.deathAction = null
    this.isDying = false

    // Map existing or imported animations to Zombie actions
    animations.forEach((clip) => {
      const name = clip.name.toLowerCase()

      if (name === 'zombie_death') {
        const action = this.mixer.clipAction(clip)
        action.setLoop(THREE.LoopOnce)
        action.clampWhenFinished = true
        this.deathAction = action
      }
      else if (name.includes('run')) {
        const action = this.mixer.clipAction(clip)
        action.setEffectiveTimeScale(1.7)
        this.actions[ZombieState.CHASE] = action
      }
      else if (name.includes('walk')) {
        const action = this.mixer.clipAction(clip)
        action.setEffectiveTimeScale(3)
        this.actions[ZombieState.WANDER] = action
      }
      else if (name === 'zombie_idle') {
        const action = this.mixer.clipAction(clip)
        action.setEffectiveTimeScale(3.0)
        this.actions[ZombieState.IDLE] = action
      }
      else if (name.includes('attack')) {
        const action = this.mixer.clipAction(clip)
        action.setEffectiveTimeScale(2.2)
        this.attackActions.push(action)
      }
    })

    // Set default attack action (first one) for state-based fallback
    if (this.attackActions.length > 0) {
      this.actions[ZombieState.ATTACK] = this.attackActions[0]
    }

    // Pseudo-random toggle index for attack variety
    this._attackIndex = 0

    // Default fallback
    this.currentAction = this.actions[ZombieState.IDLE]
    if (this.currentAction)
      this.currentAction.play()
  }

  /**
   * Play a pseudo-random attack animation (alternates between available attacks)
   */
  playRandomAttack() {
    if (this.attackActions.length === 0)
      return
    const action = this.attackActions[this._attackIndex % this.attackActions.length]
    this._attackIndex++
    this.actions[ZombieState.ATTACK] = action
  }

  /**
   * Play death animation and return its duration for delayed cleanup
   * @returns {number} duration in seconds (0 if no death animation)
   */
  playDeath() {
    if (!this.deathAction)
      return 0
    this.isDying = true

    // Fade out current action, play death
    if (this.currentAction) {
      this.currentAction.fadeOut(0.2)
    }
    this.deathAction.reset().fadeIn(0.2).play()
    this.currentAction = this.deathAction

    return this.deathAction.getClip().duration / this.deathAction.getEffectiveTimeScale()
  }

  update(dt, state) {
    this.mixer.update(dt)

    // Don't switch animations while dying
    if (this.isDying)
      return

    // Play animation corresponding to current state
    const targetAction = this.actions[state] || this.actions[ZombieState.IDLE]

    if (targetAction && this.currentAction !== targetAction) {
      if (this.currentAction)
        this.currentAction.fadeOut(0.2)
      targetAction.reset().fadeIn(0.2).play()
      this.currentAction = targetAction
    }
  }
}
