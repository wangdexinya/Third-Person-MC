<script setup>
import { useAchievementStore } from '@pinia/achievementStore.js'

const store = useAchievementStore()
</script>

<template>
  <div class="achievement-toast-container">
    <TransitionGroup name="slide-down" tag="div" class="toast-list">
      <div v-for="toast in store.activeToasts" :key="toast.instanceId" class="achievement-toast">
        <img :src="toast.iconPath" class="icon">
        <div class="content">
          <div class="title">
            Achievement Get!
          </div>
          <div class="name">
            {{ $t(`ui.achievement.${toast.id}.title`) }}
          </div>
        </div>
      </div>
    </TransitionGroup>
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
.toast-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  image-rendering: -moz-crisp-edges;
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
