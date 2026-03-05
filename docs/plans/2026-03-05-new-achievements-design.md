# New Achievements Design

## Overview
Based on user feedback, we are adding 3 new, easy-to-achieve, and fun achievements to the game. The detection logic is optimized for performance by relying on simple counters and timestamps rather than complex coordinate tracking or raycasting.

## Achievements

### 1. 徒步旅行者 (Hiker)
* **Description**: "A journey of a thousand miles begins with a single step." (Travel a certain distance)
* **Simplified Goal**: Continuously or repeatedly move a noticeable amount.
* **Detection Logic**:
  * Increment a `moveCounter` inside the `input:update` event handler whenever movement keys (W, A, S, D) are pressed.
  * *Threshold*: Unlock when `moveCounter > 500`.
  * *Performance*: Negligible overhead, piggybacks on the existing input update loop.

### 2. 无能狂怒 (Rage Quit / Inept)
* **Description**: "Punching the air..." (Punch consecutive times without hitting anything)
* **Simplified Goal**: Spam the punch button multiple times quickly.
* **Detection Logic**:
  * Maintain a `punchCount` variable.
  * Listen for `input:punch_straight` and `input:punch_hook` events. Increment `punchCount` on trigger.
  * Listen for any interact events (`player:block_place`, `player:block_break`, `player:damage_enemy`, `player:take_damage`) to reset `punchCount` to 0.
  * *Threshold*: Unlock when `punchCount >= 10`.

### 3. 我是谁我在那 (Who Am I, Where Am I)
* **Description**: "Dizzy yet?" (Rapidly switch camera perspectives)
* **Simplified Goal**: Press the toggle view buttons repeatedly and quickly.
* **Detection Logic**:
  * Maintain `cameraSwitchCount` and `lastCameraSwitchTime`.
  * Listen for `input:camera_shoulder_left`, `input:camera_shoulder_right`, or similar view-switching events.
  * If the time since `lastCameraSwitchTime` is less than `1000ms`, increment `cameraSwitchCount`. Otherwise, reset `cameraSwitchCount` to `1`.
  * Update `lastCameraSwitchTime`.
  * *Threshold*: Unlock when `cameraSwitchCount >= 5`.

## Next Steps
We will process the implementation plan via the `writing-plans` skill.
