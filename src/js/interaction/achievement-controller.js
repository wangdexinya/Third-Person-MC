import { useAchievementStore } from '../../pinia/achievementStore.js'
import emitter from '../utils/event/event-bus.js'

export default class AchievementController {
  constructor() {
    this.store = useAchievementStore()
    this.playTime = 0
    this.hasUnlockedPlayTime = false
    this.setupListeners()
  }

  setupListeners() {
    emitter.once('game:create_world', () => this.store.unlock('first_world'))
    emitter.once('game:reset_world', () => this.store.unlock('first_world'))
    emitter.once('input:jump', () => this.store.unlock('first_jump'))
    emitter.once('input:punch_straight', () => this.store.unlock('first_punch'))
    emitter.once('input:punch_hook', () => this.store.unlock('first_punch'))
    emitter.once('input:telescope', () => this.store.unlock('first_zoom'))
    emitter.once('input:camera_shoulder_left', () => this.store.unlock('first_perspective'))
    emitter.once('input:camera_shoulder_right', () => this.store.unlock('first_perspective'))
    emitter.once('ui:chat-opened', () => this.store.unlock('first_chat'))
    emitter.once('player:block_break', () => this.store.unlock('first_mine'))
    emitter.once('player:block_place', () => this.store.unlock('first_place'))
    emitter.once('player:damage_enemy', () => this.store.unlock('first_damage_enemy'))
    emitter.once('player:take_damage', () => this.store.unlock('first_hurt'))

    // Listen for sprint/run in input update and unbind once achieved
    const onInputUpdate = (keys) => {
      if (keys.shift && (keys.forward || keys.backward || keys.left || keys.right)) {
        this.store.unlock('first_run')
        emitter.off('input:update', onInputUpdate)
      }
    }
    emitter.on('input:update', onInputUpdate)
  }

  update(dt) {
    if (!this.hasUnlockedPlayTime) {
      this.playTime += dt
      if (this.playTime > 5 * 60 * 1000) { // 5 minutes in ms
        this.store.unlock('play_5_mins')
        this.hasUnlockedPlayTime = true
      }
    }
  }
}
