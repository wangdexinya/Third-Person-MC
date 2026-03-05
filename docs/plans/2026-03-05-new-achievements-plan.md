# New Achievements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 3 new, simple-to-achieve achievements ("Hiker", "Rage Quit", "Who Am I, Where Am I") into the existing achievement system.

**Architecture:** We will add 3 new achievement definitions to the `achievementStore`, add their localized text to `zh.json` and `en.json`, and implement the simplified, zero-overhead detection logic in `achievement-controller.js` using event listeners.

**Tech Stack:** Vue 3 (Pinia), JavaScript, standard event emitter.

---

### Task 1: Update Achievement Store and Locales

**Files:**
- Modify: `src/pinia/achievementStore.js`
- Modify: `src/locales/zh.json`
- Modify: `src/locales/en.json`

**Step 1: Add to Store**
In `src/pinia/achievementStore.js`, add to `ACHIEVEMENTS` array:
```javascript
  { id: 'hiker', iconPath: '/img/achievement/first_run.png' }, // placeholder icon
  { id: 'rage_quit', iconPath: '/img/achievement/first_punch.png' }, // placeholder icon
  { id: 'who_am_i', iconPath: '/img/achievement/first_perspective.png' }, // placeholder icon
```
*(We reuse existing icons for now until new ones are provided)*

**Step 2: Add zh.json translations**
In `src/locales/zh.json` under `ui.achievement`:
```json
      "hiker": { "title": "徒步旅行者", "desc": "累计持续移动一段时间" },
      "rage_quit": { "title": "无能狂怒", "desc": "连续多次挥拳打空气" },
      "who_am_i": { "title": "我是谁我在那", "desc": "短时间内快速切换视角" },
```

**Step 3: Add en.json translations**
In `src/locales/en.json` under `ui.achievement`:
```json
      "hiker": { "title": "Hiker", "desc": "Keep moving for a while" },
      "rage_quit": { "title": "Inept / Rage Quit", "desc": "Punch the air continuously" },
      "who_am_i": { "title": "Who Am I, Where Am I", "desc": "Rapidly switch camera perspectives" },
```

**Step 4: Commit**
```bash
git add src/pinia/achievementStore.js src/locales/zh.json src/locales/en.json
git commit -m "feat(achievements): add definitions and locales for new achievements"
```

### Task 2: Implement Detection Logic

**Files:**
- Modify: `src/js/interaction/achievement-controller.js`

**Step 1: Implement Detection in Controller**
Modify the `constructor` of `AchievementController` to initialize tracking variables:
```javascript
    this.moveCounter = 0;
    this.punchCount = 0;
    this.cameraSwitchCount = 0;
    this.lastCameraSwitchTime = 0;
```

Modify `setupListeners` to add the detection logic for the three achievements.
*For Hiker:*
In the existing `input:update` listener, independent of the `first_run` logic:
```javascript
    const onInputUpdate = (keys) => {
      if (keys.shift && (keys.forward || keys.backward || keys.left || keys.right)) {
        this.store.unlock('first_run')
        emitter.off('input:update', onInputUpdate)
      }
      
      // Hiker logic
      if (!this.store.unlocked['hiker']) {
        if (keys.forward || keys.backward || keys.left || keys.right) {
          this.moveCounter++;
          if (this.moveCounter > 500) {
            this.store.unlock('hiker');
          }
        }
      }
    }
```
*(Note: Be careful not to unbind the whole `onInputUpdate` from `first_run`. You might need to separate them if `first_run` unbinds the whole function. A better approach is to remove `emitter.off('input:update', onInputUpdate)` and just let it run, or separate Hiker into its own named function!)*

Let's refine the plan's code for Hiker:
```javascript
    const onHikerUpdate = (keys) => {
      if (!this.store.unlocked['hiker']) {
        if (keys.forward || keys.backward || keys.left || keys.right) {
          this.moveCounter++;
          if (this.moveCounter > 500) {
            this.store.unlock('hiker');
            emitter.off('input:update', onHikerUpdate);
          }
        }
      }
    }
    emitter.on('input:update', onHikerUpdate);
```

*For Rage Quit:*
```javascript
    const onPunch = () => {
      if (!this.store.unlocked['rage_quit']) {
        this.punchCount++;
        if (this.punchCount >= 10) {
          this.store.unlock('rage_quit');
        }
      }
    };
    emitter.on('input:punch_straight', onPunch);
    emitter.on('input:punch_hook', onPunch);

    const resetPunch = () => {
      this.punchCount = 0;
    };
    emitter.on('player:block_place', resetPunch);
    emitter.on('player:block_break', resetPunch);
    emitter.on('player:damage_enemy', resetPunch);
    emitter.on('player:take_damage', resetPunch);
```

*For Who Am I:*
```javascript
    const onCameraSwitch = () => {
      if (!this.store.unlocked['who_am_i']) {
        const now = performance.now();
        if (now - this.lastCameraSwitchTime < 1000) {
          this.cameraSwitchCount++;
          if (this.cameraSwitchCount >= 5) {
            this.store.unlock('who_am_i');
          }
        } else {
          this.cameraSwitchCount = 1;
        }
        this.lastCameraSwitchTime = now;
      }
    };
    emitter.on('input:camera_shoulder_left', onCameraSwitch);
    emitter.on('input:camera_shoulder_right', onCameraSwitch);
```

**Step 2: Commit**
```bash
git add src/js/interaction/achievement-controller.js
git commit -m "feat(achievements): implement detection logic for 3 new achievements"
```

### Task 3: Verify Implementation

**Step 1: Test New Achievements**
- Start the game (`pnpm run dev`).
- Test "Who Am I": Mash the change view key 5 times quickly. Check for the toast notification.
- Test "Rage Quit": Left-click repeatedly in the air 10 times without hitting anything. Check for toast.
- Test "Hiker": Hold W and run around for a few seconds until the counter hits 500. Check for toast.
