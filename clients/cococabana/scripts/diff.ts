/**
 * VAEO Visual Diff Engine
 *
 * Compares a live site vs a demo site by screenshotting each page at desktop
 * and mobile widths, then computing a pixel-match percentage via pixelmatch.
 *
 * Usage:
 *   npm run diff               # full run: screenshots + report
 *   npm run diff:report        # print latest report without re-running
 */

import puppeteer, { type Browser, type Page } from 'puppeteer';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { mkdir, readdir, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ── Config ───────────────────────────────────────────────────────────────────

const LIVE_URL = 'https://cococabanalife.com';
const DEMO_URL = 'https://coco-demo-silk.vercel.app';

const PAGES = [
  { path: '/', name: 'Homepage' },
  { path: '/pages/about-us', name: 'About Us' },
  { path: '/pages/contact', name: 'Contact' },
  { path: '/collections', name: 'Collections' },
  { path: '/products/cococabana-foam-pool-float-74-inch', name: 'Product — Pool Float' },
];

const VIEWPORTS = [
  { tag: 'desktop', width: 1280, height: 900 },
  { tag: 'mobile', width: 375, height: 812 },
] as const;

const OUTPUT_ROOT = resolve(import.meta.dirname ?? __dirname, '..', 'diff-output');

// ── Types ────────────────────────────────────────────────────────────────────

interface ViewportResult {
  matchPercent: number;
  screenshotLive: string;
  screenshotDemo: string;
  screenshotDiff: string;
}

interface PageResult {
  path: string;
  name: string;
  desktop: ViewportResult;
  mobile: ViewportResult;
}

interface DiffReport {
  timestamp: string;
  liveUrl: string;
  demoUrl: string;
  pages: PageResult[];
  overallMatch: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusFromScore(score: number): 'PASS' | 'WARN' | 'FAIL' {
  if (score >= 85) return 'PASS';
  if (score >= 70) return 'WARN';
  return 'FAIL';
}

function statusColor(s: string) {
  if (s === 'PASS') return '\x1b[32m';
  if (s === 'WARN') return '\x1b[33m';
  return '\x1b[31m';
}
const RESET = '\x1b[0m';

/** Take a full-page screenshot, scroll to trigger lazy images, return PNG buffer. */
async function screenshot(page: Page, url: string, width: number, height: number): Promise<Buffer> {
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

  // Scroll down to trigger lazy-loaded images
  await page.evaluate(async () => {
    const distance = 400;
    const delay = 150;
    const scrollHeight = document.body.scrollHeight;
    let current = 0;
    while (current < scrollHeight) {
      window.scrollBy(0, distance);
      current += distance;
      await new Promise(r => setTimeout(r, delay));
    }
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 500));
  });

  const raw = await page.screenshot({ fullPage: true, type: 'png' });
  return Buffer.from(raw);
}

/** Compare two PNG buffers, returning match percent and a diff image buffer. */
function compareImages(
  bufA: Buffer,
  bufB: Buffer,
): { matchPercent: number; diffPng: Buffer } {
  const imgA = PNG.sync.read(bufA);
  const imgB = PNG.sync.read(bufB);

  // Normalize to the same dimensions (use the larger of each)
  const width = Math.max(imgA.width, imgB.width);
  const height = Math.max(imgA.height, imgB.height);

  const padded = (img: PNG): Buffer => {
    if (img.width === width && img.height === height) return img.data as unknown as Buffer;
    const out = Buffer.alloc(width * height * 4, 0);
    for (let y = 0; y < img.height; y++) {
      const srcOff = y * img.width * 4;
      const dstOff = y * width * 4;
      (img.data as unknown as Buffer).copy(out, dstOff, srcOff, srcOff + img.width * 4);
    }
    return out;
  };

  const dataA = padded(imgA);
  const dataB = padded(imgB);
  const diff = new PNG({ width, height });

  const numDiffPixels = pixelmatch(
    new Uint8Array(dataA.buffer, dataA.byteOffset, dataA.byteLength),
    new Uint8Array(dataB.buffer, dataB.byteOffset, dataB.byteLength),
    new Uint8Array(diff.data.buffer, diff.data.byteOffset, diff.data.byteLength),
    width,
    height,
    { threshold: 0.15 },
  );

  const totalPixels = width * height;
  const matchPercent = +((1 - numDiffPixels / totalPixels) * 100).toFixed(1);
  const diffPng = PNG.sync.write(diff);

  return { matchPercent, diffPng };
}

async function updateLatestSymlink(runDir: string) {
  const latestPath = join(OUTPUT_ROOT, 'latest');
  try { await unlink(latestPath); } catch { /* doesn't exist yet */ }
  await symlink(runDir, latestPath);
}

// ── Report-only mode ─────────────────────────────────────────────────────────

async function printReport(reportPath?: string) {
  let target = reportPath;
  if (!target) {
    const latestReport = join(OUTPUT_ROOT, 'latest', 'report.json');
    if (existsSync(latestReport)) {
      target = latestReport;
    } else {
      // Find most recent timestamped dir
      const dirs = (await readdir(OUTPUT_ROOT)).filter(d => d.match(/^\d{4}-/)).sort();
      if (dirs.length === 0) {
        console.error('No diff reports found. Run `npm run diff` first.');
        process.exit(1);
      }
      target = join(OUTPUT_ROOT, dirs[dirs.length - 1], 'report.json');
    }
  }

  const report: DiffReport = JSON.parse(await readFile(target, 'utf8'));
  const c = statusColor(report.status);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              VAEO Visual Diff Report                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`  Live:  ${report.liveUrl}`);
  console.log(`  Demo:  ${report.demoUrl}`);
  console.log(`  Time:  ${report.timestamp}\n`);
  console.log('  ┌──────────────────────────────────────┬──────────┬──────────┐');
  console.log('  │ Page                                 │ Desktop  │ Mobile   │');
  console.log('  ├──────────────────────────────────────┼──────────┼──────────┤');

  for (const p of report.pages) {
    const name = p.name.padEnd(36);
    const dc = statusColor(statusFromScore(p.desktop.matchPercent));
    const mc = statusColor(statusFromScore(p.mobile.matchPercent));
    console.log(
      `  │ ${name} │ ${dc}${p.desktop.matchPercent.toFixed(1).padStart(5)}%${RESET}   │ ${mc}${p.mobile.matchPercent.toFixed(1).padStart(5)}%${RESET}   │`,
    );
  }

  console.log('  ├──────────────────────────────────────┼──────────┼──────────┤');
  console.log(
    `  │ ${'OVERALL'.padEnd(36)} │ ${c}${report.overallMatch.toFixed(1).padStart(5)}%${RESET}   │ ${c}${report.status.padStart(6)}${RESET}   │`,
  );
  console.log('  └──────────────────────────────────────┴──────────┴──────────┘\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (process.argv.includes('--report-only')) {
    await printReport();
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = join(OUTPUT_ROOT, timestamp);
  await mkdir(runDir, { recursive: true });

  console.log(`\n🔍 VAEO Visual Diff Engine`);
  console.log(`   Live: ${LIVE_URL}`);
  console.log(`   Demo: ${DEMO_URL}`);
  console.log(`   Output: ${runDir}\n`);

  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results: PageResult[] = [];

  try {
    for (const pageConfig of PAGES) {
      console.log(`  📄 ${pageConfig.name} (${pageConfig.path})`);

      const liveUrl = LIVE_URL + pageConfig.path;
      const demoUrl = DEMO_URL + pageConfig.path;
      const slug = pageConfig.path === '/' ? 'homepage' : pageConfig.path.replace(/^\//, '').replace(/\//g, '_');

      const viewportResults: Record<string, ViewportResult> = {};

      for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        // Set a realistic user-agent
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        );

        const liveFile = `${slug}-${vp.tag}-live.png`;
        const demoFile = `${slug}-${vp.tag}-demo.png`;
        const diffFile = `${slug}-${vp.tag}-diff.png`;

        process.stdout.write(`     ${vp.tag} (${vp.width}px) … `);

        let liveBuf: Buffer;
        try {
          liveBuf = await screenshot(page, liveUrl, vp.width, vp.height);
        } catch (err) {
          console.log(`SKIP (live failed: ${(err as Error).message})`);
          await page.close();
          viewportResults[vp.tag] = {
            matchPercent: 0,
            screenshotLive: '',
            screenshotDemo: '',
            screenshotDiff: '',
          };
          continue;
        }

        let demoBuf: Buffer;
        try {
          demoBuf = await screenshot(page, demoUrl, vp.width, vp.height);
        } catch (err) {
          console.log(`SKIP (demo failed: ${(err as Error).message})`);
          await page.close();
          viewportResults[vp.tag] = {
            matchPercent: 0,
            screenshotLive: liveFile,
            screenshotDemo: '',
            screenshotDiff: '',
          };
          await writeFile(join(runDir, liveFile), liveBuf);
          continue;
        }

        await page.close();

        // Save screenshots
        await writeFile(join(runDir, liveFile), liveBuf);
        await writeFile(join(runDir, demoFile), demoBuf);

        // Compare
        const { matchPercent, diffPng } = compareImages(liveBuf, demoBuf);
        await writeFile(join(runDir, diffFile), diffPng);

        const s = statusFromScore(matchPercent);
        const c = statusColor(s);
        console.log(`${c}${matchPercent.toFixed(1)}%${RESET}`);

        viewportResults[vp.tag] = {
          matchPercent,
          screenshotLive: liveFile,
          screenshotDemo: demoFile,
          screenshotDiff: diffFile,
        };
      }

      results.push({
        path: pageConfig.path,
        name: pageConfig.name,
        desktop: viewportResults['desktop']!,
        mobile: viewportResults['mobile']!,
      });
    }
  } finally {
    await browser.close();
  }

  // Compute overall
  const allScores = results.flatMap(r => [r.desktop.matchPercent, r.mobile.matchPercent]).filter(s => s > 0);
  const overallMatch = allScores.length > 0 ? +(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : 0;

  const report: DiffReport = {
    timestamp: new Date().toISOString(),
    liveUrl: LIVE_URL,
    demoUrl: DEMO_URL,
    pages: results,
    overallMatch,
    status: statusFromScore(overallMatch),
  };

  await writeFile(join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  await updateLatestSymlink(runDir);

  console.log(`\n  ✅ Report saved: ${join(runDir, 'report.json')}`);
  await printReport(join(runDir, 'report.json'));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
