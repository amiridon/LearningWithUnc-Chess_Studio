# LearningWithUnc-Chess_Studio

Real-time 3D chess presentation studio for LearningWithUnc.

## Local run

Use any static server, for example:

```bash
python -m http.server 8080
```

Then open `http://127.0.0.1:8080`.

## Camera and presentation controls

- `Top down` and `Reference angle` camera presets
- `Fit board` quick framing
- `Presentation` toggle for clean capture mode
- Keyboard shortcuts: `R` (reset angle), `F` (fit board), `Esc` (exit presentation)
- Double-click a square/piece area to focus the camera target

## Visual regression workflow

1. Install dependencies:
   ```bash
   npm install
   ```
2. Install Playwright Chromium once:
   ```bash
   npx playwright install chromium
   ```
3. Capture/update baselines:
   ```bash
   npm run visual:update
   ```
4. Run visual regression check:
   ```bash
   npm run visual:check
   ```

Outputs:

- `visual/baseline/*.png`
- `visual/current/*.png`
- `visual/diff/*.png`
- `visual/report.md`
