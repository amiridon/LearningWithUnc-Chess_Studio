import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const updateBaseline = process.argv.includes('--update-baseline');
const rootDir = process.cwd();
const visualDir = path.join(rootDir, 'visual');
const baselineDir = path.join(visualDir, 'baseline');
const currentDir = path.join(visualDir, 'current');
const diffDir = path.join(visualDir, 'diff');

const snapshots = [
  { name: 'reference', url: 'http://127.0.0.1:4173/?pose=reference&presentation=1&hud=0' },
  { name: 'top', url: 'http://127.0.0.1:4173/?pose=top&presentation=1&hud=0' },
  { name: 'fit', url: 'http://127.0.0.1:4173/?pose=fit&presentation=1&hud=0' }
];

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

async function ensureDirs() {
  await fs.mkdir(baselineDir, { recursive: true });
  await fs.mkdir(currentDir, { recursive: true });
  await fs.mkdir(diffDir, { recursive: true });
}

function startServer() {
  const server = http.createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const safePath = requestPath === '/' ? '/index.html' : requestPath;
    const targetPath = path.resolve(rootDir, `.${safePath}`);

    if (!targetPath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!fsSync.existsSync(targetPath) || fsSync.statSync(targetPath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': getMimeType(targetPath), 'Cache-Control': 'no-cache' });
    fsSync.createReadStream(targetPath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(4173, '127.0.0.1', () => resolve(server));
  });
}

async function compareImages(currentPath, baselinePath, diffPath) {
  const [currentData, baselineData] = await Promise.all([fs.readFile(currentPath), fs.readFile(baselinePath)]);
  const currentPng = PNG.sync.read(currentData);
  const baselinePng = PNG.sync.read(baselineData);
  if (currentPng.width !== baselinePng.width || currentPng.height !== baselinePng.height) {
    throw new Error(`Image size mismatch: current=${currentPng.width}x${currentPng.height}, baseline=${baselinePng.width}x${baselinePng.height}`);
  }

  const diffPng = new PNG({ width: currentPng.width, height: currentPng.height });
  const diffPixels = pixelmatch(currentPng.data, baselinePng.data, diffPng.data, currentPng.width, currentPng.height, { threshold: 0.12 });
  await fs.writeFile(diffPath, PNG.sync.write(diffPng));
  const totalPixels = currentPng.width * currentPng.height;
  return { diffPixels, diffRatio: diffPixels / totalPixels };
}

async function captureSnapshots() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
  const page = await context.newPage();
  const results = [];

  for (const snapshot of snapshots) {
    await page.goto(snapshot.url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__sceneReady === true, null, { timeout: 20000 });
    await page.waitForTimeout(500);

    const currentPath = path.join(currentDir, `${snapshot.name}.png`);
    const baselinePath = path.join(baselineDir, `${snapshot.name}.png`);
    const diffPath = path.join(diffDir, `${snapshot.name}.png`);
    await page.screenshot({ path: currentPath, fullPage: true });

    let status = 'captured';
    let diffRatio = null;
    if (updateBaseline) {
      await fs.copyFile(currentPath, baselinePath);
      status = 'baseline-updated';
    } else {
      try {
        await fs.access(baselinePath);
        const comparison = await compareImages(currentPath, baselinePath, diffPath);
        diffRatio = comparison.diffRatio;
        status = comparison.diffRatio <= 0.02 ? 'pass' : 'drift';
      } catch {
        status = 'missing-baseline';
      }
    }

    results.push({ name: snapshot.name, status, diffRatio });
  }

  await browser.close();
  return results;
}

async function writeReport(results) {
  const reportPath = path.join(visualDir, 'report.md');
  const lines = [
    '# Visual Regression Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '| Snapshot | Status | Diff Ratio |',
    '|---|---|---|'
  ];

  for (const result of results) {
    const ratio = result.diffRatio === null ? 'n/a' : `${(result.diffRatio * 100).toFixed(3)}%`;
    lines.push(`| ${result.name} | ${result.status} | ${ratio} |`);
  }

  await fs.writeFile(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  await ensureDirs();
  const server = await startServer();
  try {
    const results = await captureSnapshots();
    await writeReport(results);
    const drift = results.find(item => item.status === 'drift');
    const missingBaseline = results.find(item => item.status === 'missing-baseline');
    if (drift) throw new Error('Visual drift exceeded threshold. See visual/report.md and visual/diff/*.png');
    if (missingBaseline && !updateBaseline) throw new Error('Baseline missing. Run npm run visual:update first.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
