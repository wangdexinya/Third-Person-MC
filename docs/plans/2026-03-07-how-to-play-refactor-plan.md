# How to Play 新手教學小冊重構 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重構 How to Play 教學小冊，使其與戰鬥系統、成就系統及當前操作按鍵一致。

**Architecture:** 僅修改 `HowToPlay.vue` 的 `pages` 陣列，移除 Quick Start，修正 Move & Camera 按鍵，修改 Build/Edit 為左鍵挖掘右鍵放置，新增 Achievements 頁，維持 2×2 四格圖片結構。

**Tech Stack:** Vue 3, Pinia (uiStore)

**設計文件：** `docs/plans/2026-03-07-how-to-play-refactor-design.md`

---

## Task 1: 更新 pages 陣列（5 頁內容）

**Files:**
- Modify: `src/vue/components/menu/HowToPlay.vue`

**Step 1: 替換 pages 陣列**

將現有 `pages` 陣列替換為以下內容（對應設計文件 Section 2）：

```js
const pages = [
  {
    id: 'movement-camera',
    title: 'Move & Camera',
    illustrationLayout: 'comic2x2',
    images: ['1-1.png', '1-2.png', '1-3.png', '1-4.png'],
    body: [
      'Move with WASD or Arrow Keys.',
      'Hold Shift to sprint.',
      'Hold V to sneak for control.',
      'Press Q or E to switch camera shoulder (left/right).',
      'Hold Tab for telescope zoom. Press Y to look back.',
    ],
    keybinds: [
      { action: 'Move', key: 'W/A/S/D (or Arrow Keys)' },
      { action: 'Jump', key: 'Space' },
      { action: 'Sprint', key: 'Shift' },
      { action: 'Sneak', key: 'V' },
      { action: 'Camera Left', key: 'Q' },
      { action: 'Camera Right', key: 'E' },
      { action: 'Telescope', key: 'Tab' },
      { action: 'Look Back', key: 'Y' },
    ],
  },
  {
    id: 'combat',
    title: 'Combat Basics',
    illustrationLayout: 'comic2x2',
    images: ['2-1.png', '2-2.png', '2-3.png', '2-4.png'],
    body: [
      'Press Z for a light attack (combo).',
      'Press X for a heavy attack.',
      'Hold C to block and time your defense.',
    ],
    keybinds: [
      { action: 'Light Attack', key: 'Z' },
      { action: 'Heavy Attack', key: 'X' },
      { action: 'Block', key: 'C' },
    ],
  },
  {
    id: 'build-edit',
    title: 'Build / Edit',
    illustrationLayout: 'comic2x2',
    images: ['3-1.png', '3-2.png', '3-3.png', '3-4.png'],
    body: [
      'Left click to mine or break blocks.',
      'Right click to place blocks.',
      'Same as vanilla Minecraft.',
    ],
    keybinds: [
      { action: 'Mine / Break', key: 'Mouse Left' },
      { action: 'Place', key: 'Mouse Right' },
    ],
  },
  {
    id: 'achievements',
    title: 'Achievements & Progress',
    illustrationLayout: 'comic2x2',
    images: ['4-1.png', '4-2.png', '4-3.png', '4-4.png'],
    body: [
      'Complete actions to unlock achievements.',
      'View your progress in the Achievements menu from Main Menu or Pause Menu.',
      'Achievements reset when you create a new world.',
    ],
    keybinds: [
      { action: 'Open Menu', key: 'Esc' },
      { action: 'Achievements (in menu)', key: 'Main Menu / Pause' },
    ],
  },
  {
    id: 'tips-ui',
    title: 'Tips & UI',
    illustrationLayout: 'comic2x2',
    images: ['5-1.png', '5-2.png', '5-3.png', '5-4.png'],
    body: [
      'Stay calm: move, hit, reset.',
      'Sprint to reposition and commit when it\'s safe.',
      'Sneak (V) for tighter control when you need it.',
      'Press Esc anytime to return to the menu.',
      'Press R to respawn if stuck.',
      'Settings can adjust view distance.',
    ],
    keybinds: [
      { action: 'Open Menu', key: 'Esc' },
      { action: 'Respawn', key: 'R' },
    ],
  },
]
```

**Step 2: 確認 progressLabel 與 backLabel / nextLabel 邏輯**

現有 `progressLabel`、`backLabel`、`nextLabel` 依賴 `pages.length` 與 `currentIndex`，無需修改（5 頁會自動顯示 1/5 ~ 5/5）。

**Step 3: 執行 lint**

Run: `pnpm lint`  
Expected: 無新增錯誤

**Step 4: Commit**

```bash
git add src/vue/components/menu/HowToPlay.vue
git commit -m "refactor(howto): update pages for combat, achievements, controls"
```

---

## Task 2: 圖片載入失敗時隱藏破圖（可選）

**Files:**
- Modify: `src/vue/components/menu/HowToPlay.vue`

**Step 1: 為 img 添加 @error 處理**

在 template 中，為 `<img>` 添加 `@error`，載入失敗時隱藏圖片，保留 `.comicCell` 漸層占位：

```html
<img
  :src="`/img/howToPlayer/${imgName}`"
  :alt="imgName"
  class="comicImg"
  loading="lazy"
  @error="(e) => { e.target.style.display = 'none' }"
>
```

**Step 2: Commit**

```bash
git add src/vue/components/menu/HowToPlay.vue
git commit -m "fix(howto): hide broken images on load error"
```

---

## Task 3: 手動驗收

**Step 1: 啟動開發伺服器**

Run: `pnpm dev`

**Step 2: 驗收清單**

- [ ] 主選單點擊 How to Play 可進入
- [ ] 共 5 頁，順序正確
- [ ] 第 1 頁 Back 返回主選單 root
- [ ] 第 5 頁 Done 返回主選單 root
- [ ] ESC 返回主選單 root
- [ ] ArrowLeft / ArrowRight 可翻頁
- [ ] 按鍵表與實際操作一致

---

## Manual QA Checklist（合併前）

- [ ] Main Menu Root 能點擊 How to Play
- [ ] How to Play 頁碼顯示正確（1/5 ~ 5/5）
- [ ] Next/Back 翻頁不越界
- [ ] 第 1 頁 Back 返回主選單 root
- [ ] 第 5 頁 Done 返回主選單 root
- [ ] ESC 從 How to Play 返回主選單 root
- [ ] ArrowLeft/ArrowRight 可翻頁
