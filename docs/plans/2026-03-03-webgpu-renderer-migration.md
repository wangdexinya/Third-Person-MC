# WebGPU 渲染器迁移计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将项目渲染后端从 WebGLRenderer 迁移到 WebGPURenderer，以获得更好的 GPU 利用率、节点材质系统、TSL 后处理链以及未来的 Compute Shader 能力。

**Architecture:** 采用渐进式迁移策略——先切分支、搭建 WebGPU 渲染器核心并保留 WebGL 自动回退，再逐步将 ShaderMaterial → TSL 节点材质、EffectComposer → TSL PostProcessing 链，最后迁移独立渲染器（SkinPreview）和离屏 RenderTarget。所有 GLSL 着色器通过 TSL（Three Shading Language）重写为 JS-in-GPU 形式，无需手写 WGSL。

**Tech Stack:** Three.js `three/webgpu` + TSL (`three/tsl`) | Vite + vite-plugin-glsl（部分保留）| three-custom-shader-material 需替换为 NodeMaterial

---

## 迁移影响清单 (Audit)

### 渲染器实例（2 处）

| 文件 | 用途 | 迁移方式 |
|---|---|---|
| `src/js/renderer.js` | 主渲染器 + EffectComposer 后处理 | WebGPURenderer + TSL PostProcessing |
| `src/js/components/skin-preview-scene.js` | 皮肤预览独立渲染器 | WebGPURenderer（独立场景） |

### ShaderMaterial（5 处）

| 文件 | 着色器 | 迁移方式 |
|---|---|---|
| `src/js/renderer.js` (SpeedLinePass) | `speedlines/vertex+fragment.glsl` | TSL 后处理 pass 节点 |
| `src/js/renderer.js` (GazePass) | `gaze/vertex+fragment.glsl` | TSL 后处理 pass 节点 |
| `src/js/world/effects/fireflies.js` | `fireflies/vertex+fragment.glsl` | SpriteNodeMaterial + TSL |
| `src/js/world/sky-dome.js` | `sky/vertex+fragment.glsl` | MeshBasicNodeMaterial + TSL |
| `src/js/components/grid.js` | `grid/vertex+fragment.glsl` | MeshBasicNodeMaterial + TSL |
| `src/js/components/glass-wall.js` | `glass/vertex+fragment.glsl` | ~~未使用，跳过~~ |

### CustomShaderMaterial / CSM（1 处）

| 文件 | 用途 | 迁移方式 |
|---|---|---|
| `src/js/world/terrain/blocks-config.js` | AO + 风动植物 + 挖掘着色器（基于 CSM） | 替换为 MeshStandardNodeMaterial + TSL override |

### EffectComposer 后处理链

| Pass | 原实现 | 迁移方式 |
|---|---|---|
| RenderPass | `three/examples/jsm/postprocessing/RenderPass.js` | `pass(scene, camera)` |
| UnrealBloomPass | `three/examples/jsm/postprocessing/UnrealBloomPass.js` | `bloom(scenePass, {...})` |
| SpeedLinePass (custom ShaderPass) | `three/examples/jsm/postprocessing/ShaderPass.js` | 自定义 TSL Fn 节点 |
| GazePass (custom ShaderPass) | `three/examples/jsm/postprocessing/ShaderPass.js` | 自定义 TSL Fn 节点 |
| OutputPass | `three/examples/jsm/postprocessing/OutputPass.js` | TSL 内置（无需单独添加） |

### WebGL 特有 API

| 文件 | API | 迁移注意 |
|---|---|---|
| `src/js/renderer.js` | `setViewport`, `setScissor`, `setScissorTest` | WebGPURenderer 兼容（API 相同） |
| `src/js/components/glass-wall.js` | `THREE.RenderTarget`, `setRenderTarget` | 改为 `THREE.RenderTarget`（WebGPU 入口自带） |
| `src/js/renderer.js` | `forceContextLoss` | WebGPU 无此 API，改用 `renderer.dispose()` |
| `src/js/components/skin-preview-scene.js` | `forceContextLoss` | 同上 |

### GLSL 着色器文件（24 个）

迁移后，以下着色器将被 TSL 代码替代（内联在 JS 组件中），对应 `.glsl` 文件可保留但不再被引用：

- `speedlines/*` → TSL 后处理节点
- `gaze/*` → TSL 后处理节点
- `fireflies/*` → TSL 顶点/片段节点
- `sky/*` → TSL 混合节点
- `grid/*` → TSL 网格节点
- `glass/*` → 未使用，保留不动
- `blocks/ao.*` → TSL AO 覆盖
- `blocks/wind.*` → TSL 风动覆盖
- `blocks/mining.*` → TSL 挖掘覆盖
- `includes/*` → TSL 光照函数（如仍需要）

---

## Phase 0: 分支创建与环境准备

### Task 0.1: 创建 webgpu 分支

**Files:**
- 无文件变更（仅 Git 操作）

**Step 1: 从 main 创建新分支**

```bash
git checkout main
git pull origin main
git checkout -b webgpu
```

**Step 2: 确认分支干净**

```bash
git status
```

Expected: "On branch webgpu, nothing to commit"

**Step 3: 推送空分支到远端**

```bash
git push -u origin webgpu
```

---

### Task 0.2: 升级 Three.js 至最新稳定版

**Files:**
- Modify: `package.json`

**Step 1: 升级 Three.js**

WebGPURenderer 仍在快速迭代中，建议升级到最新版以获取最佳兼容性和 bug 修复。

```bash
pnpm update three@latest
```

**Step 2: 检查 three-custom-shader-material 兼容性**

```bash
pnpm ls three three-custom-shader-material
```

确认 CSM 版本与新 Three.js 版本兼容。若不兼容，在后续 Task 中替换为 NodeMaterial 时一并处理。

**Step 3: 启动开发服务器验证现有功能不受影响**

```bash
pnpm dev
```

Expected: 场景正常渲染，控制台无报错。

**Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: upgrade three.js to latest for WebGPU support"
```

---

## Phase 1: 渲染器核心迁移

### Task 1.1: 将主渲染器从 WebGLRenderer 切换到 WebGPURenderer

**Files:**
- Modify: `src/js/renderer.js`
- Modify: `src/js/experience.js`

**关键变更点：**

1. **Import 路径变更：** `import * as THREE from 'three'` → `import * as THREE from 'three/webgpu'`
   - 仅在 `renderer.js` 中变更，其他文件保持 `import * as THREE from 'three'`（WebGPU 入口兼容）
   - **注意**：`three/webgpu` 导出包含所有 `three` 的内容，加上 WebGPU 专属 API

2. **渲染器实例化变更：**

```javascript
// Before
this.instance = new THREE.WebGLRenderer({
  canvas: this.canvas,
  antialias: false,
  alpha: true,
})

// After
this.instance = new THREE.WebGPURenderer({
  canvas: this.canvas,
  antialias: false,
  alpha: true,
  forceWebGL: false, // 设为 true 可强制 WebGL 回退（调试用）
})
```

3. **异步初始化：** WebGPURenderer 需要异步初始化

```javascript
// renderer.js - constructor 不能是 async，需要用 init 模式
constructor() {
  // ... 同步代码 ...
  this.ready = false
  this._init()
}

async _init() {
  this.setInstance()
  await this.instance.init() // 关键：等待 GPU adapter/device 就绪
  this.ready = true
  this.setPostProcess() // 后处理在渲染器就绪后初始化
  // ...
}
```

4. **Experience.js 适配异步：**

```javascript
// experience.js - 需要等待 renderer ready
this.renderer = new Renderer()
// 使用 setAnimationLoop 替代手动 RAF（推荐方式，自动处理异步）
```

5. **移除 `forceContextLoss`：** WebGPU 没有此 API

```javascript
// Before
this.instance.forceContextLoss()
this.instance.dispose()

// After
this.instance.dispose()
```

6. **保留不变的 API：**
   - `setSize`, `setPixelRatio`, `setClearColor` — 兼容
   - `setViewport`, `setScissor`, `setScissorTest` — 兼容
   - `shadowMap.enabled`, `shadowMap.type` — 兼容
   - `toneMapping`, `toneMappingExposure` — 兼容
   - `autoClear` — 兼容
   - `render(scene, camera)` — 兼容
   - `clear()` — 兼容

**Step 1: 修改 renderer.js 的 import 和实例化**

将 `setInstance()` 改为创建 `WebGPURenderer`，添加 `async _init()` 方法。

**Step 2: 临时注释掉 `setPostProcess()`**

后处理需要全面重写（Phase 2），暂时跳过以确保基础渲染正常。

**Step 3: 修改 `update()` 跳过 composer，直接使用 `this.instance.render()`**

```javascript
update() {
  if (!this.ready) return
  // 临时：直接渲染，不走后处理
  this.instance.render(this.scene, this.camera.instance)
  this._renderPlayerPreview()
}
```

**Step 4: 修改 `destroy()` 移除 `forceContextLoss()`**

**Step 5: 适配 experience.js 的初始化顺序**

确保 `World` 在渲染器 `ready` 后再初始化资源，或使用 `setAnimationLoop` 模式。

**Step 6: 启动 dev server 验证基础渲染**

```bash
pnpm dev
```

Expected: 场景正常显示（无后处理效果），控制台输出 WebGPU adapter 信息。如果浏览器不支持 WebGPU，应自动回退 WebGL 2 并正常渲染。

**Step 7: Commit**

```bash
git add src/js/renderer.js src/js/experience.js
git commit -m "feat(renderer): migrate core renderer to WebGPURenderer with WebGL fallback"
```

---

### Task 1.2: 验证 WebGL 自动回退

**Files:**
- 无文件变更（仅测试）

**Step 1: 在 renderer.js 中临时设置 `forceWebGL: true`**

```javascript
this.instance = new THREE.WebGPURenderer({
  canvas: this.canvas,
  forceWebGL: true, // 强制 WebGL 回退
})
```

**Step 2: 启动 dev server 验证 WebGL 回退**

```bash
pnpm dev
```

Expected: 场景正常渲染（此时走的是 WebGL 2 后端），控制台无报错。

**Step 3: 还原 `forceWebGL: false`**

**Step 4: 添加运行时后端检测日志**

```javascript
async _init() {
  await this.instance.init()
  console.info(`[Renderer] Backend: ${this.instance.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL'}`)
  this.ready = true
}
```

**Step 5: Commit**

```bash
git add src/js/renderer.js
git commit -m "feat(renderer): add backend detection logging and verify WebGL fallback"
```

---

## Phase 2: 后处理管线迁移（EffectComposer → TSL PostProcessing）

### Task 2.1: 搭建 TSL PostProcessing 基础框架 + Bloom

**Files:**
- Modify: `src/js/renderer.js`

**背景知识：** Three.js WebGPU 使用全新的 `THREE.PostProcessing` 类配合 TSL 节点来构建后处理链。EffectComposer、RenderPass、ShaderPass 等旧 API 不兼容 WebGPURenderer。

**新后处理架构：**

```javascript
import * as THREE from 'three/webgpu'
import { bloom, pass } from 'three/tsl'

// 创建后处理
this.postProcessing = new THREE.PostProcessing(this.instance)

// 场景 pass（替代 RenderPass）
const scenePass = pass(this.scene, this.camera.instance)

// Bloom pass（替代 UnrealBloomPass）
const bloomPass = bloom(scenePass, {
  threshold: 0.85,
  strength: 0.05,
  radius: 0.1,
})

// 设置输出节点（替代 OutputPass，TSL 自动处理色调映射和色彩空间）
this.postProcessing.outputNode = bloomPass
```

**Step 1: 删除旧 EffectComposer 相关 import**

移除：
```javascript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
```

添加：
```javascript
import { bloom, pass } from 'three/tsl'
```

**Step 2: 重写 `setPostProcess()` 为 TSL 版本**

仅实现场景 pass + bloom，速度线和凝视效果留到后续 Task。

```javascript
setPostProcess() {
  this.postProcessing = new THREE.PostProcessing(this.instance)

  const scenePass = pass(this.scene, this.camera.instance)

  this.bloomPassNode = bloom(scenePass, {
    threshold: this.postProcessConfig.bloom.threshold,
    strength: this.postProcessConfig.bloom.strength,
    radius: this.postProcessConfig.bloom.radius,
  })

  // 暂时只输出 bloom（速度线和凝视效果后续添加）
  this.postProcessing.outputNode = this.bloomPassNode
}
```

**Step 3: 修改 `update()` 使用新 PostProcessing**

```javascript
update() {
  if (!this.ready) return

  this.postProcessing.render()
  this._renderPlayerPreview()
}
```

**Step 4: 修改 `resize()` 适配新 PostProcessing**

```javascript
resize() {
  this.instance.setSize(this.sizes.width, this.sizes.height)
  this.instance.setPixelRatio(this.sizes.pixelRatio)
  // THREE.PostProcessing 自动跟随渲染器尺寸，无需手动 setSize
}
```

**Step 5: 修改 `destroy()` 清理新资源**

```javascript
destroy() {
  if (this.postProcessing) {
    this.postProcessing.dispose?.()
  }
  if (this.instance) {
    this.instance.dispose()
    this.instance.domElement = null
  }
}
```

**Step 6: 更新调试面板中的 Bloom 参数绑定**

bloom pass 的参数更新方式会变化：在 TSL 中，bloom 参数通过 uniform 节点控制，需要使用 `uniform()` 节点来创建可更新的参数。

**Step 7: 启动 dev server 验证 Bloom 效果**

```bash
pnpm dev
```

Expected: 场景渲染正常，Bloom 辉光效果可见。

**Step 8: Commit**

```bash
git add src/js/renderer.js
git commit -m "feat(renderer): replace EffectComposer with TSL PostProcessing + bloom"
```

---

### Task 2.2: 迁移速度线后处理效果（SpeedLinePass → TSL 自定义节点）

**Files:**
- Create: `src/js/postprocessing/speed-lines-node.js`
- Modify: `src/js/renderer.js`

**背景：** 原 SpeedLinePass 是一个自定义 ShaderPass，使用 GLSL 片段着色器实现极坐标扇区三角形脉冲动画。需要用 TSL 的 `Fn()` API 重写为节点函数。

**TSL 关键 API 映射：**
- `texture2D(tDiffuse, vUv)` → `scenePassColor` （上游节点输出）
- `gl_FragCoord` → 不直接可用，使用 `uv()` 或 `screenCoordinate`
- `sin/cos/atan/mod/floor` → `sin()`, `cos()`, `atan2()`, `mod()`, `floor()` from `three/tsl`
- `mix(a, b, t)` → `mix(a, b, t)` from `three/tsl`
- `uniform float` → `uniform(value)` from `three/tsl`

**Step 1: 创建 `speed-lines-node.js`**

```javascript
import { Fn, float, mix, uniform, uv, vec3, vec4 } from 'three/tsl'

export function createSpeedLinesNode(inputNode, config) {
  const uTime = uniform(0)
  const uOpacity = uniform(config.opacity)
  const uColor = uniform(new THREE.Color(/*...*/))
  const uDensity = uniform(config.density)
  // ... 其余 uniforms

  const speedLinesFn = Fn(([color]) => {
    // 将 GLSL speedlines/fragment.glsl 逻辑转译为 TSL
    // 极坐标计算、扇区划分、三角形绘制、脉冲动画
    // ...
    return mix(color, lineColor, lineAlpha)
  })

  return {
    node: speedLinesFn(inputNode),
    uniforms: { uTime, uOpacity, uColor, uDensity, /* ... */ },
  }
}
```

**Step 2: 将 `src/shaders/speedlines/fragment.glsl` 逻辑转译为 TSL**

参考原 GLSL 代码，逐行用 TSL 运算符重写：
- `*` → `.mul()`, `+` → `.add()`, `-` → `.sub()`, `/` → `.div()`
- `vec2(x, y)` → `vec2(x, y)`
- `atan(y, x)` → `atan2(y, x)`

**Step 3: 在 renderer.js 中集成速度线节点**

```javascript
import { createSpeedLinesNode } from './postprocessing/speed-lines-node.js'

setPostProcess() {
  // ...
  const { node: speedLinesNode, uniforms: speedLineUniforms } =
    createSpeedLinesNode(this.bloomPassNode, this.postProcessConfig.speedLines)

  this._speedLineUniforms = speedLineUniforms
  this.postProcessing.outputNode = speedLinesNode
}
```

**Step 4: 更新 `update()` 中的 uniform 时间驱动**

```javascript
update() {
  if (!this.ready) return
  this._speedLineUniforms.uTime.value = this.experience.time.elapsed * 0.001
  this.postProcessing.render()
}
```

**Step 5: 更新 `setSpeedLineOpacity()` 使用 TSL uniform**

**Step 6: 启动验证**

```bash
pnpm dev
```

Expected: 冲刺时出现速度线效果。

**Step 7: Commit**

```bash
git add src/js/postprocessing/speed-lines-node.js src/js/renderer.js
git commit -m "feat(postprocessing): migrate speed lines effect to TSL node"
```

---

### Task 2.3: 迁移凝视恐惧后处理效果（GazePass → TSL 自定义节点）

**Files:**
- Create: `src/js/postprocessing/gaze-node.js`
- Modify: `src/js/renderer.js`

**Step 1: 创建 `gaze-node.js`**

参考 `src/shaders/gaze/fragment.glsl`，将色差 (chromatic aberration)、血红色晕影 (vignette)、噪声 (noise) 效果转译为 TSL 节点函数。

```javascript
import { Fn, float, mix, uniform, uv, vec4 } from 'three/tsl'

export function createGazeNode(inputNode, config) {
  const uTime = uniform(0)
  const uIntensity = uniform(config.intensity)

  const gazeFn = Fn(([color]) => {
    // 色差偏移
    // 血红晕影
    // 噪声干扰
    // return 合成颜色
  })

  return {
    node: gazeFn(inputNode),
    uniforms: { uTime, uIntensity },
  }
}
```

**Step 2: 将 `src/shaders/gaze/fragment.glsl` 逻辑转译为 TSL**

**Step 3: 在 renderer.js 中集成凝视节点**

链接顺序：scenePass → bloom → speedLines → gaze → output

```javascript
setPostProcess() {
  const scenePass = pass(this.scene, this.camera.instance)
  const bloomNode = bloom(scenePass, { ... })
  const { node: speedLinesNode, uniforms: slU } = createSpeedLinesNode(bloomNode, ...)
  const { node: gazeNode, uniforms: gazeU } = createGazeNode(speedLinesNode, ...)

  this._gazeUniforms = gazeU
  this.postProcessing.outputNode = gazeNode
}
```

**Step 4: 更新 `update()` 中的凝视 uniform + 性能跳过逻辑**

```javascript
// 强度极低时可以通过 bypass 节点跳过
this._gazeUniforms.uTime.value = this.experience.time.elapsed * 0.001
```

**Step 5: 更新事件监听和调试面板绑定**

**Step 6: 启动验证**

Expected: 被追逐时出现屏幕血红色晕影效果。

**Step 7: Commit**

```bash
git add src/js/postprocessing/gaze-node.js src/js/renderer.js
git commit -m "feat(postprocessing): migrate gaze fear effect to TSL node"
```

---

### Task 2.4: 清理旧后处理代码 + 更新相机切换逻辑

**Files:**
- Modify: `src/js/renderer.js`
- Modify: `src/js/camera/camera.js`

**Step 1: 移除 renderer.js 中所有旧 EffectComposer 相关代码**

- 删除 `this.composer` 相关
- 删除 `this.renderPass`, `this.bloomPass`, `this.speedLinePass`, `this.gazePass`, `this.outputPass`
- 删除旧 destroy 中的 pass dispose 代码

**Step 2: 更新 `onCameraSwitched` 方法**

TSL PostProcessing 中相机切换方式不同——需要重新创建 scenePass 或使用 `scenePass.camera` 属性更新。

```javascript
onCameraSwitched(cameraInstance) {
  // TSL pass 节点的相机引用更新
  if (this._scenePassNode) {
    // 可能需要重建后处理链
    this.setPostProcess()
  }
}
```

**Step 3: 删除 GLSL 着色器的 import（speedlines 和 gaze）**

这些 import 不再需要，因为效果已经在 TSL 节点文件中实现。

**Step 4: 确认设置监听器 `_setupSettingsListeners` 使用新 uniform API**

**Step 5: 验证并 Commit**

```bash
pnpm dev
```

```bash
git add src/js/renderer.js src/js/camera/camera.js
git commit -m "refactor(renderer): clean up legacy EffectComposer code"
```

---

## Phase 3: ShaderMaterial → TSL 节点材质迁移

### Task 3.1: 迁移 SkyDome 着色器

**Files:**
- Modify: `src/js/world/sky-dome.js`

**原实现：** `ShaderMaterial` + `sky/vertex.glsl` + `sky/fragment.glsl`（双贴图混合）

**目标：** `MeshBasicNodeMaterial` + TSL 混合节点

**Step 1: 重写 SkyDome 材质**

```javascript
import * as THREE from 'three'
import { mix, texture, uniform, uv } from 'three/tsl'

// 替代 ShaderMaterial
this.material = new THREE.MeshBasicNodeMaterial({
  side: THREE.BackSide,
  depthWrite: false,
})

this._textureA = uniform(null) // texture uniform
this._textureB = uniform(null)
this._mixFactor = uniform(0.0)

// TSL 颜色节点：双贴图混合
this.material.colorNode = mix(
  texture(this._textureA, uv()),
  texture(this._textureB, uv()),
  this._mixFactor,
)
```

**Step 2: 更新 `setTextures` 和 `setMixFactor` 方法**

```javascript
setTextures(current, next) {
  this._textureA.value = current
  this._textureB.value = next
}

setMixFactor(factor) {
  this._mixFactor.value = factor
}
```

**Step 3: 移除 GLSL import**

**Step 4: 验证天空过渡效果**

**Step 5: Commit**

```bash
git add src/js/world/sky-dome.js
git commit -m "feat(sky): migrate SkyDome shader to TSL node material"
```

---

### Task 3.2: 迁移 Fireflies 着色器

**Files:**
- Modify: `src/js/world/effects/fireflies.js`

**原实现：** `ShaderMaterial` + `fireflies/vertex.glsl` + `fireflies/fragment.glsl`（正弦漂移 + 呼吸动画粒子）

**目标：** `PointsNodeMaterial` + TSL

**Step 1: 重写粒子材质**

```javascript
import * as THREE from 'three'
import { attribute, Fn, mix, positionLocal, sin, uniform, vec4 } from 'three/tsl'

this.material = new THREE.PointsNodeMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})

const uTime = uniform(0)
const uSize = uniform(this.params.size)
const uPixelRatio = uniform(Math.min(window.devicePixelRatio, 2))
const uOpacity = uniform(0)
const aRandom = attribute('aRandom')

// 顶点位置节点：正弦漂移
this.material.positionNode = Fn(() => {
  const pos = positionLocal.toVar()
  pos.x.addAssign(sin(uTime.add(aRandom.mul(100.0))).mul(0.3))
  pos.y.addAssign(sin(uTime.mul(0.5).add(aRandom.mul(50.0))).mul(0.2))
  return pos
})()

// 尺寸节点
this.material.sizeNode = uSize.mul(uPixelRatio).mul(200.0)

// 颜色/透明度节点：呼吸动画
this.material.colorNode = Fn(() => {
  const breath = sin(uTime.add(aRandom.mul(6.28))).mul(0.5).add(0.5)
  return vec4(1.0, 1.0, 0.3, breath.mul(uOpacity))
})()
```

**Step 2: 更新 `update()` 中的 uniform 驱动**

**Step 3: 移除 GLSL import**

**Step 4: 验证夜间萤火虫效果**

**Step 5: Commit**

```bash
git add src/js/world/effects/fireflies.js
git commit -m "feat(fireflies): migrate particle shader to TSL PointsNodeMaterial"
```

---

### Task 3.3: 迁移 Grid 着色器

**Files:**
- Modify: `src/js/components/grid.js`

**原实现：** `ShaderMaterial` + `grid/vertex.glsl` + `grid/fragment.glsl`（网格线 + Plus 图案 + 距离淡出）

**目标：** `MeshBasicNodeMaterial` + TSL

**Step 1: 将网格渲染逻辑用 TSL Fn 重写**

使用 `positionWorld`、`fract`、`smoothstep` 等 TSL 节点重建网格线计算。

**Step 2: 更新调试面板 uniform 绑定**

**Step 3: 移除 GLSL import**

**Step 4: 验证网格显示**

**Step 5: Commit**

```bash
git add src/js/components/grid.js
git commit -m "feat(grid): migrate grid shader to TSL node material"
```

---

### Task 3.4: 迁移 blocks-config.js 中的 CustomShaderMaterial (CSM)

**Files:**
- Modify: `src/js/world/terrain/blocks-config.js`
- Modify: `package.json`（移除 `three-custom-shader-material` 依赖）

**原实现：** `three-custom-shader-material/vanilla` 扩展标准材质，注入 AO、风动、挖掘着色器

**目标：** `MeshStandardNodeMaterial` + TSL 覆盖

**背景：** `three-custom-shader-material` 不兼容 WebGPURenderer。需要使用 `MeshStandardNodeMaterial` 的节点覆盖来实现相同功能。

**Step 1: 将 AO 着色器转译为 TSL**

```javascript
// AO：从 aAo attribute 读取遮蔽值，应用于片段颜色
import { attribute, Fn, mix, vec3 } from 'three/tsl'

const aoNode = Fn(() => {
  const ao = attribute('aAo')
  return mix(vec3(0.0), vec3(1.0), ao)
})()

material.colorNode = material.colorNode.mul(aoNode)
```

**Step 2: 将风动着色器转译为 TSL**

```javascript
// 风动：实例化方块摇摆
const windNode = Fn(() => {
  const pos = positionLocal.toVar()
  // 风动偏移计算...
  return pos
})()

material.positionNode = windNode
```

**Step 3: 将挖掘着色器转译为 TSL**

```javascript
// 挖掘：裂缝贴图叠加
const miningNode = Fn(() => {
  // 裂缝纹理采样 + 混合...
})()
```

**Step 4: 重构 `createBlockMaterial` 函数使用 NodeMaterial**

```javascript
// Before
const material = new CustomShaderMaterial(materialConfig)

// After
const material = new THREE.MeshStandardNodeMaterial({
  map: materialConfig.map,
  // ...
})
material.positionNode = windNode // 如果需要风动
material.colorNode = aoNode     // AO 覆盖
```

**Step 5: 移除 `three-custom-shader-material` 依赖**

```bash
pnpm remove three-custom-shader-material
```

**Step 6: 验证地形方块渲染**

重点检查：
- AO 暗角效果
- 树叶/植物风动摇摆
- 挖掘裂缝叠加

**Step 7: Commit**

```bash
git add src/js/world/terrain/blocks-config.js package.json pnpm-lock.yaml
git commit -m "feat(terrain): replace CSM with MeshStandardNodeMaterial + TSL overrides"
```

---

### Task 3.5: (已移除 - GlassWall 未使用，跳过)

---

## Phase 4: 独立渲染器与边缘情况

### Task 4.1: 迁移 SkinPreviewScene 独立渲染器

**Files:**
- Modify: `src/js/components/skin-preview-scene.js`

**原实现：** 独立的 `WebGLRenderer`，不依赖 Experience 单例

**Step 1: 替换为 WebGPURenderer + 异步初始化**

```javascript
import * as THREE from 'three/webgpu'

// 创建渲染器
this.renderer = new THREE.WebGPURenderer({
  canvas,
  alpha: true,
  antialias: true,
})

// 异步初始化
await this.renderer.init()
```

**注意：** constructor 不能是 async，需要将初始化拆分为工厂模式或 init 方法。

```javascript
// 改为工厂模式
static async create(canvas) {
  const scene = new SkinPreviewScene(canvas)
  await scene._init()
  return scene
}
```

**Step 2: 更新调用方（Vue 组件）适配异步创建**

找到引用 `new SkinPreviewScene(canvas)` 的 Vue 组件，改为 `await SkinPreviewScene.create(canvas)`。

**Step 3: 移除 `forceContextLoss()` 调用**

**Step 4: 使用 `setAnimationLoop` 替代手动 RAF**

```javascript
// Before
const animate = () => {
  this.animationFrameId = requestAnimationFrame(animate)
  // ...
  this.renderer.render(this.scene, this.camera)
}
animate()

// After
this.renderer.setAnimationLoop(() => {
  const delta = this.clock.getDelta()
  if (this.mixer) this.mixer.update(delta)
  // ...
  this.renderer.render(this.scene, this.camera)
})
```

**Step 5: 验证皮肤预览功能**

**Step 6: Commit**

```bash
git add src/js/components/skin-preview-scene.js
git commit -m "feat(skin-preview): migrate to WebGPURenderer with async init"
```

---

### Task 4.2: 处理 import 路径一致性

**Files:**
- 审查并修改所有 `import * as THREE from 'three'` 的文件

**背景：** `three/webgpu` 入口导出所有 `three` 的内容加上 WebGPU 专属 API。在理想情况下，整个项目应统一使用 `three/webgpu`。但实际上只有创建渲染器和使用 NodeMaterial / TSL 的文件需要。

**策略：**
- **必须改为 `three/webgpu`：** `renderer.js`、`skin-preview-scene.js` 以及所有使用 NodeMaterial 的组件文件
- **可以保持 `three`：** 不涉及 WebGPU 专属 API 的文件（如纯几何体、数学工具等）
- **推荐做法：** 在 vite 的 resolve.alias 中将 `three` 映射到 `three/webgpu`，实现全局统一

**Step 1: 在 `vite.config.js` 中添加别名**

```javascript
resolve: {
  alias: {
    'three': 'three/webgpu',
    // ...existing aliases
  }
}
```

**注意：** 这样所有 `import * as THREE from 'three'` 会自动指向 `three/webgpu`，无需修改每个文件。但需要确认不会引起副作用。

**Step 2: 验证全量功能**

**Step 3: Commit**

```bash
git add vite.config.js
git commit -m "chore: alias three to three/webgpu in vite config"
```

---

## Phase 5: 阴影系统适配 + 性能验证

### Task 5.1: 验证和调整阴影系统

**Files:**
- Modify: `src/js/renderer.js`（如需调整 shadow bias）
- Review: `src/js/config/shadow-config.js`

**已知 WebGPU 阴影问题：**
- Shadow acne 比 WebGL 更严重（需调整 bias）
- Safari 上 VSM 有伪影
- Android Chrome 可能崩溃（TEXTURE_COMPARE 回退问题）

**Step 1: 测试当前阴影配置在 WebGPU 下的表现**

逐一测试 LOW / MEDIUM / HIGH 三个等级。

**Step 2: 如有 shadow acne，调整 `shadow.bias` 和 `shadow.normalBias`**

```javascript
directionalLight.shadow.bias = -0.001  // 可能需要调整
directionalLight.shadow.normalBias = 0.02
```

**Step 3: 在 Chrome、Firefox、Safari 上交叉测试**

**Step 4: 如 Safari VSM 有问题，降级为 PCFSoftShadowMap**

**Step 5: Commit (if changes needed)**

```bash
git add -A
git commit -m "fix(shadow): adjust shadow bias for WebGPU renderer compatibility"
```

---

### Task 5.2: 性能基准对比

**Files:**
- 无文件变更（仅测试）

**Step 1: 在 WebGPU 模式下记录帧率**

使用已有的 Stats 面板，记录以下场景的 FPS：
- 空地站立（最小 draw call）
- 树林区域（大量方块 + 阴影）
- 快速移动（chunk 流式加载压力）
- 夜间萤火虫（粒子压力）

**Step 2: 切换 `forceWebGL: true`，同样场景记录帧率**

**Step 3: 对比分析**

重点关注：
- 大量实例化方块是否有 UBO 瓶颈（已知 WebGPU 问题）
- 后处理管线性能差异
- 首帧加载时间（着色器编译预热）

**Step 4: 如有性能瓶颈，记录到 TODO 或 issue 中**

---

## Phase 6: 清理与完善

### Task 6.1: 清理废弃的 GLSL 着色器文件

**Files:**
- 标记或移除不再使用的 GLSL 文件

**注意：** 不要急于删除所有 GLSL 文件。以下情况应保留：
- 仍被其他系统引用的（如 `blocks/` 着色器，如果 CSM 替换不完整）
- 作为参考文档保留的

**Step 1: 搜索所有 `.glsl` 文件的引用**

```bash
rg "\.glsl" src/js/ --files-with-matches
```

**Step 2: 确认哪些 GLSL 文件不再被引用**

**Step 3: 移动到 `src/shaders/_deprecated/` 或删除**

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up deprecated GLSL shader files"
```

---

### Task 6.2: 更新调试面板与设置 UI

**Files:**
- Modify: `src/js/renderer.js`（debugInit）

**Step 1: 确认所有 Tweakpane 绑定指向 TSL uniform 节点**

**Step 2: 添加 WebGPU/WebGL 后端指示器到调试面板**

```javascript
debugInit() {
  const rendererFolder = this.debug.ui.addFolder({ title: 'Renderer Info' })
  rendererFolder.addBinding({ backend: this.instance.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL' }, 'backend', {
    label: '渲染后端',
    readonly: true,
  })
}
```

**Step 3: Commit**

```bash
git add src/js/renderer.js
git commit -m "feat(debug): add renderer backend indicator to debug panel"
```

---

### Task 6.3: 移除 `three-custom-shader-material` 依赖

**Files:**
- Modify: `package.json`

**前置条件：** Task 3.5 已完成，确认不再有任何 CSM 引用。

**Step 1: 移除依赖**

```bash
pnpm remove three-custom-shader-material
```

**Step 2: 全局搜索确认无残留引用**

```bash
rg "three-custom-shader-material" src/
```

Expected: 无结果。

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: remove three-custom-shader-material dependency"
```

---

### Task 6.4: 全量回归测试

**Files:**
- 无文件变更

**Step 1: 启动 dev server 逐项验证**

| 功能 | 验证点 |
|---|---|
| 基础渲染 | 场景加载正常 |
| 地形 | 方块渲染、AO、风动植物 |
| 天空 | 日夜过渡、双贴图混合 |
| 后处理 - Bloom | 辉光效果可见 |
| 后处理 - 速度线 | 冲刺时出现 |
| 后处理 - 凝视 | 被追逐时效果触发 |
| 萤火虫 | 夜间粒子动画 |
| 网格 | 无限网格显示 |
| ~~玻璃墙~~ | ~~未使用，跳过~~ |
| 阴影 | 三级质量切换 |
| 皮肤预览 | 模型加载、旋转、动画 |
| 玩家预览 | 左下角正面预览 |
| 相机切换 | 第三人称/鸟瞰切换 |
| 调试面板 | 所有参数可调 |
| WebGL 回退 | forceWebGL=true 全功能正常 |

**Step 2: 运行 E2E 测试**

```bash
pnpm test:chrome
```

**Step 3: 如有问题，记录并修复**

---

## 风险评估与缓解

| 风险 | 概率 | 影响 | 缓解策略 |
|---|---|---|---|
| 着色器转 TSL 后效果不一致 | 高 | 中 | 逐着色器迁移 + 对比截图验证 |
| WebGPU 阴影 acne 严重 | 中 | 中 | 调整 bias 参数，必要时在 WebGPU 下降级阴影 |
| three-custom-shader-material 替换不完整 | 中 | 高 | Phase 3.4 单独处理，充分测试地形渲染 |
| 性能不升反降（UBO 瓶颈） | 低 | 高 | 保留 `forceWebGL` 回退，对比测试后决定是否合并 |
| Safari/Android 兼容性问题 | 中 | 中 | 持续关注 Three.js GitHub issues，必要时排除特定浏览器 |
| 异步初始化导致竞态条件 | 中 | 高 | 使用 `setAnimationLoop` + ready flag 严格控制时序 |

---

## 预估工时

| Phase | 任务数 | 预估时间 |
|---|---|---|
| Phase 0: 环境准备 | 2 | 0.5h |
| Phase 1: 渲染器核心 | 2 | 2-3h |
| Phase 2: 后处理迁移 | 4 | 4-6h |
| Phase 3: 着色器迁移 | 4 | 5-8h |
| Phase 4: 边缘情况 | 2 | 2-3h |
| Phase 5: 阴影+性能 | 2 | 2-3h |
| Phase 6: 清理与测试 | 4 | 2-3h |
| **合计** | **20 tasks** | **~17-26h** |

---

## 参考资料

- [Three.js WebGPU 官方文档](https://threejs.org/manual/en/webgpurenderer.html)
- [TSL 字段指南](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu)
- [GLSL → TSL 转换教程](https://threejsroadmap.com/blog/how-to-convert-glsl-shaders-to-tsl)
- [TSL 入门（sbcode）](https://sbcode.net/tsl/getting-started/)
- [Three.js WebGPU 后处理示例](https://threejs.org/examples/?q=webgpu%20postprocessing)
- [Three.js GLSL→TSL 自动转译器](https://threejs.org/examples/webgpu_tsl_transpiler)
