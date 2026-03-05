import * as THREE from 'three'

import selectionFragmentShader from '../../shaders/selection/fragment.glsl'
import selectionVertexShader from '../../shaders/selection/vertex.glsl'
import Experience from '../experience.js'

/**
 * BlockSelectionHelper
 * - 用于高亮当前“被交互的方块”（hover/选中）
 * - 仅负责可视化，不负责射线检测
 */
export default class BlockSelectionHelper {
  constructor(options = {}) {
    this.experience = new Experience()
    this.scene = this.experience.scene
    this.debug = this.experience.debug

    this.params = {
      enabled: options.enabled ?? true,
      visibleThroughWalls: options.visibleThroughWalls ?? false,
      color: options.color ?? '#000000',
      opacity: options.opacity ?? 0.8,
      thickness: options.thickness ?? 0.02,
    }

    this.geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01)

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(this.params.color) },
        uOpacity: { value: this.params.opacity },
        uThickness: { value: this.params.thickness },
      },
      vertexShader: selectionVertexShader,
      fragmentShader: selectionFragmentShader,
      transparent: true,
      depthTest: !this.params.visibleThroughWalls,
      depthWrite: false,
    })

    this.object = new THREE.Mesh(this.geometry, this.material)
    this.object.renderOrder = 0

    this.object.visible = false
    this.scene.add(this.object)

    // 移除旧的事件监听 (改为 update 轮询)
    /*
    emitter.on('game:block-hover', (info) => {
      if (!this.params.enabled)
        return
      this.setTarget(info)
    })
    emitter.on('game:block-hover-clear', () => {
      this.clear()
    })
    */

    if (this.debug.active) {
      this.debugInit()
    }
  }

  update() {
    if (!this.params.enabled) {
      this.clear()
      return
    }

    // 主动获取最新的射线检测结果
    const raycaster = this.experience.world?.blockRaycaster
    if (raycaster && raycaster.current) {
      this.setTarget(raycaster.current)
    }
    else {
      this.clear()
    }
  }

  /**
   * 设置当前选中方块
   * @param {{ worldPosition:THREE.Vector3, renderScale?:number }} info
   */
  setTarget(info) {
    if (!info?.worldPosition) {
      this.clear()
      return
    }

    const s = info.renderScale ?? 1
    this.object.scale.setScalar(s)

    // 永远高亮命中方块本身
    this.object.position.copy(info.worldPosition)

    this.object.visible = true
  }

  /**
   * 清空选中
   */
  clear() {
    this.object.visible = false
  }

  debugInit() {
    this.debugFolder = this.debug.ui.addFolder({
      title: 'Block Selection',
      expanded: false,
    })

    this.debugFolder.addBinding(this.params, 'enabled', { label: '启用' }).on('change', () => {
      if (!this.params.enabled)
        this.clear()
    })

    this.debugFolder.addBinding(this.params, 'visibleThroughWalls', {
      label: '穿透显示',
    }).on('change', () => {
      this.material.depthTest = !this.params.visibleThroughWalls
      this.material.needsUpdate = true
    })

    this.debugFolder.addBinding(this.params, 'opacity', {
      label: '透明度',
      min: 0.05,
      max: 1,
      step: 0.05,
    }).on('change', () => {
      this.material.uniforms.uOpacity.value = this.params.opacity
    })

    this.debugFolder.addBinding(this.params, 'thickness', {
      label: '边框厚度',
      min: 0.01,
      max: 0.2,
      step: 0.01,
    }).on('change', () => {
      this.material.uniforms.uThickness.value = this.params.thickness
    })

    this.debugFolder.addBinding(this.params, 'color', {
      label: '颜色',
      view: 'color',
    }).on('change', () => {
      this.material.uniforms.uColor.value.set(this.params.color)
    })
  }

  dispose() {
    this.scene.remove(this.object)
    this.geometry?.dispose?.()
    this.material?.dispose?.()
  }
}
