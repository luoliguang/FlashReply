# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server (local browser preview with mock preload)
npm run build    # Build to dist/ for uTools plugin loading
```

No test runner is configured. Validate changes by running `npm run dev` and testing in browser.

## What This Is

A [uTools](https://u.tools) plugin for customer service quick-reply management. Users invoke it via hotkey, search for a reply template, and copy it (with optional variable substitution and image attachment). Built with Vue 3 + Vite + Pinia + Naive UI.

The compiled `dist/` is what uTools loads — not the source. After `npm run build`, load the `dist/` folder in uTools developer mode to test the real plugin behavior.

## Architecture

### Two Pages

| Page | Route | Purpose |
|------|-------|---------|
| `src/pages/Main.vue` | `/` | Daily use: search → select → copy |
| `src/pages/Admin.vue` | `/admin` | Manage answers and categories |

`App.vue` uses `utools.onPluginEnter({ code })` to route to `/admin` or `/` on plugin activation.

### Data Flow

```
uTools db (persistent) 
  └── preload.js (Node env, exposed as window.preload)
        └── src/utils/db.js (AnswerDB / CategoryDB wrappers)
              └── Pinia stores (answers.js, categories.js)
                    └── Vue components
```

- All DB access goes through `src/utils/db.js` — never call `window.preload.db` directly in components.
- Stores load once in `App.vue` `onMounted`. Write operations update DB first, then patch store state in-memory (no full reload).
- Document IDs: categories use `cat_` prefix, answers use `ans_`, images use `img_` (images are split into separate records when an answer would exceed uTools' 1MB per-document limit).

### Copy Flow (the core UX)

`copyFlow(answer)` in `src/utils/clipboard.js`:
1. If `answer.variables.length > 0` → open `VarFillModal` (Promise-based, awaited)
2. Copy text via `navigator.clipboard.writeText`
3. Increment `useCount` via store
4. If images exist → open `ImageViewer` for per-image copy; else `window.preload.hideMainWindow()`

### Variable System

Template syntax: `{{变量名}}` in answer content.
- `parseVariables(content)` → extract unique variable names
- `fillVariables(content, vars)` → replace with user-provided values

### Search

Fuse.js with weights: `title` 0.6, `tags` 0.3, `content` 0.1, threshold 0.35. Empty query returns full list sorted by `useCount` descending. No debounce — immediate response is intentional.

## Local Development

`src/utils/mock-preload.js` provides an in-memory mock of `window.preload` for browser dev. It's imported at the top of `src/main.js`. The real `preload.js` (in `public/`) runs in uTools' Node environment and is not bundled by Vite.

Router must use **hash mode** (`createWebHashHistory`) — uTools loads via `file://` protocol.

Vite config must set `base: './'` for local file loading to work.

## UI System

Dark theme, "precision tool" aesthetic. All colors via CSS variables — never hardcode hex values.

Key variables: `--bg-base #141414`, `--bg-surface #1e1e1e`, `--bg-elevated #2a2a2a`, `--bg-hover #323232`, `--accent #3b82f6`, `--text-primary #f0f0f0`, `--text-secondary #9ca3af`, `--border #2e2e2e`.

4px spacing grid: `--spacing-xs: 4px` through `--spacing-xl: 24px`.

Tag colors are assigned by hashing the tag string into a 6-color palette (see `src/utils/tag-color.js`).

Animations stay ≤ 250ms. No decorative transitions.

## Code Conventions

Vue SFC order: `<script setup>` → `<template>` → `<style scoped>`. All styles scoped.

`<script setup>` block order: imports → props/emits → stores → reactive data → computed → methods → lifecycle hooks.

Props must have explicit `type` and `default`. Use `async/await` (not `.then()`). Guard debug logs: `if (window.preload.isDev()) console.log(...)`.

When answer list exceeds 50 items, use Naive UI `n-virtual-list`. Don't re-instantiate `Fuse` on every keystroke — reuse the instance.

## uTools Integration Notes

- `plugin.json` defines two feature codes: `main` (opens Main page) and `admin` (opens Admin page)
- `preload.js` uses `contextBridge.exposeInMainWorld` to expose `db`, `hideMainWindow`, `showMainWindow`, `isDev`
- Lifecycle hooks to use: `onPluginEnter` (reset/focus), `onPluginOut` (clear state), `onPluginDetach` (save drafts)
- Do not use `require('fs')` or other Node filesystem APIs in preload — all persistence goes through `utools.db`
