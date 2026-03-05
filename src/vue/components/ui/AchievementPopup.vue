<script setup>
// 本次使用了 skill: vtj-ui-integration
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const isVisible = ref(false)

onMounted(() => {
  window.addEventListener('achievement:all_unlocked', onAllUnlocked)
})

onUnmounted(() => {
  window.removeEventListener('achievement:all_unlocked', onAllUnlocked)
})

function onAllUnlocked() {
  isVisible.value = true
}

function closePopup() {
  isVisible.value = false
}
</script>

<template>
  <Transition name="slide-in">
    <div v-if="isVisible" class="mc-achievement-popup">
      <div class="mc-achievement-icon">
        <img src="/textures/blocks/grass_block_side.png" alt="Icon" class="grass-block-img">
      </div>
      <div class="mc-achievement-text">
        <div class="mc-achievement-title mc-text">
          {{ t('ui.achievement.suggestion.title', '建议 / Suggestion') }}
        </div>
        <div class="mc-achievement-desc mc-text">
          <a href="https://www.minecraft.net/" target="_blank" class="mc-link mc-text" @click.stop>
            {{ t('ui.achievement.suggestion.desc_prefix', '尝试真正的') }}
            <span class="mc-highlight mc-text">Minecraft</span>
            {{ t('ui.achievement.suggestion.desc_suffix', '吧！') }}
          </a>
        </div>
      </div>
      <button class="mc-close-btn" title="关闭" @click="closePopup">
        ×
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.mc-achievement-popup {
  position: fixed;
  top: 20px;
  right: 20px;
  width: 320px;
  background-color: #212121;
  border: 3px solid #555555;
  border-radius: 4px;
  padding: 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 99999;
  box-shadow:
    inset 0 0 0 2px #000000,
    4px 4px 8px rgba(0, 0, 0, 0.5);
  font-family: inherit;
  color: white;
  pointer-events: auto; /* Allow interacting with popup (link and close) */
}

/* 这是一个粗糙的像素草方块实现 */
.mc-achievement-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  image-rendering: auto; /* Fallback */
}

.grass-block-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  /* Pixel art rendering */
  image-rendering: pixelated;
  image-rendering: -moz-crisp-edges;
  image-rendering: crisp-edges;
}

.mc-achievement-text {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mc-achievement-title {
  color: #ffff55;
  font-size: 16px;
  font-weight: bold;
  text-shadow: 2px 2px 0 #3f3f15;
}

.mc-achievement-desc {
  font-size: 14px;
  text-shadow: 2px 2px 0 #3f3f3f;
}

.mc-link {
  color: #ffffff;
  text-decoration: none;
  cursor: pointer;
  display: inline-block;
  transition: all 0.2s ease;
}

.mc-highlight {
  color: #55ff55; /* Minecraft Light Green */
  font-size: 20px;
  font-weight: bold;
  text-shadow: 2px 2px 0 #153f15;
  margin: 0 2px;
  display: inline-block;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.mc-link:hover {
  color: #aaaaaa;
}

.mc-link:hover .mc-highlight {
  color: #ffff55; /* Minecraft Yellow */
  transform: scale(1.15) rotate(-3deg);
}

.mc-close-btn {
  background: none;
  border: none;
  color: #aaaaaa;
  font-size: 24px;
  cursor: pointer;
  padding: 0 4px;
  text-shadow: 2px 2px 0 #000;
  line-height: 1;
}

.mc-close-btn:hover {
  color: #ffffff;
}

.slide-in-enter-active,
.slide-in-leave-active {
  transition: all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.slide-in-enter-from,
.slide-in-leave-to {
  opacity: 0;
  transform: translateX(120%);
}
</style>
