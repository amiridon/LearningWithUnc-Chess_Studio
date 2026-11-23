# Development Log

## 2026-11-23

### Improvements
- Added presentation-focused controls to `index.html` (`Fit board`, `Presentation`, keyboard shortcuts).
- Added query-driven startup camera poses (`pose=reference|top|fit`) and presentation mode (`presentation=1`, `hud=0`).
- Added double-click camera focus targeting for live explanation workflows.
- Added a `window.__sceneReady` signal for automated visual validation readiness.

### Tooling
- Added Playwright visual regression workflow (`scripts/visual-regression.mjs`).
- Added npm scripts for baseline updates and regression checks.

### Remaining gaps
- Piece geometry still depends on downloadable external models and fallback procedural meshes.
- PGN import, move navigation, and annotations are still pending.
