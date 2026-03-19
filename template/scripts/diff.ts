/**
 * VAEO Visual Diff Engine v2 — Section-Based Comparison
 *
 * Compares a live site vs a demo site by screenshotting each page at desktop
 * and mobile widths, cropping into sections (header, hero, content, footer),
 * and computing per-section pixel-match percentages via pixelmatch.
 *
 * Usage:
 *   npm run diff               # full run: screenshots + report
 *   npm run diff:report        # print latest report without re-running
 *
 * Programmatic:
 *   import { runDiff } from './diff.ts';
 *   const report = await runDiff();
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

const SECTIONS = [
  { name: 'header',  startPx: 0,    heightPx: 200 },
  { name: 'hero',    startPx: 200,  heightPx: 600 },
  { name: 'content', startPx: 800,  heightPx: 500 },
  { name: 'footer',  startPx: -300, heightPx: 300 },  // negative = from bottom
] as const;

type SectionName = typeof SECTIONS[number]['name'];

const OUTPUT_ROOT = resolve(import.meta.dirname ?? __dirname, '..', 'diff-output');

// ── Types ────────────────────────────────────────────────────────────────────

interface SectionResult {
  matchPercent: number;
}

interface ViewportResult {
  matchPercent: number;
  sections: Record<SectionName, SectionResult>;
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

export interface DiffReport {
  timestamp: string;
  liveUrl: string;
  demoUrl: string;
  pages: PageResult[];
  sections: Record<SectionName, { matchPercent: number }>;
  overallMatch: number;
  status: 'PASS' | 'WARN' | 'FAIL';
}

interface HistoryEntry {
  timestamp: string;
  overallMatch: number;
  status: string;
  reportPath: string;
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
const DIM   = '\x1b[2m';

/** Disable all CSS animations/transitions and scroll to top. */
async function prepPage(page: Page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `;
    document.head.appendChild(style);
  });
}

/** Scroll the full page to trigger lazy images, then wait for them to decode. */
async function loadAllImages(page: Page) {
  await page.evaluate(async () => {
    // Scroll down in steps to trigger lazy loading
    const step = 400;
    const delay = 120;
    const maxScroll = document.body.scrollHeight;
    let y = 0;
    while (y < maxScroll) {
      window.scrollTo(0, y);
      y += step;
      await new Promise(r => setTimeout(r, delay));
    }
    // Scroll to bottom to catch absolute-positioned footers
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 300));

    // Wait for all <img> elements to finish loading
    const imgs = Array.from(document.querySelectorAll('img'));
    await Promise.allSettled(
      imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          setTimeout(resolve, 3000); // 3s timeout per image
        });
      })
    );

    // Scroll back to top for the screenshot
    window.scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 300));
  });
}

/** Take a full-page screenshot with animations disabled and images loaded. */
async function screenshot(page: Page, url: string, width: number, height: number): Promise<Buffer> {
  await page.setViewport({ width, height });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 45_000 });
  await prepPage(page);
  await loadAllImages(page);

  const raw = await page.screenshot({ fullPage: true, type: 'png' });
  return Buffer.from(raw);
}

/** Crop a PNG buffer to a specific vertical region. */
function cropSection(buf: Buffer, startY: number, sectionHeight: number): Buffer {
  const src = PNG.sync.read(buf);
  const imgHeight = src.height;

  // Resolve negative startY (from bottom)
  const actualStart = startY < 0 ? Math.max(0, imgHeight + startY) : Math.min(startY, imgHeight);
  const actualHeight = Math.min(sectionHeight, imgHeight - actualStart);

  if (actualHeight <= 0) {
    // Section beyond image bounds — return 1x1 transparent pixel
    const tiny = new PNG({ width: 1, height: 1 });
    return PNG.sync.write(tiny);
  }

  const cropped = new PNG({ width: src.width, height: actualHeight });
  for (let y = 0; y < actualHeight; y++) {
    const srcOff = (actualStart + y) * src.width * 4;
    const dstOff = y * src.width * 4;
    src.data.copy(cropped.data, dstOff, srcOff, srcOff + src.width * 4);
  }

  return PNG.sync.write(cropped);
}

/** Compare two PNG buffers, returning match percent and a diff image buffer. */
function compareImages(
  bufA: Buffer,
  bufB: Buffer,
  threshold = 0.15,
): { matchPercent: number; diffPng: Buffer } {
  const imgA = PNG.sync.read(bufA);
  const imgB = PNG.sync.read(bufB);

  const width = Math.max(imgA.width, imgB.width);
  const height = Math.max(imgA.height, imgB.height);

  if (width === 0 || height === 0) {
    return { matchPercent: 0, diffPng: PNG.sync.write(new PNG({ width: 1, height: 1 })) };
  }

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
    { threshold },
  );

  const totalPixels = width * height;
  const matchPercent = +((1 - numDiffPixels / totalPixels) * 100).toFixed(1);

  return { matchPercent, diffPng: PNG.sync.write(diff) };
}

/** Compare two full-page buffers section-by-section. */
function compareSections(
  liveBuf: Buffer,
  demoBuf: Buffer,
): Record<SectionName, SectionResult> {
  const results = {} as Record<SectionName, SectionResult>;

  for (const sec of SECTIONS) {
    const liveCrop = cropSection(liveBuf, sec.startPx, sec.heightPx);
    const demoCrop = cropSection(demoBuf, sec.startPx, sec.heightPx);
    const { matchPercent } = compareImages(liveCrop, demoCrop, 0.2);
    results[sec.name] = { matchPercent };
  }

  return results;
}

async function updateLatestSymlink(runDir: string) {
  const latestPath = join(OUTPUT_ROOT, 'latest');
  try { await unlink(latestPath); } catch { /* doesn't exist yet */ }
  await symlink(runDir, latestPath);
}

async function appendHistory(entry: HistoryEntry) {
  const historyPath = join(OUTPUT_ROOT, 'history.json');
  let history: HistoryEntry[] = [];
  try {
    history = JSON.parse(await readFile(historyPath, 'utf8'));
  } catch { /* first run */ }
  history.push(entry);
  await writeFile(historyPath, JSON.stringify(history, null, 2));
}

// ── Report printer ───────────────────────────────────────────────────────────

function printReport(report: DiffReport) {
  const c = statusColor(report.status);

  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                    VAEO Visual Diff Report v2                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  console.log(`  Live:  ${report.liveUrl}`);
  console.log(`  Demo:  ${report.demoUrl}`);
  console.log(`  Time:  ${report.timestamp}\n`);

  // Section-level summary
  console.log('  ┌─────────────────────┬──────────┐');
  console.log('  │ Section             │ Average  │');
  console.log('  ├─────────────────────┼──────────┤');
  for (const [name, data] of Object.entries(report.sections)) {
    const sc = statusColor(statusFromScore(data.matchPercent));
    console.log(`  │ ${name.padEnd(19)} │ ${sc}${data.matchPercent.toFixed(1).padStart(5)}%${RESET}   │`);
  }
  console.log('  └─────────────────────┴──────────┘\n');

  // Per-page table
  console.log('  ┌──────────────────────────────────────┬──────────┬──────────┬────────────────────────────────────────┐');
  console.log('  │ Page                                 │ Desktop  │ Mobile   │ Sections (H / Hr / C / F)              │');
  console.log('  ├──────────────────────────────────────┼──────────┼──────────┼────────────────────────────────────────┤');

  for (const p of report.pages) {
    const name = p.name.padEnd(36);
    const dc = statusColor(statusFromScore(p.desktop.matchPercent));
    const mc = statusColor(statusFromScore(p.mobile.matchPercent));

    // Desktop section scores
    const ds = p.desktop.sections;
    const secStr = [ds.header, ds.hero, ds.content, ds.footer]
      .map(s => {
        const sc = statusColor(statusFromScore(s.matchPercent));
        return `${sc}${s.matchPercent.toFixed(0).padStart(3)}%${RESET}`;
      })
      .join(`${DIM} / ${RESET}`);

    console.log(
      `  │ ${name} │ ${dc}${p.desktop.matchPercent.toFixed(1).padStart(5)}%${RESET}   │ ${mc}${p.mobile.matchPercent.toFixed(1).padStart(5)}%${RESET}   │ ${secStr}  │`,
    );
  }

  console.log('  ├──────────────────────────────────────┼──────────┼──────────┼────────────────────────────────────────┤');
  console.log(
    `  │ ${'OVERALL'.padEnd(36)} │ ${c}${report.overallMatch.toFixed(1).padStart(5)}%${RESET}   │ ${c}${report.status.padStart(6)}${RESET}   │                                        │`,
  );
  console.log('  └──────────────────────────────────────┴──────────┴──────────┴────────────────────────────────────────┘\n');
}

async function printLatestReport() {
  const latestReport = join(OUTPUT_ROOT, 'latest', 'report.json');
  let target = latestReport;
  if (!existsSync(target)) {
    const dirs = (await readdir(OUTPUT_ROOT)).filter(d => d.match(/^\d{4}-/)).sort();
    if (dirs.length === 0) {
      console.error('No diff reports found. Run `npm run diff` first.');
      process.exit(1);
    }
    target = join(OUTPUT_ROOT, dirs[dirs.length - 1], 'report.json');
  }
  const report: DiffReport = JSON.parse(await readFile(target, 'utf8'));
  printReport(report);
}

// ── Core engine (exported for programmatic use) ──────────────────────────────

export async function runDiff(options?: {
  silent?: boolean;
}): Promise<DiffReport> {
  const silent = options?.silent ?? false;
  const log = (...args: unknown[]) => { if (!silent) console.log(...args); };
  const write = (s: string) => { if (!silent) process.stdout.write(s); };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = join(OUTPUT_ROOT, timestamp);
  await mkdir(runDir, { recursive: true });

  log(`\n🔍 VAEO Visual Diff Engine v2 — Section-Based`);
  log(`   Live: ${LIVE_URL}`);
  log(`   Demo: ${DEMO_URL}`);
  log(`   Output: ${runDir}\n`);

  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const results: PageResult[] = [];

  try {
    for (const pageConfig of PAGES) {
      log(`  📄 ${pageConfig.name} (${pageConfig.path})`);

      const liveUrl = LIVE_URL + pageConfig.path;
      const demoUrl = DEMO_URL + pageConfig.path;
      const slug = pageConfig.path === '/' ? 'homepage' : pageConfig.path.replace(/^\//, '').replace(/\//g, '_');

      const viewportResults: Record<string, ViewportResult> = {};

      for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        );

        const liveFile = `${slug}-${vp.tag}-live.png`;
        const demoFile = `${slug}-${vp.tag}-demo.png`;
        const diffFile = `${slug}-${vp.tag}-diff.png`;

        write(`     ${vp.tag} (${vp.width}px) … `);

        let liveBuf: Buffer;
        try {
          liveBuf = await screenshot(page, liveUrl, vp.width, vp.height);
        } catch (err) {
          log(`SKIP (live failed: ${(err as Error).message})`);
          await page.close();
          const emptySections = Object.fromEntries(
            SECTIONS.map(s => [s.name, { matchPercent: 0 }]),
          ) as Record<SectionName, SectionResult>;
          viewportResults[vp.tag] = {
            matchPercent: 0, sections: emptySections,
            screenshotLive: '', screenshotDemo: '', screenshotDiff: '',
          };
          continue;
        }

        let demoBuf: Buffer;
        try {
          demoBuf = await screenshot(page, demoUrl, vp.width, vp.height);
        } catch (err) {
          log(`SKIP (demo failed: ${(err as Error).message})`);
          await page.close();
          await writeFile(join(runDir, liveFile), liveBuf);
          const emptySections = Object.fromEntries(
            SECTIONS.map(s => [s.name, { matchPercent: 0 }]),
          ) as Record<SectionName, SectionResult>;
          viewportResults[vp.tag] = {
            matchPercent: 0, sections: emptySections,
            screenshotLive: liveFile, screenshotDemo: '', screenshotDiff: '',
          };
          continue;
        }

        await page.close();

        // Save full-page screenshots
        await writeFile(join(runDir, liveFile), liveBuf);
        await writeFile(join(runDir, demoFile), demoBuf);

        // Full-page comparison (for overall score and diff image)
        const { matchPercent, diffPng } = compareImages(liveBuf, demoBuf);
        await writeFile(join(runDir, diffFile), diffPng);

        // Section-based comparison
        const sections = compareSections(liveBuf, demoBuf);

        const secScores = Object.values(sections).map(s => s.matchPercent);
        const sectionAvg = +(secScores.reduce((a, b) => a + b, 0) / secScores.length).toFixed(1);

        const s = statusFromScore(sectionAvg);
        const sc = statusColor(s);
        const secDetail = [sections.header, sections.hero, sections.content, sections.footer]
          .map(x => `${x.matchPercent.toFixed(0)}%`)
          .join('/');
        log(`${sc}${sectionAvg.toFixed(1)}%${RESET}  ${DIM}(full: ${matchPercent.toFixed(1)}% | H/Hr/C/F: ${secDetail})${RESET}`);

        viewportResults[vp.tag] = {
          matchPercent: sectionAvg,
          sections,
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

  // Compute overall match from section averages
  const allScores = results.flatMap(r => [r.desktop.matchPercent, r.mobile.matchPercent]).filter(s => s > 0);
  const overallMatch = allScores.length > 0
    ? +(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
    : 0;

  // Compute per-section aggregates across all pages/viewports
  const sectionAgg = {} as Record<SectionName, { matchPercent: number }>;
  for (const sec of SECTIONS) {
    const scores: number[] = [];
    for (const r of results) {
      if (r.desktop.sections?.[sec.name]) scores.push(r.desktop.sections[sec.name].matchPercent);
      if (r.mobile.sections?.[sec.name]) scores.push(r.mobile.sections[sec.name].matchPercent);
    }
    sectionAgg[sec.name] = {
      matchPercent: scores.length > 0
        ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : 0,
    };
  }

  const report: DiffReport = {
    timestamp: new Date().toISOString(),
    liveUrl: LIVE_URL,
    demoUrl: DEMO_URL,
    pages: results,
    sections: sectionAgg,
    overallMatch,
    status: statusFromScore(overallMatch),
  };

  await writeFile(join(runDir, 'report.json'), JSON.stringify(report, null, 2));
  await updateLatestSymlink(runDir);

  // Append to history
  const relPath = `diff-output/${timestamp}/report.json`;
  await appendHistory({
    timestamp: report.timestamp,
    overallMatch: report.overallMatch,
    status: report.status,
    reportPath: relPath,
  });

  log(`\n  ✅ Report saved: ${join(runDir, 'report.json')}`);
  printReport(report);

  return report;
}

// ── CLI entry point ──────────────────────────────────────────────────────────

const isCli = process.argv[1]?.endsWith('diff.ts');
if (isCli) {
  if (process.argv.includes('--report-only')) {
    printLatestReport().catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
  } else {
    runDiff().catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
  }
}
