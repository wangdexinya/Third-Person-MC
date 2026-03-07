# How to Play 新手教學小冊重構設計

**日期：** 2026-03-07  
**目標：** 重構 How to Play 教學小冊，使其與戰鬥系統、成就系統及當前操作按鍵一致。

---

## 1. 概述與範圍

### 目標
重構 How to Play 教學小冊，使其與戰鬥系統、成就系統及當前操作按鍵一致。

### 範圍
- **修改檔案：** `src/vue/components/menu/HowToPlay.vue`（僅此檔）
- **頁數：** 5 頁（移除 Quick Start，新增 Achievements）
- **做法：** 最小改動，僅更新 `pages` 陣列與必要邏輯

### 頁面順序（5 頁）

| # | 頁面 ID        | 標題                    |
|---|----------------|-------------------------|
| 1 | movement-camera | Move & Camera           |
| 2 | combat          | Combat Basics           |
| 3 | build-edit      | Build / Edit            |
| 4 | achievements    | Achievements & Progress |
| 5 | tips-ui         | Tips & UI               |

### 非本次範圍
- 不接入 i18n（維持硬編碼英文）
- 不新增 config 檔
- 不變更組件結構或樣式

---

## 2. 各頁內容與按鍵表

### 頁 1：Move & Camera
- **body：**
  - `'Move with WASD or Arrow Keys.'`
  - `'Hold Shift to sprint.'`
  - `'Hold V to sneak for control.'`
  - `'Press Q or E to switch camera shoulder (left/right).'`
  - `'Hold Tab for telescope zoom. Press Y to look back.'`
- **keybinds：** Move / Jump / Sprint / Sneak / Camera Left (Q) / Camera Right (E) / Telescope (Tab) / Look Back (Y)

### 頁 2：Combat Basics
- **body：**
  - `'Press Z for a light attack (combo).'`
  - `'Press X for a heavy attack.'`
  - `'Hold C to block and time your defense.'`
- **keybinds：** Light Attack (Z) / Heavy Attack (X) / Block (C)

### 頁 3：Build / Edit
- **body：**
  - `'Left click to mine or break blocks.'`
  - `'Right click to place blocks.'`
  - `'Same as vanilla Minecraft.'`
- **keybinds：** Mine / Break (Mouse Left) / Place (Mouse Right)

### 頁 4：Achievements & Progress
- **body：**
  - `'Complete actions to unlock achievements.'`
  - `'View your progress in the Achievements menu from Main Menu or Pause Menu.'`
  - `'Achievements reset when you create a new world.'`
- **keybinds：** Open Menu (Esc) / Achievements (Main Menu / Pause)

### 頁 5：Tips & UI
- **body：**
  - `'Stay calm: move, hit, reset.'`
  - `'Sprint to reposition and commit when it's safe.'`
  - `'Sneak (V) for tighter control when you need it.'`
  - `'Press Esc anytime to return to the menu.'`
  - `'Press R to respawn if stuck.'`
  - `'Settings can adjust view distance.'`
- **keybinds：** Open Menu (Esc) / Respawn (R)

---

## 3. 圖片占位符與每格內容規格

### 占位符行為
- 圖片路徑：`/img/howToPlayer/{page}-{cell}.png`（如 `1-1.png`, `1-2.png`）
- 若圖片不存在或載入失敗：顯示現有 CSS 漸層占位（不顯示破圖）
- 可選：在 `<img>` 上加 `@error`，失敗時切換為占位 div

### 頁 1：Move & Camera（`1-1` ~ `1-4`）

| 格 | 檔名   | 應包含內容                         |
|----|--------|------------------------------------|
| 1  | `1-1.png` | 角色跑動，可選 W 或 A/S/D 鍵帽     |
| 2  | `1-2.png` | 衝刺，Shift 鍵帽                   |
| 3  | `1-3.png` | 潛行低姿態，V 鍵帽                 |
| 4  | `1-4.png` | 左肩/右肩切換，Q/E 鍵帽            |

### 頁 2：Combat Basics（`2-1` ~ `2-4`）

| 格 | 檔名   | 應包含內容                         |
|----|--------|------------------------------------|
| 1  | `2-1.png` | 輕攻擊瞬間，Z 鍵帽                 |
| 2  | `2-2.png` | 重攻擊瞬間，X 鍵帽                 |
| 3  | `2-3.png` | 格擋動作，C 鍵帽                   |
| 4  | `2-4.png` | 夜間場景，殭屍出沒                 |

### 頁 3：Build / Edit（`3-1` ~ `3-4`）

| 格 | 檔名   | 應包含內容                         |
|----|--------|------------------------------------|
| 1  | `3-1.png` | 左鍵挖掘，滑鼠左鍵造型             |
| 2  | `3-2.png` | 挖掘中/方塊碎裂                    |
| 3  | `3-3.png` | 右鍵放置，滑鼠右鍵造型             |
| 4  | `3-4.png` | 放置後的小結構（台階/掩體）        |

### 頁 4：Achievements & Progress（`4-1` ~ `4-4`）

| 格 | 檔名   | 應包含內容                         |
|----|--------|------------------------------------|
| 1  | `4-1.png` | 成就解鎖瞬間（光效/提示）          |
| 2  | `4-2.png` | 主選單中的成就按鈕                  |
| 3  | `4-3.png` | 成就列表畫面（已解鎖/未解鎖）      |
| 4  | `4-4.png` | 總結：玩家在傳送門旁，準備出發     |

### 頁 5：Tips & UI（`5-1` ~ `5-4`）

| 格 | 檔名   | 應包含內容                         |
|----|--------|------------------------------------|
| 1  | `5-1.png` | 衝刺換位，Shift 鍵帽               |
| 2  | `5-2.png` | 潛行控制，V 鍵帽                   |
| 3  | `5-3.png` | 隨時退出，Esc 鍵帽                 |
| 4  | `5-4.png` | 重生，R 鍵帽                       |

### 圖片通用規範
- 風格：Minecraft 方塊、像素感
- 比例：每格約 1:1（四格合為 2×2）
- 禁止：HUD、UI 文字、說明標籤、水印
- 允許：實體鍵帽/滑鼠造型作為場景道具

---

## 4. 錯誤處理與驗收

### 錯誤處理
- 圖片載入失敗時：依賴現有 `.comicCell` 漸層背景，不顯示破圖
- 可選：`<img @error="e => e.target.style.display='none'"` 隱藏破圖，保留占位背景

### 驗收清單
- [ ] 主選單點擊 How to Play 可進入
- [ ] 共 5 頁，順序正確（Move & Camera → Combat → Build/Edit → Achievements → Tips）
- [ ] 第 1 頁 Back 返回主選單 root
- [ ] 第 5 頁 Done 返回主選單 root
- [ ] ESC 從 How to Play 返回主選單 root
- [ ] ArrowLeft / ArrowRight 可翻頁
- [ ] 按鍵表與實際操作一致（Q/E 視角、Tab 望遠鏡、Y 後視、左鍵挖掘、右鍵放置）

---

## 5. 後續（圖片生成）

圖片生成完成後，放入 `public/img/howToPlayer/`，檔名對應上表。  
若路徑或命名有變更，需同步更新 `HowToPlay.vue` 中的 `images` 陣列。
