import * as THREE from 'three'
import { ZombieState } from './zombie.js'

export class ZombieAnimationController {
  constructor(model, animations) {
    this.mixer = new THREE.AnimationMixer(model)
    this.actions = {}

    // Map existing or imported animations to Zombie actions
    animations.forEach((clip) => {
      const name = clip.name.toLowerCase()
      if (name.includes('run')) {
        const action = this.mixer.clipAction(clip)
        action.setEffectiveTimeScale(1.7)
        this.actions[ZombieState.CHASE] = action
      }
      else if (name.includes('walk')) {
        const action = this.mixer.clipAction(clip)
        action.setEffectiveTimeScale(3)
        this.actions[ZombieState.WANDER] = action
      }
      else if (name === 'zombieidle') {
        const action = this.mixer.clipAction(clip)
        action.setEffectiveTimeScale(3.0)
        this.actions[ZombieState.IDLE] = action
      }
      else if (name.includes('attack')) {
        const action = this.mixer.clipAction(clip)
        action.setEffectiveTimeScale(2.2)
        // Set the latest attack to ZombieState.ATTACK. It could be attack1 or attack2.
        this.actions[ZombieState.ATTACK] = action
      }
    })

    // Default fallback
    this.currentAction = this.actions[ZombieState.IDLE]
    if (this.currentAction)
      this.currentAction.play()
  }

  update(dt, state) {
    this.mixer.update(dt)

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
