# 地形配置重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 统一 ChunkManager 地形配置管理，消除 chunk-config、world.js、settingsStore、uiStore 之间的配置分散与冗余，建立单一真值来源。

**Architecture:** 以 `chunk-config.js` 为静态默认值唯一来源；`settingsStore` 从 chunk-config 读取默认值并持久化用户偏好；`world.js` 在创建 ChunkManager 时从 settingsStore 获取 viewDistance/unloadPadding，其余从 chunk-config 获取；ChunkManager 构造函数仅接收必要的运行时参数，移除 options 与 default 的混乱覆盖逻辑。

**Tech Stack:** JavaScript, Three.js, Pinia, mitt, Tweakpane

---

## 配置现状分析（执行前必读）

| 配置项 | chunk-config | world.js 传入 | settingsStore | uiStore worldGenDraft |
|--------|--------------|---------------|---------------|------------------------|
| viewDistance | 1 | CHUNK_BASIC_CONFIG.viewDistance | 2 (DEFAULT) | 1→2 (reset) |
| unloadPadding | 1 | 未传 | 1 | - |
| chunkWidth | 64 | 显式传入 | - | - |
| chunkHeight | 32 | 显式传入 | - | - |
| seed | 1337 | 2387213640 硬编码 | - | - |
| terrain | TERRAIN_PARAMS | 显式传入子集 | - | - |

冲突：viewDistance 在 4 处有不同默认值；world.js 手动拼装配置；ChunkManager 用 `options ?? CHUNK_BASIC_CONFIG` 造成理解困难。

**注意：** 重构后默认 viewDistance 将统一为 chunk-config 中的 1。若需保持 2，请在 `CHUNK_BASIC_CONFIG.viewDistance` 中修改。

---

### Task 1: 统一 chunk-config 为静态默认值唯一来源

**Files:**
- Modify: `src/js/config/chunk-config.js`
- Modify: `src/js/config/settings-presets.js`

**Step 1: 在 chunk-config.js 中导出 CHUNK_DEFAULTS（供 settingsStore 使用）**

在 `chunk-config.js` 末尾添加：

```javascript
// 供 settingsStore 使用的默认值（viewDistance/unloadPadding 用户可调）
export const CHUNK_DEFAULTS = {
  viewDistance: CHUNK_BASIC_CONFIG.viewDistance,
  unloadPadding: CHUNK_BASIC_CONFIG.unloadPadding,
}
```

**Step 2: 修改 settings-presets.js 移除 CHUNK_DEFAULTS 定义并 re-export**

删除 `export const CHUNK_DEFAULTS = { viewDistance: 1, unloadPadding: 1 }`，改为从 chunk-config re-export：

```javascript
export { CHUNK_DEFAULTS } from './chunk-config.js'
```

这样 settingsStore 等仍可从 settings-presets 导入 CHUNK_DEFAULTS，无需改动导入路径。

**Step 3: 运行 lint 验证**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/js/config/chunk-config.js src/js/config/settings-presets.js
git commit -m "refactor(config): export CHUNK_DEFAULTS from chunk-config"
```

---

### Task 2: 更新 settingsStore 使用 chunk-config 默认值

**Files:**
- Modify: `src/pinia/settingsStore.js`

**Step 1: 导入 CHUNK_DEFAULTS 并替换 DEFAULT_SETTINGS 中的硬编码**

settingsStore 已从 `settings-presets.js` 导入 CHUNK_DEFAULTS；Task 1 将 CHUNK_DEFAULTS 移至 chunk-config 并由 settings-presets re-export，故无需改导入路径。

修改 DEFAULT_SETTINGS（约第 49-51 行），将硬编码的 2 和 1 改为使用 CHUNK_DEFAULTS：

```javascript
  // Chunks（CHUNK_DEFAULTS 来自 chunk-config，经 settings-presets re-export）
  chunkViewDistance: CHUNK_DEFAULTS.viewDistance,
  chunkUnloadPadding: CHUNK_DEFAULTS.unloadPadding,
```

**Step 2: 修改 resetToDefaults 中的 chunk 重置逻辑**

确保使用 CHUNK_DEFAULTS（已从 chunk-config 导入）：

```javascript
    chunkViewDistance.value = CHUNK_DEFAULTS.viewDistance
    chunkUnloadPadding.value = CHUNK_DEFAULTS.unloadPadding
```

**Step 3: 运行 lint 验证**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/pinia/settingsStore.js
git commit -m "refactor(settings): use CHUNK_DEFAULTS from chunk-config"
```

---

### Task 3: 简化 ChunkManager 构造函数，明确配置来源

**Files:**
- Modify: `src/js/world/terrain/chunk-manager.js`

**Step 1: 定义清晰的 options 语义**

ChunkManager 构造函数保留 `options` 但仅用于**运行时必须注入**的参数：
- `seed`：世界种子（创建/重置时传入）
- `terrain`：地形参数覆盖（可选，用于 preset 覆盖）
- `trees`：树木参数覆盖（可选）
- `worldName`、`useIndexedDB`：持久化相关

**静态配置**（chunkWidth、chunkHeight、viewDistance、unloadPadding）一律从 `CHUNK_BASIC_CONFIG` 读取，**不再**从 options 覆盖。viewDistance/unloadPadding 的运行时更新继续通过 `settings:chunks-changed` 事件由 world.js 写入。

修改 constructor（约 21-70 行）：

```javascript
  constructor(options = {}) {
    this.experience = new Experience()
    this.debug = this.experience.debug

    // 静态配置：仅从 chunk-config 读取，不再接受 options 覆盖
    this.chunkWidth = CHUNK_BASIC_CONFIG.chunkWidth
    this.chunkHeight = CHUNK_BASIC_CONFIG.chunkHeight
    this.viewDistance = CHUNK_BASIC_CONFIG.viewDistance
    this.unloadPadding = CHUNK_BASIC_CONFIG.unloadPadding

    // 运行时参数：仅 seed、terrain、trees 等由 options 传入
    this.seed = options.seed ?? CHUNK_BASIC_CONFIG.seed
    this.terrainParams = options.terrain ? { ...TERRAIN_PARAMS, ...options.terrain } : { ...TERRAIN_PARAMS }
    this.treeParams = options.trees ? { ...TREE_PARAMS, ...options.trees } : { ...TREE_PARAMS }
    this.renderParams = { ...RENDER_PARAMS }
    this.waterParams = options.water ? { ...WATER_PARAMS, ...options.water } : { ...WATER_PARAMS }
    this.biomeParams = {
      biomeSource: options.biomeSource ?? 'generator',
      forcedBiome: options.forcedBiome ?? 'plains',
    }

    // ... 其余不变（biomeGenerator, chunks, idleQueue, persistence 等）
```

**Step 2: 运行 lint 验证**

Run: `pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/js/world/terrain/chunk-manager.js
git commit -m "refactor(chunkmanager): use chunk-config as single source for static config"
```

---

### Task 4: 更新 world.js 从 settingsStore 获取 viewDistance/unloadPadding

**Files:**
- Modify: `src/js/world/world.js`

**Step 1: 在 world.js 顶部添加 useSettingsStore 导入**

```javascript
import { useSettingsStore } from '@pinia/settingsStore.js'
```

**Step 2: 修改 _initTerrain，从 settingsStore 注入 viewDistance/unloadPadding**

ChunkManager 不再从 options 接收 chunkWidth/Height/viewDistance/unloadPadding，创建后需从 settingsStore 注入用户偏好：

```javascript
  _initTerrain() {
    const settingsStore = useSettingsStore()

    this.chunkManager = new ChunkManager({
      seed: CHUNK_BASIC_CONFIG.seed,
      terrain: {
        scale: TERRAIN_PARAMS.scale,
        magnitude: TERRAIN_PARAMS.magnitude,
        offset: TERRAIN_PARAMS.offset,
        rockExpose: TERRAIN_PARAMS.rockExpose,
        fbm: TERRAIN_PARAMS.fbm,
      },
    })

    this.chunkManager.viewDistance = settingsStore.chunkViewDistance
    this.chunkManager.unloadPadding = settingsStore.chunkUnloadPadding

    this.experience.terrainDataManager = this.chunkManager
    this.chunkManager.initInitialGrid()
  }
```

移除原先传入的 chunkWidth、chunkHeight、viewDistance（ChunkManager 已从 chunk-config 读取）。

**Step 2: 移除 world.js 中不再需要的 CHUNK_BASIC_CONFIG 导入项**

保留 CHUNK_BASIC_CONFIG 仅用于 seed（若仍需要默认 seed），或改为从 CHUNK_BASIC_CONFIG 读取 seed。当前 world.js 传入 seed: 2387213640，这是硬编码。根据 PRD/需求，创建世界时 seed 由 uiStore 的 getOrCreateSeedNumber() 提供，通过 game:create_world 事件传递。首次加载时 core:ready 先于 game:create_world，因此 _initTerrain 时还没有用户 seed。此时使用 CHUNK_BASIC_CONFIG.seed 作为占位，后续 game:create_world 会触发 world.reset() 更新 seed。保持 seed 从 CHUNK_BASIC_CONFIG 读取即可。

**Step 3: 运行 lint 验证**

Run: `pnpm lint`
Expected: PASS

**Step 4: 手动验证**

Run: `pnpm dev`
Expected: 应用启动，地形正常加载，设置中修改视距后生效。

**Step 5: Commit**

```bash
git add src/js/world/world.js
git commit -m "refactor(world): inject viewDistance/unloadPadding from settingsStore"
```

---

### Task 5: 统一 uiStore worldGenDraft.viewDistance 默认值

**Files:**
- Modify: `src/pinia/uiStore.js`

**Step 1: 从 chunk-config 导入 CHUNK_DEFAULTS**

在 uiStore.js 顶部添加：

```javascript
import { CHUNK_DEFAULTS } from '../js/config/chunk-config.js'
```

**Step 2: 修改 worldGenDraft 初始值和 resetWorldGenDraft**

worldGenDraft 初始值（约 60-66 行）：

```javascript
  const worldGenDraft = reactive({
    presetId: DEFAULT_WORLDGEN_DRAFT.presetId,
    magnitude: DEFAULT_WORLDGEN_DRAFT.magnitude,
    treeMinHeight: DEFAULT_WORLDGEN_DRAFT.treeMinHeight,
    treeMaxHeight: DEFAULT_WORLDGEN_DRAFT.treeMaxHeight,
    viewDistance: CHUNK_DEFAULTS.viewDistance,
  })
```

resetWorldGenDraft（约 304-310 行）：

```javascript
  function resetWorldGenDraft() {
    worldGenDraft.presetId = DEFAULT_WORLDGEN_DRAFT.presetId
    worldGenDraft.magnitude = DEFAULT_WORLDGEN_DRAFT.magnitude
    worldGenDraft.treeMinHeight = DEFAULT_WORLDGEN_DRAFT.treeMinHeight
    worldGenDraft.treeMaxHeight = DEFAULT_WORLDGEN_DRAFT.treeMaxHeight
    worldGenDraft.viewDistance = CHUNK_DEFAULTS.viewDistance
  }
```

**Step 3: 运行 lint 验证**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/pinia/uiStore.js
git commit -m "refactor(ui): use CHUNK_DEFAULTS.viewDistance for worldGenDraft"
```

---

### Task 6: 端到端验证与文档更新

**Files:**
- Modify: `src/js/config/chunk-config.js`
- Modify: `docs/plans/2026-03-06-refactor-terrain-config.md`（本计划，添加完成检查清单）

**Step 1: 运行完整验证**

Run: `pnpm lint`
Expected: PASS

Run: `pnpm dev`
Expected: 应用启动，创建世界、修改视距、重置世界均正常。

**Step 2: 更新 chunk-config.js 顶部注释，说明配置职责**

在 chunk-config.js 文件顶部添加：

```javascript
/**
 * Chunk 与地形配置 - 静态默认值唯一来源
 * - CHUNK_BASIC_CONFIG: 引擎常量（chunk 尺寸、视距默认等）
 * - CHUNK_DEFAULTS: 供 settingsStore 使用的 viewDistance/unloadPadding 默认值
 * - 用户偏好由 settingsStore 持久化，world.js 在创建 ChunkManager 时注入
 */
```

**Step 3: Commit**

```bash
git add src/js/config/chunk-config.js docs/plans/2026-03-06-refactor-terrain-config.md
git commit -m "docs(config): add chunk-config responsibility comment"
```

---

## 执行顺序与依赖

- Task 1 最先（chunk-config + settings-presets）
- Task 2、Task 5 可并行（settingsStore、uiStore）
- Task 3 → Task 4（ChunkManager 简化后再改 world.js）
- Task 6 最后（验证与文档）

---

## 完成检查清单

- [x] chunk-config.js 为 viewDistance/unloadPadding 等静态默认值唯一来源
- [x] settingsStore 从 chunk-config 读取 CHUNK_DEFAULTS
- [x] ChunkManager 不再从 options 覆盖 chunkWidth/Height/viewDistance/unloadPadding
- [x] world.js 从 settingsStore 注入 viewDistance/unloadPadding
- [x] uiStore worldGenDraft.viewDistance 来自 CHUNK_DEFAULTS
- [x] settings-presets 不再重复定义 CHUNK_DEFAULTS
- [x] pnpm lint 通过
- [x] pnpm dev 手动验证通过
