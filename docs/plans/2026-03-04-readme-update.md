# README Update for New Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the project README.md to document newly implemented features including Day-Cycle, Enemy AI, and Combat systems.

**Architecture:** Modify existing sections (Highlights, TODOs, Controls) and append a new dedicated section "动态生态与战斗生存" with image placeholders to showcase these features.

**Tech Stack:** Markdown

---

### Task 1: Update Core Highlights, Controls and TODOs

**Files:**
- Modify: `README.md`

**Step 1: Modify Introduction and Core Highlights**
Add descriptions for the Day-Cycle system and Enemy AI in the `## 核心亮点（来自项目与实现现实）` section.

**Step 2: Update Controls**
Ensure the `## 玩法与按键操作` table reflects combat mechanics conceptually (e.g., survival pressure at night).

**Step 3: Update TODO List**
Tick off completed tasks in `## 未完成内容 (TODO)` such as "敌人锁定特效" (if partially done) or add new relevant TODOs (like "掉落物品系统", "更多敌人种类").

**Step 4: Review Markdown formatting**
Visually verify the Markdown layout locally.

**Step 5: Commit**
```bash
git add README.md
git commit -m "docs: update highlights, controls and TODOs for new features"
```

### Task 2: Add Dynamic Ecology & Combat Section

**Files:**
- Modify: `README.md`

**Step 1: Create New Section**
Insert `## 动态生态与战斗生存` (Dynamic Ecology & Combat Survival) before `## 相机自适应与 HUD` or `## 项目技术栈`.

**Step 2: Add Text and Image Placeholders**
Write descriptive text for Day-Cycle, Enemies, Combat effects, and Night atmosphere. Use image placeholders formatted as `![](XXX描述图片内容)`.
For example:
- `![](昼夜交替的时光流逝GIF：展示黄昏到午夜的动态过渡，天空变暗、星星出现、HUD指针转动)`
- `![](夜间氛围与凝视压迫感截图：僵尸追逐、萤火虫微粒飞舞与屏幕边缘红紫色Gaze Shader黑边)`
- `![](战斗打击反馈GIF：玩家攻击击中僵尸的瞬间，僵尸闪红变色并产生击退效果)`

**Step 3: Review Document**
Verify README.md structure.

**Step 4: Commit**
```bash
git add README.md
git commit -m "docs: insert dynamic ecology and combat section with image placeholders"
```
