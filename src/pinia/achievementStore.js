import { defineStore } from 'pinia'

// Definitions of all achievements
export const ACHIEVEMENTS = [
  { id: 'first_world', iconPath: '/img/achievement/first_world.png' },
  { id: 'first_punch', iconPath: '/img/achievement/first_punch.png' },
  { id: 'first_run', iconPath: '/img/achievement/first_run.png' },
  { id: 'first_jump', iconPath: '/img/achievement/first_jump.png' },
  { id: 'first_zoom', iconPath: '/img/achievement/first_zoom.png' },
  { id: 'first_perspective', iconPath: '/img/achievement/first_perspective.png' },
  { id: 'first_chat', iconPath: '/img/achievement/first_chat.png' },
  { id: 'first_mine', iconPath: '/img/achievement/first_mine.png' },
  { id: 'first_place', iconPath: '/img/achievement/first_place.png' },
  { id: 'first_damage_enemy', iconPath: '/img/achievement/first_damage_enemy.png' },
  { id: 'first_hurt', iconPath: '/img/achievement/first_hurt.png' },
  { id: 'play_5_mins', iconPath: '/img/achievement/play_5_mins.png' },
  { id: 'hiker', iconPath: '/img/achievement/hiker.png' },
  { id: 'rage_quit', iconPath: '/img/achievement/rage_quit.png' },
  { id: 'who_am_i', iconPath: '/img/achievement/who_am_i.png' },
  { id: 'first_rear_view', iconPath: '/img/achievement/look_back.png' },
]

export const useAchievementStore = defineStore('achievement', {
  state: () => ({
    unlocked: {}, // { achievement_id: timestamp }
    activeToasts: [],
  }),
  actions: {
    unlock(id) {
      const achievement = ACHIEVEMENTS.find(a => a.id === id)
      if (!this.unlocked[id] && achievement) {
        this.unlocked[id] = Date.now()
        this.showToast(achievement)
      }
    },
    showToast(achievement) {
      const instanceId = Date.now() + Math.random()
      const toast = { ...achievement, instanceId }
      this.activeToasts.push(toast)

      setTimeout(() => {
        this.activeToasts = this.activeToasts.filter(t => t.instanceId !== instanceId)
      }, 5000)

      if (this.isAllUnlocked) {
        // Optionally emit something for Popup
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('achievement:all_unlocked'))
        }, 5500)
      }
    },
    reset() {
      this.unlocked = {}
      this.activeToasts = []
    },
  },
  getters: {
    isAllUnlocked: (state) => {
      return Object.keys(state.unlocked).length >= ACHIEVEMENTS.length
    },
  },
})
