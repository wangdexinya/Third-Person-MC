<script setup>
/**
 * PauseMenu - ESC menu when game is paused
 */
import { useUiStore } from '@pinia/uiStore.js'
import AchievementMenu from './AchievementMenu.vue'

const ui = useUiStore()
</script>

<template>
  <div class="pause-menu">
    <h2 v-if="ui.mainMenuView === 'root'" class="menu-title">
      {{ $t('menu.paused') }}
    </h2>

    <div v-if="ui.mainMenuView === 'root'" class="mc-menu">
      <button class="mc-button" @click="ui.toPlaying()">
        <span class="title">{{ $t('menu.resume') }}</span>
      </button>
      <button class="mc-button" @click="ui.toMainMenu({ preservePause: true })">
        <span class="title">{{ $t('menu.mainMenu') }}</span>
      </button>
      <button class="mc-button" @click="ui.toSettings('pauseMenu')">
        <span class="title">{{ $t('menu.settings') }}</span>
      </button>
      <button class="mc-button" @click="ui.toAchievements()">
        <span class="title">{{ $t('ui.achievement.menuTitle') }}</span>
      </button>
      <button class="mc-button" @click="ui.toSkinSelector()">
        <span class="title">{{ $t('menu.skins') }}</span>
      </button>
    </div>

    <div v-else-if="ui.mainMenuView === 'achievements'">
       <AchievementMenu />
    </div>
  </div>
</template>

<style scoped>
.pause-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.menu-title {
  color: #fff;
  font-size: 28px;
  text-shadow: 2px 2px #000;
}
</style>
