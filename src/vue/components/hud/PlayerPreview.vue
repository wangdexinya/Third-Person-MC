<script setup>
import { useSettingsStore } from '@pinia/settingsStore.js'
import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * PlayerPreview - 左下角玩家正面预览装饰层
 * 仅提供 CSS 边框装饰，实际渲染由 Three.js 通过 Viewport 直接完成
 * 采用 GPU-only 方案，无需处理像素数据
 *
 * 左侧装备栏：武器、（空）、盾牌
 * 右侧装备栏：头盔、胸甲、护腿
 */

const settings = useSettingsStore()

// 计算是否显示预览
const isVisible = computed(() => settings.frontViewEnabled)

// 左侧装备插槽配置（从上到下）
const leftSlots = [
  { id: 'weapon', icon: '/img/slots/weapon.webp', alt: 'Weapon' },
  { id: 'boots', icon: '/img/slots/boots.webp', alt: 'Boots' },
  { id: 'shield', icon: '/img/slots/shield.webp', alt: 'Shield' },
]

// 右侧装备插槽配置（从上到下）
const rightSlots = [
  { id: 'helmet', icon: '/img/slots/helmet.webp', alt: 'Helmet' },
  { id: 'chestplate', icon: '/img/slots/chestplate.webp', alt: 'Chestplate' },
  { id: 'leggings', icon: '/img/slots/leggings.webp', alt: 'Leggings' },
]

const windowSize = ref({ width: 1920, height: 1080 })

function onWindowResize() {
  windowSize.value.width = window.innerWidth
  windowSize.value.height = window.innerHeight
}

onMounted(() => {
  onWindowResize()
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
})

const dynamicStyles = computed(() => {
  const baseWidth = 1920
  const baseHeight = 1040
  const currentWidth = windowSize.value.width
  const currentHeight = windowSize.value.height
  const scaleFactor = Math.min(
    currentWidth / baseWidth,
    currentHeight / baseHeight,
  )

  // Match three.js PlayerPreviewCamera values perfectly to keep them synced
  const size3D = Math.max(180, Math.round(250 * scaleFactor))
  const left3D = Math.max(120, Math.round(180 * scaleFactor))
  const bottom3D = Math.max(15, Math.round(20 * scaleFactor))

  const innerScale = size3D / 250

  const containerLeft = left3D + Math.round(24 * innerScale) - Math.round(64 * innerScale)
  const containerBottom = bottom3D + Math.round(8 * innerScale)

  return {
    container: {
      'left': `${containerLeft}px`,
      'bottom': `${containerBottom}px`,
      '--preview-scale': innerScale,
    },
    preview: {
      width: `${Math.round(180 * innerScale)}px`,
      height: `${size3D}px`,
    },
  }
})
</script>

<template>
  <div v-if="isVisible" class="player-preview-container" :style="dynamicStyles.container">
    <!-- 左侧装备栏 -->
    <div class="equipment-slots left-slots">
      <div v-for="slot in leftSlots" :key="slot.id" class="slot">
        <img :src="slot.icon" :alt="slot.alt" class="slot-icon">
      </div>
    </div>

    <!-- 玩家预览区域（Three.js Viewport 渲染区） -->
    <div class="player-preview" :style="dynamicStyles.preview">
      <!-- 纯装饰层：边框由 CSS 提供，内容由 Three.js Viewport 渲染 -->
    </div>

    <!-- 右侧装备栏 -->
    <div class="equipment-slots right-slots">
      <div v-for="slot in rightSlots" :key="slot.id" class="slot">
        <img :src="slot.icon" :alt="slot.alt" class="slot-icon">
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-preview-container {
  align-items: center;
  display: flex;
  gap: calc(12px * var(--preview-scale, 1));
  pointer-events: none;
  position: absolute;
}

.player-preview {
  background: transparent;
  border: calc(3px * var(--preview-scale, 1)) solid hsla(0, 0%, 100%, 0.4);
  border-radius: calc(4px * var(--preview-scale, 1));
  overflow: hidden;
}

.equipment-slots {
  display: flex;
  flex-direction: column;
  gap: calc(12px * var(--preview-scale, 1));
}

.slot {
  align-items: center;
  background: hsla(0, 0%, 0%, 0.5);
  border: calc(2px * var(--preview-scale, 1)) solid hsla(0, 0%, 100%, 0.3);
  border-radius: calc(6px * var(--preview-scale, 1));
  display: flex;
  height: calc(52px * var(--preview-scale, 1));
  justify-content: center;
  width: calc(52px * var(--preview-scale, 1));
}

.slot-icon {
  height: calc(36px * var(--preview-scale, 1));
  image-rendering: pixelated;
  opacity: 0.5;
  width: calc(36px * var(--preview-scale, 1));
}
</style>
