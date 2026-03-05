# Achievement System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a fully-fledged achievement system with image icons, a dedicated UI menu, i18n support, and toast notifications. Reset progress when creating a new world. 

**Architecture:** Use Pinia `achievementStore.js` to manage unlocked achievements. UI layer listens and displays 5-sec toasts (`AchievementToast.vue`). A new `AchievementMenu.vue` displays all achievements and their unlock status using Minecraft-style UI. Everything is fully localized using `vue-i18n`.

**Tech Stack:** Vue 3, Pinia, GSAP, Mitt, vue-i18n.

---

### Task 1: Update Locales for Achievements

**Files:**
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

**Step 1: Write minimal implementation (en.json)**
Add inside `"ui": { "achievement": { ... } }`:
```json
    "achievement": {
      "first_world": { "title": "Welcome to New World", "desc": "Created your first world." },
      "first_punch": { "title": "First Strike", "desc": "Punched for the first time." },
      "first_run": { "title": "Feel the Wind", "desc": "Ran for the first time." },
      "first_jump": { "title": "Taking Off", "desc": "Jumped for the first time." },
      "first_zoom": { "title": "Looking Closely", "desc": "Zoomed in using telescope." },
      "first_perspective": { "title": "New Perspective", "desc": "Changed camera perspective." },
      "first_chat": { "title": "Hello World", "desc": "Opened the chat for the first time." },
      "first_mine": { "title": "Resource Gathering", "desc": "Mined your first block." },
      "first_place": { "title": "Building Block", "desc": "Placed your first block." },
      "first_damage_enemy": { "title": "Monster Hunter", "desc": "Damaged an enemy." },
      "first_hurt": { "title": "Ouch!", "desc": "Took damage for the first time." },
      "play_5_mins": { "title": "Getting into it", "desc": "Played for 5 minutes." },
      "menuTitle": "Achievements",
      "unlocked": "Unlocked",
      "locked": "Locked"
    }
```

**Step 2: Write minimal implementation (zh.json)**
Add inside `"ui": { "achievement": { ... } }`:
```json
    "achievement": {
      "first_world": { "title": "欢迎来到新世界", "desc": "第一次创建世界" },
      "first_punch": { "title": "初试风采", "desc": "第一次挥拳" },
      "first_run": { "title": "感受风的速度", "desc": "第一次奔跑" },
      "first_jump": { "title": "一跃而起", "desc": "第一次跳跃" },
      "first_zoom": { "title": "观察入微", "desc": "使用望远镜放大" },
      "first_perspective": { "title": "换个角度", "desc": "切换摄像机视角" },
      "first_chat": { "title": "尝试沟通", "desc": "第一次打开聊天框" },
      "first_mine": { "title": "第一手资源", "desc": "第一次破坏方块" },
      "first_place": { "title": "添砖加瓦", "desc": "第一次放置方块" },
      "first_damage_enemy": { "title": "初试锋芒", "desc": "第一次攻击敌人" },
      "first_hurt": { "title": "哎呦！", "desc": "第一次受到伤害" },
      "play_5_mins": { "title": "渐入佳境", "desc": "游玩时间超过 5 分钟" },
      "menuTitle": "成就系统",
      "unlocked": "已解锁",
      "locked": "未解锁"
    }
```

**Step 3: Commit**
```bash
git add src/locales/en.json src/locales/zh.json
git commit -m "feat: add i18n for achievements"
```

### Task 2: Create Achievement Store

**Files:**
- Create: `src/pinia/achievementStore.js`

**Step 1: Write minimal implementation**
```javascript
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
  { id: 'play_5_mins', iconPath: '/img/achievement/play_5_mins.png' }
]

export const useAchievementStore = defineStore('achievement', {
  state: () => ({
    unlocked: {}, // { achievement_id: timestamp }
    currentToast: null,
    toastQueue: []
  }),
  actions: {
    unlock(id) {
      const achievement = ACHIEVEMENTS.find(a => a.id === id)
      if (!this.unlocked[id] && achievement) {
        this.unlocked[id] = Date.now()
        this.queueToast(achievement)
      }
    },
    queueToast(achievement) {
      this.toastQueue.push(achievement)
      if (!this.currentToast) {
        this.showNextToast()
      }
    },
    showNextToast() {
      if (this.toastQueue.length > 0) {
        this.currentToast = this.toastQueue.shift()
        setTimeout(() => {
          this.currentToast = null
          setTimeout(() => this.showNextToast(), 500)
        }, 5000)
      } else {
        this.currentToast = null
      }
    },
    reset() {
      this.unlocked = {}
      this.currentToast = null
      this.toastQueue = []
    }
  }
})
```

**Step 2: Commit**
```bash
git add src/pinia/achievementStore.js
git commit -m "feat: create achievement store with image support and reset capability"
```

### Task 3: Create Achievement Toast UI Component

**Files:**
- Create: `src/vue/components/hud/AchievementToast.vue`
- Modify: `src/vue/components/hud/GameHud.vue`

**Step 1: Write AchievementToast.vue**
```vue
<script setup>
import { useAchievementStore } from '@pinia/achievementStore.js'
import { Transition } from 'vue'

const store = useAchievementStore()
</script>

<template>
  <div class="achievement-toast-container">
    <Transition name="slide-down">
      <div v-if="store.currentToast" class="achievement-toast">
        <img :src="store.currentToast.iconPath" class="icon" />
        <div class="content">
          <div class="title">Achievement Get!</div>
          <div class="name">{{ $t('ui.achievement.' + store.currentToast.id + '.title') }}</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.achievement-toast-container {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 1000;
  pointer-events: none;
}
.achievement-toast {
  display: flex;
  align-items: center;
  background-color: rgba(33, 33, 33, 0.9);
  border: 4px solid #555;
  border-radius: 2px;
  padding: 10px;
  color: white;
  box-shadow: 4px 4px 0px rgba(0,0,0,0.5);
  gap: 15px;
  min-width: 280px;
}
.icon {
  width: 48px;
  height: 48px;
  image-rendering: pixelated;
  flex-shrink: 0;
}
.content {
  display: flex;
  flex-direction: column;
}
.title {
  color: #fbff00;
  font-size: 14px;
  margin-bottom: 4px;
  text-shadow: 2px 2px 0 #000;
  font-family: 'MinecraftV2', 'Minecraftia', monospace;
}
.name {
  font-size: 16px;
  text-shadow: 2px 2px 0 #000;
  font-family: 'MinecraftV2', 'Minecraftia', monospace;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
```

**Step 2: Add to GameHud.vue**
```vue
<!-- Add to script setup imports -->
import AchievementToast from './AchievementToast.vue'

<!-- Add to template inside .hud-root -->
    <AchievementToast />
```

**Step 3: Commit**
```bash
git add src/vue/components/hud/AchievementToast.vue src/vue/components/hud/GameHud.vue
git commit -m "feat: add achievement toast with i18n and images"
```

### Task 4: Connect Achievements via Event Bus Listener

**Files:**
- Create: `src/js/interaction/achievement-controller.js`
- Modify: `src/js/world/world.js`

**Step 1: Write minimal implementation**
```javascript
/* src/js/interaction/achievement-controller.js */
import emitter from '../utils/event/event-bus.js'
import { useAchievementStore } from '../../pinia/achievementStore.js'

export default class AchievementController {
  constructor() {
    this.store = useAchievementStore()
    this.playTime = 0
    this.hasUnlockedPlayTime = false
    this.setupListeners()
  }

  setupListeners() {
    emitter.once('world:ready', () => this.store.unlock('first_world'))
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
```

**Step 2: Instantiate in World.js**
```javascript
/* src/js/world/world.js */
// IMPORT
import AchievementController from '../interaction/achievement-controller.js'

// INSTRUCTOR ADD (in init / constructor)
this.achievementController = new AchievementController()

// IN UPDATE ADD
if (this.achievementController) {
  this.achievementController.update(this.time.delta)
}
```

**Step 3: Commit**
```bash
git add src/js/interaction/achievement-controller.js src/js/world/world.js
git commit -m "feat: implement achievement controller emitting events to store"
```

### Task 5: Build Achievement Menu & Integrate UI Reset

**Files:**
- Modify: `src/pinia/uiStore.js`
- Create: `src/vue/components/menu/AchievementMenu.vue`
- Modify: `src/vue/components/menu/MainMenu.vue`
- Modify: `src/vue/components/menu/PauseMenu.vue`

**Step 1: Update uiStore.js**
Add `achievements` to `mainMenuView` states via navigation actions:
```javascript
  function toAchievements() {
    mainMenuView.value = 'achievements'
  }
  function exitAchievements() {
    if (screen.value === 'pauseMenu') {
      mainMenuView.value = 'root'
    } else {
      backToMainRoot()
    }
  }
```
And reset achievements on new world:
Inside `createWorld` and `resetWorld`:
```javascript
import { useAchievementStore } from './achievementStore.js'
// ...
  function createWorld(seed) {
    const achievementStore = useAchievementStore()
    achievementStore.reset()
    // ... setup world
```
Don't forget to add `toAchievements` and `exitAchievements` to the exported state object `return { ... }`.

**Step 2: Create AchievementMenu.vue**
```vue
<script setup>
import { useUiStore } from '@pinia/uiStore.js'
import { useAchievementStore, ACHIEVEMENTS } from '@pinia/achievementStore.js'

const ui = useUiStore()
const store = useAchievementStore()
</script>

<template>
  <div class="mc-menu achievement-menu">
    <h2 class="menu-title">{{ $t('ui.achievement.menuTitle') }}</h2>
    
    <div class="achievement-list">
      <div 
        v-for="achf in ACHIEVEMENTS" 
        :key="achf.id"
        class="achievement-item"
        :class="{ locked: !store.unlocked[achf.id] }"
      >
        <img :src="achf.iconPath" class="achf-icon" />
        <div class="achf-info">
          <h3 class="achf-title">{{ $t('ui.achievement.' + achf.id + '.title') }}</h3>
          <p class="achf-desc">{{ $t('ui.achievement.' + achf.id + '.desc') }}</p>
        </div>
        <div class="achf-status">
          {{ store.unlocked[achf.id] ? $t('ui.achievement.unlocked') : $t('ui.achievement.locked') }}
        </div>
      </div>
    </div>

    <button class="mc-button" @click="ui.exitAchievements()">
      <span class="title">{{ $t('menu.back') }}</span>
    </button>
  </div>
</template>

<style scoped>
.achievement-menu {
  width: min(800px, 92vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
.achievement-list {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
  padding-right: 10px;
}
.achievement-list::-webkit-scrollbar {
  width: 10px;
}
.achievement-list::-webkit-scrollbar-thumb {
  background: #aaa;
  border: 2px solid #333;
}
.achievement-list::-webkit-scrollbar-track {
  background: rgba(0,0,0,0.5);
}
.achievement-item {
  display: flex;
  background-color: rgba(33, 33, 33, 0.9);
  border: 4px solid #555;
  padding: 10px;
  align-items: center;
  gap: 15px;
}
.achievement-item.locked {
  opacity: 0.6;
}
.achievement-item.locked .achf-icon {
  filter: grayscale(100%);
}
.achf-icon {
  width: 64px;
  height: 64px;
  image-rendering: pixelated;
  flex-shrink: 0;
}
.achf-info {
  flex: 1;
  text-align: left;
}
.achf-title {
  color: #fbff00;
  margin: 0 0 5px 0;
  font-size: 16px;
  text-shadow: 2px 2px 0 #000;
  font-family: 'MinecraftV2', 'Minecraftia', monospace;
}
.achf-desc {
  color: #fff;
  margin: 0;
  font-size: 14px;
  text-shadow: 2px 2px 0 #000;
  font-family: 'MinecraftV2', 'Minecraftia', monospace;
}
.achf-status {
  font-weight: bold;
  color: #fff;
  font-size: 14px;
  text-shadow: 2px 2px 0 #000;
  font-family: 'MinecraftV2', 'Minecraftia', monospace;
  width: 80px;
  text-align: right;
  flex-shrink: 0;
}
</style>
```

**Step 3: Modify MainMenu.vue & PauseMenu.vue**

Add to MainMenu.vue script imports:
```vue
import AchievementMenu from './AchievementMenu.vue'
```
Add button to MainMenu `<template>` (both sections where menu exists, or wherever fits nicely next to other buttons like 'skins'/'howToPlay'):
```vue
        <button class="mc-button" @click="ui.toAchievements()">
          <span class="title">{{ $t('ui.achievement.menuTitle') }}</span>
        </button>
```
And add view condition to MainMenu:
```vue
    <!-- Achievement View -->
    <div v-else-if="ui.mainMenuView === 'achievements'">
       <AchievementMenu />
    </div>
```

Do the **same** exactly for `PauseMenu.vue` to allow viewing achievements mid-game. 
Also, don't forget to update `uiStore.js` `handleEscape` function so it can close `achievements` with ESC:
```javascript
        if (mainMenuView.value !== 'root') {
          if (mainMenuView.value === 'achievements') exitAchievements()
          else backToMainRoot()
        }
```

**Step 4: Commit**
```bash
git add src/pinia/uiStore.js src/vue/components/menu/AchievementMenu.vue src/vue/components/menu/MainMenu.vue src/vue/components/menu/PauseMenu.vue
git commit -m "feat: build achievement menu and reset system on start"
```

### Task 6: Manual Verification
1. Start the game via `pnpm dev`.
2. See "成就系统" / "Achievements" button in Main Menu. Click it, see listed achievements (Locked). Go back.
3. Switch Language to see i18n applied to Achievement menu correctly.
4. Create a world, verify "欢迎来到新世界" pops up with its image icon.
5. In game, open Pause menu, click "成就系统" and see the list, "欢迎来到新世界" should be Unlocked (image in color).
6. Trigger other achievements (run, jump, chat, punch, zoom, perspective, damage, hurt, place, mine, wait 5 min) and verify Toasts appear with correct icons, localized texts, and they unlock in the menu.
7. Return to main menu, create a **New World**, check achievements. They should go back to locked and "欢迎来到新世界" pops up again.
