# Camera Shoulder Modes & Rear-View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 增强越肩相机系统：Tab 在三种肩膀模式间循环，Y 键按住时镜像相机实现向后看。

**Architecture:** 在现有 `CameraRig` 内扩展 `toggleSide()` 为三态循环，并添加 rear-view 镜像逻辑。不新建文件，所有改动集中在 `camera-rig-config.js`、`camera-rig.js`、`input.js` 三个文件中。

**Tech Stack:** Three.js, GSAP, mitt event bus

**关联 Skills:** `vtj-camera-system`, `vtj-input-system`, `vtj-anti-patterns`

---

## 设计概要

### 需求 1：Tab 三态肩膀循环

当前 Tab 在左/右肩之间切换（`_sideFactor` 在 `1` / `-1` 间翻转）。改为三态循环：

```
右肩 (side=1) → 左肩 (side=-1) → 正后方居中拔高 (side=0, y↑) → 右肩 ...
```

**正后方居中拔高模式：**
- `offset.x` 过渡到 `0`（正后方）
- `offset.y` 过渡到更高值（如 `2.5`，从 `1.5` 拔高 `1.0`）
- `targetOffset` 保持不变

**实现方式：** 用 `_shoulderMode` 枚举 (`'right'` / `'left'` / `'center'`) 替代原来的 `_currentSide` 标量。GSAP 驱动 `_sideFactor` (控制 X) 和新增的 `_heightBoost` (控制 Y 额外拔高) 平滑过渡。

### 需求 2：Y 键按住向后看（Rear-View Mirror）

按住 Y 时，将当前越肩视角的相机偏移和 lookAt 目标沿 Z 轴镜像：

- **cameraAnchor**: `offset.z` 取反 → 从玩家后方移到前方
- **cameraAnchor**: `offset.x` 取反 → 镜像左右位置  
- **targetAnchor**: `targetOffset.z` 取反 → 从看玩家前方变为看玩家后方

用 `_rearViewFactor` (0→1) 控制混合：
```javascript
effectiveZ = lerp(normalZ, -normalZ, _rearViewFactor)
effectiveX = lerp(normalX * sideFactor, -normalX * sideFactor, _rearViewFactor)
effectiveTargetZ = lerp(normalTargetZ, -normalTargetZ, _rearViewFactor)
```

按住 Y → GSAP 动画 `_rearViewFactor` 到 `1` (duration: 0.35s)
松开 Y → GSAP 动画 `_rearViewFactor` 到 `0` (duration: 0.35s)

---

## Proposed Changes

### Component 1: Config

#### [MODIFY] [camera-rig-config.js](file:///e:/圖形學/Third-Person-MC/src/js/camera/camera-rig-config.js)

在 `follow` 中添加正后方居中模式的拔高值和后视镜过渡时间：

```javascript
follow: {
  // ...existing...
  centerElevated: {
    heightBoost: 1.0,  // Y 轴额外拔高
  },
  rearView: {
    transitionDuration: 0.35,  // 后视镜过渡时间 (秒)
  },
},
```

---

### Component 2: CameraRig 核心逻辑

#### [MODIFY] [camera-rig.js](file:///e:/圖形學/Third-Person-MC/src/js/camera/camera-rig.js)

**改动 1：构造函数新增状态变量**

```diff
 // 初始化时记录偏移量的绝对值，用于切换时的基准
 this._cachedMagnitude = Math.abs(this.config.follow.offset.x)
-this._currentSide = Math.sign(this.config.follow.offset.x) || 1
-// 用于控制左右切换的因子 (-1 到 1)，平滑过渡
-this._sideFactor = this._currentSide
+// 肩膀模式：'right' | 'left' | 'center'
+this._shoulderMode = 'right'
+// 用于控制左右切换的因子 (-1 到 1)，平滑过渡
+this._sideFactor = 1
+// 居中拔高因子 (0 = 正常, 1 = 拔高)
+this._heightBoost = 0
+// 后视镜因子 (0 = 正常, 1 = 完全镜像)
+this._rearViewFactor = 0
```

**改动 2：替换 `toggleSide()` 为三态循环**

```javascript
toggleSide() {
  const modes = ['right', 'left', 'center']
  const currentIndex = modes.indexOf(this._shoulderMode)
  this._shoulderMode = modes[(currentIndex + 1) % modes.length]

  const targetSide = this._shoulderMode === 'right' ? 1
    : this._shoulderMode === 'left' ? -1
    : 0
  const targetHeight = this._shoulderMode === 'center'
    ? this.config.follow.centerElevated.heightBoost
    : 0

  gsap.to(this, {
    _sideFactor: targetSide,
    _heightBoost: targetHeight,
    duration: 0.6,
    ease: 'power2.inOut',
    overwrite: true,
  })
}
```

**改动 3：新增 `setRearView(active)` 方法**

```javascript
setRearView(active) {
  const duration = this.config.follow.rearView.transitionDuration
  gsap.to(this, {
    _rearViewFactor: active ? 1 : 0,
    duration,
    ease: active ? 'power2.out' : 'power2.in',
    overwrite: true,
  })
}
```

**改动 4：修改 `_updateCameraOffset(dt)` 应用新因子**

在步骤 4（驱动 cameraAnchor）中：

```diff
-this.cameraAnchor.position.set(
-  this._targetOffset.x * this._sideFactor,
-  this._targetOffset.y,
-  this._targetOffset.z,
-)
+// 后视镜：Z 和 X 方向翻转
+const rv = this._rearViewFactor
+const effectiveX = this._targetOffset.x * this._sideFactor * (1 - 2 * rv)
+const effectiveY = this._targetOffset.y + this._heightBoost
+const effectiveZ = this._targetOffset.z * (1 - 2 * rv)
+this.cameraAnchor.position.set(effectiveX, effectiveY, effectiveZ)
```

在步骤 5（目标点偏移）中：

```diff
-this.targetAnchor.position.set(
-  targetLookOffset.x,
-  targetLookOffset.y + this.mouseYOffset,
-  targetLookOffset.z,
-)
+const effectiveTargetZ = targetLookOffset.z * (1 - 2 * rv)
+this.targetAnchor.position.set(
+  targetLookOffset.x,
+  targetLookOffset.y + this.mouseYOffset,
+  effectiveTargetZ,
+)
```

**改动 5：在 `_setupEventListeners()` 中监听后视镜事件**

```javascript
emitter.on('input:rear_view', (isActive) => {
  this.setRearView(isActive)
})
```

---

### Component 3: Input

#### [MODIFY] [input.js](file:///e:/圖形學/Third-Person-MC/src/js/utils/input/input.js)

**改动 1：添加 `y` 键状态**

```diff
 this.keys = {
   // ...existing...
   capslock: false,
+  y: false,
 }
```

**改动 2：在 `updateKey()` 中处理 Y 键 (持续状态)**

```javascript
case 'y':
  this.keys.y = isPressed
  emitter.emit('input:rear_view', isPressed)
  break
```

> **注意**：Y 键使用**持续状态**模式（按下/松开都发事件），而非 Tab 的**单次触发**模式。这是因为 rear-view 需要按住持续生效、松开立即恢复。

---

## 实施步骤

### Task 1: 扩展配置

**Files:**
- Modify: `src/js/camera/camera-rig-config.js`

**Step 1:** 在 `follow` 对象内添加 `centerElevated` 和 `rearView` 配置。

**Step 2:** 确认 `pnpm dev` 无报错。

---

### Task 2: CameraRig 三态肩膀循环

**Files:**
- Modify: `src/js/camera/camera-rig.js`

**Step 1:** 在构造函数中替换 `_currentSide`/`_sideFactor` 为 `_shoulderMode`/`_sideFactor`/`_heightBoost`/`_rearViewFactor`。

**Step 2:** 替换 `toggleSide()` 方法为三态循环逻辑。

**Step 3:** 修改 `_updateCameraOffset()` 中的 cameraAnchor 位置计算，应用 `_heightBoost`。

**Step 4:** 确认 `pnpm dev` 无报错，测试 Tab 循环三种状态。

---

### Task 3: Y 键输入 + 后视镜逻辑

**Files:**
- Modify: `src/js/utils/input/input.js`
- Modify: `src/js/camera/camera-rig.js`

**Step 1:** 在 `input.js` 的 `keys` 中添加 `y: false`，在 `updateKey()` 中添加 `case 'y'`，发送 `input:rear_view` 事件。

**Step 2:** 在 `camera-rig.js` 中添加 `setRearView()` 方法。

**Step 3:** 在 `_setupEventListeners()` 中监听 `input:rear_view` 事件。

**Step 4:** 修改 `_updateCameraOffset()` 中的 cameraAnchor 和 targetAnchor 计算，应用 `_rearViewFactor`。

**Step 5:** 确认 `pnpm dev` 无报错，测试 Y 按住/松开效果。

---

### Task 4: Debug 面板更新

**Files:**
- Modify: `src/js/camera/camera-rig.js` (setDebug 方法)

**Step 1:** 在 debug 面板中添加当前 `_shoulderMode` 只读显示和 `_rearViewFactor` 只读监控。

---

## Verification Plan

### Manual Verification (浏览器内测试)

本项目无自动化测试覆盖相机模块，验证通过浏览器内手动操作：

1. **启动开发服务器**: `pnpm dev` → 浏览器打开游戏
2. **Tab 三态循环测试**:
   - 按 Tab → 相机从右肩平滑过渡到左肩（X 从正变负）
   - 再按 Tab → 相机平滑过渡到正后方居中，Y 轴明显拔高
   - 再按 Tab → 回到右肩初始位置
   - 快速连按 Tab → 无卡顿、无闪烁（GSAP overwrite 正常）
3. **Y 键后视镜测试**:
   - 按住 Y → 相机平滑移到玩家前方，画面看向后方
   - 松开 Y → 相机平滑恢复到正常越肩位置
   - 在移动中按住 Y → 后视镜跟随正常，无抖动
   - 在右肩/左肩/居中三种模式下分别测试 Y 键 → 均正常镜像
4. **洞穴兼容测试**:
   - 进入洞穴 → 洞内模式偏移正常
   - 在洞内按 Tab 和 Y → 行为正常，无穿模
5. **鸟瞰模式隔离**:
   - 切换到鸟瞰模式 → Tab 和 Y 键无反响（guard 生效）
