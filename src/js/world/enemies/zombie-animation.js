import * as THREE from 'three'
import { ZombieState } from './zombie.js'

export class ZombieAnimationController {
  constructor(model, animations) {
    this.mixer = new THREE.AnimationMixer(model)
    this.actions = {}
    
    // Map existing Steve animations to Zombie actions
    animations.forEach(clip => {
        const name = clip.name.toLowerCase()
        if(name.includes('run') || name.includes('walk')) {
            this.actions[ZombieState.CHASE] = this.mixer.clipAction(clip)
        }
        if(name.includes('idle')) {
            this.actions[ZombieState.IDLE] = this.mixer.clipAction(clip)
        }
        if(name.includes('punch') || name.includes('attack')) {
            this.actions[ZombieState.ATTACK] = this.mixer.clipAction(clip)
        }
    })
    
    // Default fallback
    this.currentAction = this.actions[ZombieState.IDLE]
    if(this.currentAction) this.currentAction.play()
  }

  update(dt, state) {
    this.mixer.update(dt)
    
    // Play animation corresponding to current state
    const targetAction = this.actions[state] || this.actions[ZombieState.IDLE]
    
    if (targetAction && this.currentAction !== targetAction) {
        if(this.currentAction) this.currentAction.fadeOut(0.2)
        targetAction.reset().fadeIn(0.2).play()
        this.currentAction = targetAction
    }
  }
}