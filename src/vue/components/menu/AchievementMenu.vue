<script setup>
import { ACHIEVEMENTS, useAchievementStore } from '@pinia/achievementStore.js'
import { useUiStore } from '@pinia/uiStore.js'

const ui = useUiStore()
const store = useAchievementStore()
</script>

<template>
  <div class="mc-menu achievement-menu">
    <h2 class="menu-title mc-title">
      {{ $t('ui.achievement.menuTitle') }}
    </h2>

    <div class="achievement-list">
      <div
        v-for="achf in ACHIEVEMENTS"
        :key="achf.id"
        class="achievement-item"
        :class="{ locked: !store.unlocked[achf.id] }"
      >
        <img :src="achf.iconPath" class="achf-icon">
        <div class="achf-info">
          <h3 class="achf-title">
            {{ $t(`ui.achievement.${achf.id}.title`) }}
          </h3>
          <p class="achf-desc">
            {{ $t(`ui.achievement.${achf.id}.desc`) }}
          </p>
        </div>
        <div class="achf-status">
          {{ store.unlocked[achf.id] ? $t('ui.achievement.unlocked') : $t('ui.achievement.locked') }}
        </div>
      </div>
    </div>

    <button class="mc-button back-btn" @click="ui.exitAchievements()">
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
.mc-title {
  font-size: 32px;
  color: #fff;
  text-shadow:
    3px 3px 0 #3f3f3f,
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000,
    1px 1px 0 #000;
  text-align: center;
  margin-bottom: 20px;
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
  image-rendering: -moz-crisp-edges;
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
.back-btn {
  height: 7vh;
  min-height: 48px;
}
</style>
