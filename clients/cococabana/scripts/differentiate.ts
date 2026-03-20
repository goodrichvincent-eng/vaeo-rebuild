/**
 * scripts/differentiate.ts
 *
 * VAEO Differentiator Engine
 *
 * Analyzes a Shopify theme ZIP + live site screenshots and outputs a
 * complete build specification used to scaffold a Next.js rebuild.
 *
 * Phases:
 *   1 — ZIP extraction  (settings_data.json, sections/*.liquid, assets/*.css)
 *   2 — Live site analysis (Puppeteer screenshots + DOM measurements)
 *   3 — Content inventory (from data/content.json)
 *   4 — Build spec generation (merged output)
 *
 * Usage:
 *   INPUT_URL=https://client.com CLIENT_NAME=myclient npm run differentiate
 *   INPUT_ZIP=/path/to/backup.zip INPUT_URL=... npm run differentiate
 */

import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import puppeteer from 'puppeteer';
import { detectApps, type AppDetectionResult } from './browser.ts';

// ── Config ────────────────────────────────────────────────────────────────────

const INPUT_ZIP    = process.env.INPUT_ZIP    ?? '';
const INPUT_URL    = process.env.INPUT_URL    ?? '';
const CLIENT_NAME  = process.env.CLIENT_NAME  ?? 'client';
const OUTPUT_DIR   = process.env.OUTPUT_DIR   ?? join(process.cwd(), 'output');
const CONTENT_JSON = join(process.cwd(), 'data', 'content.json');

// ── VAEO Platform integration ────────────────────────────────────────────────

const VAEO_API_URL = process.env.VAEO_API_URL ?? 'https://app.velocityaeo.com';
const VAEO_API_KEY = process.env.VAEO_API_KEY ?? '';
const VAEO_JOB_ID  = process.env.VAEO_JOB_ID  ?? '';

const vaeoEnabled = !!(VAEO_API_KEY && VAEO_JOB_ID);

async function reportLog(entry: LogEntry) {
  if (!vaeoEnabled) return;
  await fetch(`${VAEO_API_URL}/api/rebuild/log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-vaeo-api-key': VAEO_API_KEY },
    body: JSON.stringify({ jobId: VAEO_JOB_ID, entry }),
  }).catch(() => {}); // non-fatal
}

async function reportScreenshot(screenshotBuffer: Buffer, pageType: string) {
  if (!vaeoEnabled) return;
  const base64 = screenshotBuffer.toString('base64');
  await fetch(`${VAEO_API_URL}/api/rebuild/upload-screenshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-vaeo-api-key': VAEO_API_KEY },
    body: JSON.stringify({
      jobId: VAEO_JOB_ID,
      screenshotBase64: base64,
      filename: `${pageType}.png`,
      pageType,
    }),
  }).catch(() => {}); // non-fatal
}

// ── Build log ─────────────────────────────────────────────────────────────────

interface LogEntry { phase: number; step: string; message: string; timestamp: string; }
const buildLog: LogEntry[] = [];

function log(phase: number, step: string, message: string) {
  const entry: LogEntry = { phase, step, message, timestamp: new Date().toISOString() };
  buildLog.push(entry);
  console.log(`[PHASE ${phase}] ${message}`);
  void reportLog(entry);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function rgbToHex(rgb: string): string {
  const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '';
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
}

function cleanFontFamily(raw: string): string {
  return raw.split(',')
    .map(f => f.trim().replace(/['"]/g, ''))
    .filter(f => !f.startsWith('__') && f !== 'serif' && f !== 'sans-serif' && f !== 'inherit')
    .find(Boolean) ?? '';
}

async function findFilesRecursive(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const full = join(dir, item.name);
      if (item.isDirectory()) results.push(...await findFilesRecursive(full));
      else results.push(full);
    }
  } catch { /* ignore inaccessible dirs */ }
  return results;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThemeSpec {
  colors:     Record<string, string>;
  fonts:      Record<string, string>;
  sections:   string[];
  navigation: any[];
  settings:   Record<string, any>;
}

interface LayoutSpec {
  header:      { height: number; sticky: boolean; topBarExists: boolean };
  hero:        { height: number; hasText: boolean; hasButton: boolean };
  productGrid: { columnsDesktop: number; columnsMobile: number };
  footer:      { columns: number };
}

interface ContentSpec {
  productCount:    number;
  collectionCount: number;
  pageCount:       number;
  hasReviews:      boolean;
  imageCount:      number;
  navigationMain:  number;
  navigationFooter: number;
  shop:            any;
}

// ── Phase 1: ZIP extraction ───────────────────────────────────────────────────

async function extractFromZip(): Promise<ThemeSpec> {
  const empty: ThemeSpec = { colors: {}, fonts: {}, sections: [], navigation: [], settings: {} };

  if (!INPUT_ZIP) {
    log(1, 'zip_skip', 'No ZIP provided — skipping theme extraction');
    return empty;
  }
  if (!existsSync(INPUT_ZIP)) {
    log(1, 'zip_error', `ZIP not found: ${INPUT_ZIP}`);
    return empty;
  }

  const tempDir = join(tmpdir(), `vaeo-theme-${Date.now()}`);
  try {
    execSync(`unzip -o "${INPUT_ZIP}" -d "${tempDir}"`, { stdio: 'pipe' });
  } catch {
    log(1, 'zip_error', 'unzip failed — is unzip installed? (brew install unzip)');
    return empty;
  }

  const files = await findFilesRecursive(tempDir);
  log(1, 'zip_extracted', `Found ${files.length} files in theme backup ✓`);

  const colors: Record<string, string> = {};
  const fonts:  Record<string, string> = {};
  let   sections: string[] = [];

  // ── settings_data.json ─────────────────────────────────────────────────────
  const settingsFile = files.find(f => f.endsWith('settings_data.json'));
  if (settingsFile) {
    try {
      const raw = JSON.parse(await readFile(settingsFile, 'utf-8'));
      const cur = raw.current ?? raw;

      // Colors — keys like colors_body_bg, colors_text, color_primary, etc.
      for (const [k, v] of Object.entries(cur)) {
        if ((k.startsWith('color') || k.startsWith('color_')) && typeof v === 'string' && /^#[0-9a-fA-F]/.test(v)) {
          const name = k.replace(/^colors?_/, '').replace(/__/g, '_').replace(/^_|_$/g, '');
          colors[name] = v as string;
        }
      }

      // Fonts — objects with { family, style, weight }
      for (const [k, v] of Object.entries(cur)) {
        if (k.includes('font') && v && typeof v === 'object') {
          const font = v as any;
          if (font.family) {
            const slot = (k.includes('header') || k.includes('heading')) ? 'heading' : 'body';
            fonts[slot]              ??= font.family;
            fonts[`${slot}Weight`]   ??= String(font.weight ?? '400');
          }
        }
      }

      // Sections — from order array or sections object keys
      if (Array.isArray(raw.order)) {
        sections = (raw.order as string[]).filter(Boolean);
      } else if (raw.sections && typeof raw.sections === 'object') {
        sections = Object.keys(raw.sections).filter(k => k !== 'order');
      }

      if (Object.keys(colors).length)
        log(1, 'colors_extracted', `Colors found: ${Object.entries(colors).slice(0, 4).map(([k,v]) => `${k}=${v}`).join(', ')} ✓`);
      if (Object.keys(fonts).length)
        log(1, 'fonts_extracted', `Fonts found: heading=${fonts.heading ?? '?'}, body=${fonts.body ?? '?'} ✓`);
    } catch (err) {
      log(1, 'settings_error', `Could not parse settings_data.json: ${err}`);
    }
  }

  // ── sections/*.liquid ──────────────────────────────────────────────────────
  const liquidSections = files
    .filter(f => f.includes('/sections/') && f.endsWith('.liquid'))
    .map(f => f.split('/sections/').pop()!.replace('.liquid', ''));
  if (liquidSections.length) {
    sections = [...new Set([...sections, ...liquidSections])];
    log(1, 'sections_found', `Sections: ${liquidSections.slice(0, 8).join(', ')}${liquidSections.length > 8 ? ` +${liquidSections.length - 8} more` : ''} ✓`);
  }

  // ── assets/*.css — extract most-frequent non-standard color ───────────────
  const cssFiles = files.filter(f => extname(f) === '.css').slice(0, 5);
  for (const cssFile of cssFiles) {
    try {
      const css = await readFile(cssFile, 'utf-8');
      const freq: Record<string, number> = {};
      for (const c of css.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
        const lc = c.toLowerCase();
        freq[lc] = (freq[lc] ?? 0) + 1;
      }
      const candidate = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .find(([c]) => !['#ffffff', '#000000', '#1a1a1a', '#f5f5f5'].includes(c));
      if (candidate && !colors['css_accent']) {
        colors['css_accent'] = candidate[0];
        log(1, 'css_color', `CSS accent found: ${candidate[0]} (${candidate[1]}× in ${cssFile.split('/').pop()}) ✓`);
      }
    } catch { /* skip unreadable */ }
  }

  try { execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' }); } catch {}
  return { colors, fonts, sections, navigation: [], settings: {} };
}

// ── Phase 2: Live site analysis (Puppeteer) ───────────────────────────────────

interface LiveAnalysis {
  layout:      LayoutSpec;
  colors:      Record<string, string>;
  fonts:       Record<string, string>;
  screenshots: string[];
}

async function analyzeLiveSite(): Promise<LiveAnalysis> {
  const defaultLayout: LayoutSpec = {
    header:      { height: 0, sticky: false, topBarExists: false },
    hero:        { height: 0, hasText: false, hasButton: false },
    productGrid: { columnsDesktop: 4, columnsMobile: 2 },
    footer:      { columns: 3 },
  };

  if (!INPUT_URL) {
    log(2, 'url_skip', 'No INPUT_URL — skipping live site analysis');
    return { layout: defaultLayout, colors: {}, fonts: {}, screenshots: [] };
  }

  const screenshotDir = join(OUTPUT_DIR, 'screenshots');
  await mkdir(screenshotDir, { recursive: true });
  const screenshots: string[] = [];

  let browser;
  try {
    log(2, 'browser_launch', `Launching Puppeteer for ${INPUT_URL}…`);
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // ── Homepage ─────────────────────────────────────────────────────────────
    log(2, 'screenshot_home', `Screenshotting homepage at 1280px…`);
    await page.goto(INPUT_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    const homePath = join(screenshotDir, 'homepage.png');
    const homeRaw = await page.screenshot({ fullPage: false, type: 'png' });
    const homeBuf = Buffer.from(homeRaw);
    await writeFile(homePath, homeBuf);
    screenshots.push('screenshots/homepage.png');
    await reportScreenshot(homeBuf, 'homepage');
    log(2, 'screenshot_home_done', `Homepage screenshot saved ✓`);

    // ── DOM measurements — simple one-liner evaluates (avoids esbuild __name) ─

    // Header
    const headerHeight = await page.$eval('header, [role="banner"]',
      el => Math.round(el.getBoundingClientRect().height)).catch(() => 0);
    const headerPos    = await page.$eval('header, [role="banner"]',
      el => getComputedStyle(el).position).catch(() => '');
    const topBarExists = await page.$$eval(
      '[class*="announcement"],[class*="free-shipping"],[class*="topbar"],[class*="top-bar"]',
      els => els.length > 0).catch(() => false);
    const sticky = headerPos === 'sticky' || headerPos === 'fixed';

    // Hero — look for first large image-backed section
    const heroHeight = await page.$eval(
      '[class*="hero"],[class*="carousel"],[class*="banner"],[class*="Carousel"]',
      el => Math.round(el.getBoundingClientRect().height)).catch(async () => {
        // fallback: tallest div in first 400px of page
        return page.evaluate(() =>
          Math.max(0, ...Array.from(document.querySelectorAll('div,section'))
            .map(el => { const r = el.getBoundingClientRect(); return r.top < 400 ? r.height : 0; }))
        ).catch(() => 0);
      });
    const heroHasText = await page.$eval(
      '[class*="hero"],[class*="carousel"],[class*="banner"]',
      el => (el.textContent?.trim().length ?? 0) > 10).catch(() => false);
    const heroHasButton = await page.$eval(
      '[class*="hero"],[class*="carousel"],[class*="banner"]',
      el => !!el.querySelector('a, button')).catch(() => false);

    // Product grid — prefer class-hint, fallback to row counting
    const columnsDesktop = await page.$eval(
      '[class*="grid"]',
      (el) => {
        const m = el.className.match(/grid-cols-(\d)/);
        if (m) return parseInt(m[1]);
        const items = Array.from(el.querySelectorAll(':scope > *'));
        if (items.length < 2) return 4;
        const firstTop = items[0].getBoundingClientRect().top;
        return items.filter(i => Math.abs(i.getBoundingClientRect().top - firstTop) < 10).length || 4;
      }
    ).catch(() => 4);

    // Footer
    const footerColumns = await page.$eval(
      'footer,[role="contentinfo"]',
      (el) => {
        const m = el.className.match(/grid-cols-(\d)/);
        if (m) return parseInt(m[1]);
        const cols = el.querySelectorAll(':scope > div > div,:scope > div');
        return Math.min(cols.length || 3, 6);
      }
    ).catch(() => 3);

    // Colors — extract from rendered computed styles in Node context
    const rawAccentBg  = await page.$eval(
      '[class*="announcement"],[class*="free-shipping"],[class*="topbar"],[class*="top-bar"],[class*="promo"]',
      el => getComputedStyle(el).backgroundColor).catch(() => '');
    const rawHeaderBg  = await page.$eval('header,[role="banner"]',
      el => getComputedStyle(el).backgroundColor).catch(() => '');
    const rawBodyBg    = await page.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => '');
    const rawBodyText  = await page.evaluate(() => getComputedStyle(document.body).color).catch(() => '');

    const liveColors: Record<string, string> = {};
    const toHex = (raw: string) => {
      const m = raw?.match(/(\d+),\s*(\d+),\s*(\d+)/);
      return m ? '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('') : '';
    };
    const isOpaque = (raw: string) => raw && raw !== 'transparent' && !raw.includes('rgba(0, 0, 0, 0)');
    if (isOpaque(rawAccentBg))                  liveColors['primary']    = toHex(rawAccentBg);
    if (isOpaque(rawHeaderBg) && rawHeaderBg !== 'rgb(255, 255, 255)') liveColors['header'] = toHex(rawHeaderBg);
    if (isOpaque(rawBodyBg))                    liveColors['background'] = toHex(rawBodyBg);
    if (rawBodyText)                            liveColors['text']       = toHex(rawBodyText);

    // Fonts — computed style in Node context, strip Next.js internal names
    const rawHeadingFont = await page.$eval('h1,h2', el => getComputedStyle(el).fontFamily).catch(() => '');
    const rawBodyFont    = await page.evaluate(() => getComputedStyle(document.body).fontFamily).catch(() => '');

    const layout: LayoutSpec = {
      header:      { height: headerHeight, sticky, topBarExists },
      hero:        { height: heroHeight as number, hasText: heroHasText as boolean, hasButton: heroHasButton as boolean },
      productGrid: { columnsDesktop: columnsDesktop as number, columnsMobile: Math.min(2, columnsDesktop as number) },
      footer:      { columns: footerColumns as number },
    };

    const liveFonts = {
      heading: cleanFontFamily(rawHeadingFont),
      body:    cleanFontFamily(rawBodyFont),
    };

    log(2, 'header_analyzed', `Header height: ${layout.header.height}px, sticky: ${layout.header.sticky}, topBar: ${layout.header.topBarExists} ✓`);
    log(2, 'hero_analyzed',   `Hero height: ${layout.hero.height}px, hasText: ${layout.hero.hasText}, hasButton: ${layout.hero.hasButton} ✓`);
    log(2, 'grid_analyzed',   `Product grid: ${layout.productGrid.columnsDesktop} cols desktop, ${layout.productGrid.columnsMobile} cols mobile ✓`);
    log(2, 'footer_analyzed', `Footer: ${layout.footer.columns} columns ✓`);
    if (liveColors['primary']) log(2, 'colors_extracted', `Colors: primary=${liveColors['primary']}, header=${liveColors['header'] ?? '?'}, bg=${liveColors['background'] ?? '?'} ✓`);
    if (liveFonts.heading)     log(2, 'fonts_extracted',  `Fonts: heading="${liveFonts.heading}", body="${liveFonts.body}" ✓`);

    // ── Product page screenshot ──────────────────────────────────────────────
    const productUrl: string | null = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a[href]'))
        .find((el: any) => el.href?.includes('/products/')) as HTMLAnchorElement | undefined;
      return a?.href ?? null;
    });
    if (productUrl) {
      log(2, 'screenshot_product', `Screenshotting product page…`);
      await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      const prodRaw = await page.screenshot({ fullPage: false, type: 'png' });
      const prodBuf = Buffer.from(prodRaw);
      await writeFile(join(screenshotDir, 'product.png'), prodBuf);
      screenshots.push('screenshots/product.png');
      await reportScreenshot(prodBuf, 'product');
      log(2, 'screenshot_product_done', `Product screenshot saved ✓`);
    }

    // ── Collection page screenshot ───────────────────────────────────────────
    const collectionUrl: string | null = await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll('a[href]'))
        .find((el: any) => el.href?.includes('/collections/') && !el.href?.includes('/products/')) as HTMLAnchorElement | undefined;
      return a?.href ?? null;
    });
    if (collectionUrl) {
      log(2, 'screenshot_collection', `Screenshotting collection page…`);
      await page.goto(collectionUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      const collRaw = await page.screenshot({ fullPage: false, type: 'png' });
      const collBuf = Buffer.from(collRaw);
      await writeFile(join(screenshotDir, 'collection.png'), collBuf);
      screenshots.push('screenshots/collection.png');
      await reportScreenshot(collBuf, 'collection');
      log(2, 'screenshot_collection_done', `Collection screenshot saved ✓`);
    }

    await browser.close();

    return { layout, colors: liveColors, fonts: liveFonts, screenshots };
  } catch (err) {
    log(2, 'puppeteer_error', `Live site analysis error: ${err}`);
    if (browser) await browser.close().catch(() => {});
    return { layout: defaultLayout, colors: {}, fonts: {}, screenshots };
  }
}

// ── Phase 3: Content inventory ────────────────────────────────────────────────

async function buildContentSpec(): Promise<ContentSpec> {
  const empty: ContentSpec = {
    productCount: 0, collectionCount: 0, pageCount: 0,
    hasReviews: false, imageCount: 0, navigationMain: 0, navigationFooter: 0, shop: {},
  };

  if (!existsSync(CONTENT_JSON)) {
    log(3, 'content_skip', `content.json not found at ${CONTENT_JSON}`);
    return empty;
  }

  try {
    const raw = JSON.parse(await readFile(CONTENT_JSON, 'utf-8'));
    const productCount    = (raw.products    ?? []).length;
    const collectionCount = (raw.collections ?? []).length;
    const pageCount       = (raw.pages       ?? []).length;
    const imageCount      = Object.keys(raw.images ?? {}).length;
    const navMain         = (raw.navigation?.main   ?? []).length;
    const navFooter       = (raw.navigation?.footer ?? []).length;

    const reviewsFile = join(process.cwd(), 'data', 'reviews.json');
    let hasReviews = false;
    if (existsSync(reviewsFile)) {
      const rev = JSON.parse(await readFile(reviewsFile, 'utf-8'));
      hasReviews = Object.keys(rev).length > 0;
    }

    log(3, 'content_inventoried', `Content: ${productCount} products, ${collectionCount} collections, ${pageCount} pages ✓`);
    log(3, 'images_counted',      `Images: ${imageCount} in manifest ✓`);
    log(3, 'navigation_found',    `Navigation: main=${navMain} items, footer=${navFooter} items ✓`);
    log(3, 'reviews_checked',     `Reviews: ${hasReviews ? 'yes' : 'none found'} ✓`);

    return {
      productCount, collectionCount, pageCount, hasReviews,
      imageCount, navigationMain: navMain, navigationFooter: navFooter,
      shop: raw.shop ?? {},
    };
  } catch (err) {
    log(3, 'content_error', `Content inventory error: ${err}`);
    return empty;
  }
}

// ── Phase 4: Build spec generation ───────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log('\n🔍 VAEO Differentiator Engine');
  console.log(`   Client:  ${CLIENT_NAME}`);
  console.log(`   URL:     ${INPUT_URL || '(none)'}`);
  console.log(`   ZIP:     ${INPUT_ZIP || '(none)'}`);
  console.log(`   Output:  ${OUTPUT_DIR}`);
  console.log(`   VAEO:    ${vaeoEnabled ? `reporting to ${VAEO_API_URL} (job ${VAEO_JOB_ID})` : 'local only'}\n`);

  await mkdir(OUTPUT_DIR, { recursive: true });

  // ── Phase 1 ───────────────────────────────────────────────────────────────
  console.log('── PHASE 1: Theme ZIP extraction ──────────────────────────────────');
  const themeSpec = await extractFromZip();
  await writeFile(join(OUTPUT_DIR, 'theme-spec.json'), JSON.stringify(themeSpec, null, 2), 'utf-8');
  log(1, 'theme_spec_written', `theme-spec.json written ✓`);

  // ── Phase 2 ───────────────────────────────────────────────────────────────
  console.log('\n── PHASE 2: Live site analysis ────────────────────────────────────');
  const { layout, colors: liveColors, fonts: liveFonts, screenshots } = await analyzeLiveSite();
  await writeFile(join(OUTPUT_DIR, 'layout-spec.json'), JSON.stringify(layout, null, 2), 'utf-8');
  log(2, 'layout_spec_written', `layout-spec.json written ✓`);

  // ── Phase 2b: App detection ───────────────────────────────────────────────
  console.log('\n── PHASE 2b: App detection ────────────────────────────────────────');
  let appsResult: AppDetectionResult | null = null;
  if (INPUT_URL) {
    appsResult = await detectApps(INPUT_URL);
    if (appsResult?.appsDetected.length) {
      log(2, 'apps_detected',
        `Apps: ${appsResult.appsDetected.map(a => a.name).join(', ')} ✓`);
      log(2, 'speed_impact',
        `Estimated speed impact: ${appsResult.estimatedSpeedImpact} → PageSpeed ~${appsResult.estimatedPageSpeedScore} ✓`);
    } else {
      log(2, 'apps_none', 'No known third-party apps detected ✓');
    }
    if (appsResult?.replaceableWithVAEO.length) {
      log(2, 'vaeo_replaceable',
        `VAEO can replace: ${appsResult.replaceableWithVAEO.map(r => r.appName).join(', ')} ✓`);
    }
  }

  // ── Phase 3 ───────────────────────────────────────────────────────────────
  console.log('\n── PHASE 3: Content inventory ─────────────────────────────────────');
  const contentSpec = await buildContentSpec();
  await writeFile(join(OUTPUT_DIR, 'content-spec.json'), JSON.stringify(contentSpec, null, 2), 'utf-8');
  log(3, 'content_spec_written', `content-spec.json written ✓`);

  // ── Phase 4 ───────────────────────────────────────────────────────────────
  console.log('\n── PHASE 4: Build spec generation ────────────────────────────────');

  // Merge colors: ZIP first, live site fills gaps
  const mergedColors = {
    primary:    themeSpec.colors['primary']    || themeSpec.colors['body_text']    || liveColors['primary']    || '',
    secondary:  themeSpec.colors['secondary']  || themeSpec.colors['button_label'] || liveColors['secondary']  || '',
    background: themeSpec.colors['body_bg']    || themeSpec.colors['background']   || liveColors['background'] || '#ffffff',
    text:       themeSpec.colors['body_text']  || themeSpec.colors['text']         || liveColors['text']       || '#1a1a1a',
    accent:     themeSpec.colors['css_accent'] || liveColors['primary']            || liveColors['accent']     || '',
  };

  const mergedFonts = {
    heading:       themeSpec.fonts['heading']      || cleanFontFamily(liveFonts['heading'] ?? '') || '',
    body:          themeSpec.fonts['body']         || cleanFontFamily(liveFonts['body']    ?? '') || '',
    headingWeight: themeSpec.fonts['headingWeight'] || '400',
    bodyWeight:    themeSpec.fonts['bodyWeight']    || '400',
  };

  const buildSpec = {
    client:      CLIENT_NAME,
    generatedAt: new Date().toISOString(),
    durationMs:  Date.now() - startTime,
    site: {
      url:      INPUT_URL,
      platform: 'shopify',
    },
    design: {
      colors: mergedColors,
      fonts:  mergedFonts,
      layout,
    },
    content: {
      productCount:    contentSpec.productCount,
      collectionCount: contentSpec.collectionCount,
      pageCount:       contentSpec.pageCount,
      hasReviews:      contentSpec.hasReviews,
      imageCount:      contentSpec.imageCount,
      navigation: {
        mainItems:   contentSpec.navigationMain,
        footerItems: contentSpec.navigationFooter,
      },
      shop: contentSpec.shop,
    },
    sections:    themeSpec.sections,
    screenshots,
    appsDetected:      appsResult?.appsDetected      ?? [],
    replaceableWithVAEO: appsResult?.replaceableWithVAEO ?? [],
    estimatedSpeedGain: appsResult ? Math.abs(appsResult.estimatedSpeedImpact) : 0,
    buildLog,
  };

  await writeFile(join(OUTPUT_DIR, 'build-spec.json'), JSON.stringify(buildSpec, null, 2), 'utf-8');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(4, 'build_spec_generated', `Build spec generated: ${join(OUTPUT_DIR, 'build-spec.json')} ✓`);

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(`✅  Differentiator complete in ${elapsed}s`);
  console.log(`   Products:    ${contentSpec.productCount}`);
  console.log(`   Collections: ${contentSpec.collectionCount}`);
  console.log(`   Pages:       ${contentSpec.pageCount}`);
  console.log(`   Reviews:     ${contentSpec.hasReviews ? 'yes' : 'no'}`);
  console.log(`   Colors:      primary=${mergedColors.primary || '?'}  bg=${mergedColors.background}  text=${mergedColors.text}`);
  console.log(`   Fonts:       heading="${mergedFonts.heading || '?'}"  body="${mergedFonts.body || '?'}"`);
  console.log(`   Header:      ${layout.header.height}px  sticky=${layout.header.sticky}  topBar=${layout.header.topBarExists}`);
  console.log(`   Hero:        ${layout.hero.height}px`);
  console.log(`   Grid:        ${layout.productGrid.columnsDesktop} cols desktop / ${layout.productGrid.columnsMobile} cols mobile`);
  console.log(`   Sections:    ${buildSpec.sections.length}`);
  console.log(`   Screenshots: ${screenshots.length}`);
  console.log(`   Output:      ${OUTPUT_DIR}`);
  console.log('══════════════════════════════════════════════════════════════════\n');

  // Report completion to VAEO platform
  if (vaeoEnabled) {
    await reportLog({ phase: 0, step: 'complete', message: `Rebuild complete in ${elapsed}s`, timestamp: new Date().toISOString() });
    console.log(`   VAEO: reported completion to ${VAEO_API_URL}`);
  }
}

main().catch(async (err) => {
  console.error('\n❌ Differentiator failed:', err);
  if (vaeoEnabled) {
    const msg = err instanceof Error ? err.message : String(err);
    await reportLog({ phase: 0, step: 'failed', message: `Build failed: ${msg}`, timestamp: new Date().toISOString() });
  }
  process.exit(1);
});
