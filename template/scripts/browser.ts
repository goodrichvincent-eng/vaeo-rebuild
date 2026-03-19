/**
 * scripts/browser.ts
 *
 * VAEO Headless Browser Engine
 *
 * 5 exported functions:
 *   screenshot    — full-page PNG buffer
 *   getPageSource — JS-rendered HTML
 *   detectApps    — third-party app / script detection
 *   measureLayout — DOM layout measurements (header/hero/grid/footer/colors/fonts)
 *   crawlSite     — BFS internal link crawler
 *
 * Pure Node.js + Puppeteer. No external services. Scales to 20K URLs.
 *
 * IMPORTANT: all page.$eval / page.$$eval callbacks are simple one-liners or
 * anonymous expressions — no named const arrow-function assignments.
 * esbuild (via tsx) injects __name() for named function assignments, which
 * breaks page.evaluate serialization. This file avoids that pattern throughout.
 *
 * Usage (CLI):
 *   URL=https://example.com npx tsx scripts/browser.ts
 *   npx tsx scripts/browser.ts https://example.com
 */

import puppeteer, { type Browser } from 'puppeteer';

// ── Launch config ─────────────────────────────────────────────────────────────

const NAV_TIMEOUT = 30_000;

const LAUNCH_OPTS = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-default-apps',
    '--mute-audio',
  ],
};

// ── KNOWN_APPS registry ───────────────────────────────────────────────────────
// Keyed by URL substring. Match against script[src] + link[href] on the page.

const KNOWN_APPS: Record<string, { name: string; type: string; speedImpact: number }> = {
  'klaviyo.com':          { name: 'Klaviyo',           type: 'email_marketing', speedImpact: -8 },
  'judge.me':             { name: 'Judge.me',           type: 'reviews',         speedImpact: -5 },
  'stamped.io':           { name: 'Stamped',            type: 'reviews',         speedImpact: -6 },
  'yotpo.com':            { name: 'Yotpo',              type: 'reviews',         speedImpact: -7 },
  'gorgias.chat':         { name: 'Gorgias',            type: 'support_chat',    speedImpact: -4 },
  'tidio.com':            { name: 'Tidio',              type: 'support_chat',    speedImpact: -6 },
  'hotjar.com':           { name: 'Hotjar',             type: 'analytics',       speedImpact: -5 },
  'fullstory.com':        { name: 'FullStory',          type: 'analytics',       speedImpact: -6 },
  'privy.com':            { name: 'Privy',              type: 'popups',          speedImpact: -8 },
  'justuno.com':          { name: 'Justuno',            type: 'popups',          speedImpact: -9 },
  'loox.io':              { name: 'Loox',               type: 'reviews',         speedImpact: -5 },
  'okendo.io':            { name: 'Okendo',             type: 'reviews',         speedImpact: -5 },
  'recharge.com':         { name: 'ReCharge',           type: 'subscriptions',   speedImpact: -4 },
  'bold.com':             { name: 'Bold',               type: 'subscriptions',   speedImpact: -5 },
  'afterpay.com':         { name: 'Afterpay',           type: 'payments',        speedImpact: -3 },
  'klarna.com':           { name: 'Klarna',             type: 'payments',        speedImpact: -3 },
  'attentive.com':        { name: 'Attentive',          type: 'sms_marketing',   speedImpact: -6 },
  'postscript.io':        { name: 'Postscript',         type: 'sms_marketing',   speedImpact: -5 },
  'loyalty.lion':         { name: 'LoyaltyLion',        type: 'loyalty',         speedImpact: -7 },
  'smile.io':             { name: 'Smile.io',           type: 'loyalty',         speedImpact: -6 },
  'hextom.com':           { name: 'Hextom',             type: 'banner',          speedImpact: -4 },
  'googletagmanager.com': { name: 'Google Tag Manager', type: 'tag_manager',     speedImpact: -3 },
  'connect.facebook.net': { name: 'Meta Pixel',         type: 'advertising',     speedImpact: -4 },
  'tiktok.com':           { name: 'TikTok Pixel',       type: 'advertising',     speedImpact: -4 },
  'appio.io':             { name: 'Appio Reviews',      type: 'reviews',         speedImpact: -5 },
  'apps.shopify.com':     { name: 'Shopify App',        type: 'shopify_app',     speedImpact: -3 },
};

// ── VAEO replacement map — app types VAEO handles natively ───────────────────

const VAEO_REPLACEMENTS: Record<string, string> = {
  reviews: 'ReviewBadge',
  banner:  'FreeShippingBanner',
  popups:  'AnnouncementBar',
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppDetectionResult {
  url:                     string;
  appsDetected:            Array<{ name: string; type: string; scriptUrl: string; speedImpact: number }>;
  unknownScripts:          string[];
  totalThirdPartyScripts:  number;
  estimatedSpeedImpact:    number;
  estimatedPageSpeedScore: number;
  replaceableWithVAEO:     Array<{ appName: string; vaeoComponent: string }>;
}

export interface LayoutMeasurement {
  header:      { height: number; sticky: boolean; topBarExists: boolean };
  hero:        { height: number; hasText: boolean; hasButton: boolean };
  productGrid: { columnsDesktop: number; columnsMobile: number };
  footer:      { columns: number };
  colors:      Record<string, string>;
  fonts:       Record<string, string>;
}

export interface PageData {
  url:             string;
  title:           string;
  h1:              string;
  metaDescription: string;
  statusCode:      number;
}

export interface CrawlResult {
  startUrl: string;
  pages:    PageData[];
  summary: {
    total:          number;
    errors:         number;
    missingH1:      number;
    missingMeta:    number;
    avgTitleLength: number;
  };
}

// ── Shared browser lifecycle ───────────────────────────────────────────────────
// Each exported function manages its own browser instance.

async function withBrowser<T>(fn: (b: Browser) => Promise<T>): Promise<T | null> {
  let b: Browser | undefined;
  try {
    b = await puppeteer.launch(LAUNCH_OPTS);
    return await fn(b);
  } catch (err) {
    console.error('[BROWSER] Fatal error:', err);
    return null;
  } finally {
    await b?.close().catch(() => {});
  }
}

// ── Node.js-side helpers (never serialized to browser) ────────────────────────

function toHex(rgb: string): string {
  const m = rgb?.match(/(\d+),\s*(\d+),\s*(\d+)/);
  return m ? '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('') : '';
}

function cleanFont(raw: string): string {
  return raw.split(',')
    .map(f => f.trim().replace(/['"]/g, ''))
    .filter(f => !f.startsWith('__') && f !== 'serif' && f !== 'sans-serif' && f !== 'inherit')
    .find(Boolean) ?? '';
}

function isOpaque(c: string): boolean {
  return !!c && c !== 'transparent' && !c.includes('rgba(0, 0, 0, 0)');
}

// ── 1. screenshot ─────────────────────────────────────────────────────────────

export async function screenshot(
  url: string,
  viewport: { width: number; height: number } = { width: 1280, height: 900 },
): Promise<Buffer | null> {
  console.log(`[BROWSER] screenshot ${url} @ ${viewport.width}x${viewport.height}`);
  return withBrowser(async (b) => {
    const page = await b.newPage();
    await page.setViewport(viewport);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });

    // Disable all animations/transitions via injected style tag
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });

    // Scroll full page to trigger lazy-loaded images, then back to top
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(r => setTimeout(r, 200));

    const buf = await page.screenshot({ fullPage: true });
    const bytes = (buf as Buffer).byteLength ?? (buf as Buffer).length;
    console.log(`[BROWSER] screenshot done — ${bytes} bytes`);
    return buf as Buffer;
  });
}

// ── 2. getPageSource ──────────────────────────────────────────────────────────

export async function getPageSource(url: string): Promise<string | null> {
  console.log(`[BROWSER] getPageSource ${url}`);
  return withBrowser(async (b) => {
    const page = await b.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
    const html = await page.content();
    console.log(`[BROWSER] source fetched — ${html.length} chars`);
    return html;
  });
}

// ── 3. detectApps ─────────────────────────────────────────────────────────────

export async function detectApps(url: string): Promise<AppDetectionResult> {
  console.log(`[BROWSER] detectApps ${url}`);

  const empty: AppDetectionResult = {
    url, appsDetected: [], unknownScripts: [],
    totalThirdPartyScripts: 0, estimatedSpeedImpact: 0,
    estimatedPageSpeedScore: 85, replaceableWithVAEO: [],
  };

  const result = await withBrowser(async (b) => {
    const page = await b.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });

    // Collect script[src] and link[href] — simple $$eval callbacks, no named assignments
    const scriptSrcs: string[] = await page.$$eval('script[src]',
      els => els.map(el => (el as HTMLScriptElement).src));
    const linkHrefs: string[] = await page.$$eval('link[href]',
      els => els.map(el => (el as HTMLLinkElement).href));
    const allUrls = [...scriptSrcs, ...linkHrefs].filter(Boolean);
    console.log(`[BROWSER] found ${allUrls.length} script/link URLs on page`);

    const pageHost = new URL(url).hostname.replace(/^www\./, '');
    const appsDetected: AppDetectionResult['appsDetected'] = [];
    const unknownScripts: string[] = [];
    const seen = new Set<string>();

    for (const src of allUrls) {
      let matched = false;
      for (const [pattern, app] of Object.entries(KNOWN_APPS)) {
        if (src.includes(pattern)) {
          if (!seen.has(app.name)) {
            seen.add(app.name);
            appsDetected.push({ name: app.name, type: app.type, scriptUrl: src, speedImpact: app.speedImpact });
            console.log(`[BROWSER]   ✓ ${app.name} (${app.type}, impact: ${app.speedImpact})`);
          }
          matched = true;
          break;
        }
      }
      if (!matched) {
        try {
          const h = new URL(src).hostname.replace(/^www\./, '');
          if (h !== pageHost && src.startsWith('http')) unknownScripts.push(src);
        } catch { /* invalid URL */ }
      }
    }

    const totalThirdPartyScripts  = appsDetected.length + unknownScripts.length;
    const estimatedSpeedImpact    = appsDetected.reduce((s, a) => s + a.speedImpact, 0);
    // Baseline 85 for typical Shopify site, capped 20–100
    const estimatedPageSpeedScore = Math.max(20, Math.min(100, 85 + estimatedSpeedImpact));
    const replaceableWithVAEO     = appsDetected
      .filter(a => VAEO_REPLACEMENTS[a.type])
      .map(a => ({ appName: a.name, vaeoComponent: VAEO_REPLACEMENTS[a.type] }));

    console.log(`[BROWSER] ${appsDetected.length} known apps, ${unknownScripts.length} unknown 3rd-party scripts`);
    console.log(`[BROWSER] speed impact: ${estimatedSpeedImpact} → PageSpeed ~${estimatedPageSpeedScore}`);
    if (replaceableWithVAEO.length)
      console.log(`[BROWSER] VAEO can replace: ${replaceableWithVAEO.map(r => r.appName).join(', ')}`);

    return {
      url,
      appsDetected,
      unknownScripts: unknownScripts.slice(0, 20),
      totalThirdPartyScripts,
      estimatedSpeedImpact,
      estimatedPageSpeedScore,
      replaceableWithVAEO,
    };
  });

  return result ?? empty;
}

// ── 4. measureLayout ──────────────────────────────────────────────────────────
// Uses page.$eval() one-liners throughout — no named function assignments
// inside browser evaluate calls (avoids esbuild __name injection).

export async function measureLayout(url: string): Promise<LayoutMeasurement | null> {
  console.log(`[BROWSER] measureLayout ${url}`);
  return withBrowser(async (b) => {
    const page = await b.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });

    // Header
    const headerHeight = await page.$eval('header,[role="banner"]',
      el => Math.round(el.getBoundingClientRect().height)).catch(() => 0);
    const headerPos    = await page.$eval('header,[role="banner"]',
      el => getComputedStyle(el).position).catch(() => '');
    const topBarExists = await page.$$eval(
      '[class*="announcement"],[class*="free-shipping"],[class*="topbar"],[class*="top-bar"]',
      els => els.length > 0).catch(() => false);
    const sticky = headerPos === 'sticky' || headerPos === 'fixed';

    // Hero
    const heroHeight = await page.$eval(
      '[class*="hero"],[class*="carousel"],[class*="banner"],[class*="Carousel"]',
      el => Math.round(el.getBoundingClientRect().height)).catch(() => 0);
    const heroHasText = await page.$eval(
      '[class*="hero"],[class*="carousel"],[class*="banner"]',
      el => (el.textContent?.trim().length ?? 0) > 10).catch(() => false);
    const heroHasButton = await page.$eval(
      '[class*="hero"],[class*="carousel"],[class*="banner"]',
      el => !!el.querySelector('a, button')).catch(() => false);

    // Product grid — prefer class-based column count, fallback to row detection
    const columnsDesktop = await page.$eval('[class*="grid"]', (el) => {
      const m = el.className.match(/grid-cols-(\d)/);
      if (m) return parseInt(m[1]);
      const items = Array.from(el.querySelectorAll(':scope > *'));
      if (items.length < 2) return 4;
      const firstTop = items[0].getBoundingClientRect().top;
      return items.filter(i => Math.abs(i.getBoundingClientRect().top - firstTop) < 10).length || 4;
    }).catch(() => 4);

    // Footer
    const footerColumns = await page.$eval('footer,[role="contentinfo"]', (el) => {
      const m = el.className.match(/grid-cols-(\d)/);
      if (m) return parseInt(m[1]);
      return Math.min(el.querySelectorAll(':scope > div > div, :scope > div').length || 3, 6);
    }).catch(() => 3);

    // Colors — read computed styles in Node.js context, convert rgb→hex here
    const rawAccent  = await page.$eval(
      '[class*="announcement"],[class*="free-shipping"],[class*="topbar"],[class*="top-bar"]',
      el => getComputedStyle(el).backgroundColor).catch(() => '');
    const rawHeader  = await page.$eval('header,[role="banner"]',
      el => getComputedStyle(el).backgroundColor).catch(() => '');
    const rawBodyBg  = await page.evaluate(() => getComputedStyle(document.body).backgroundColor).catch(() => '');
    const rawBodyTxt = await page.evaluate(() => getComputedStyle(document.body).color).catch(() => '');

    const colors: Record<string, string> = {};
    if (isOpaque(rawAccent))                                  colors['primary']    = toHex(rawAccent);
    if (isOpaque(rawHeader) && rawHeader !== 'rgb(255, 255, 255)') colors['header'] = toHex(rawHeader);
    if (isOpaque(rawBodyBg))                                  colors['background'] = toHex(rawBodyBg);
    if (rawBodyTxt)                                           colors['text']       = toHex(rawBodyTxt);

    // Fonts — computed styles, cleaned of Next.js internal names in Node.js context
    const rawHFont = await page.$eval('h1,h2', el => getComputedStyle(el).fontFamily).catch(() => '');
    const rawBFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily).catch(() => '');

    const layout: LayoutMeasurement = {
      header:      { height: headerHeight, sticky, topBarExists: topBarExists as boolean },
      hero:        { height: heroHeight, hasText: heroHasText as boolean, hasButton: heroHasButton as boolean },
      productGrid: { columnsDesktop: columnsDesktop as number, columnsMobile: Math.min(2, columnsDesktop as number) },
      footer:      { columns: footerColumns as number },
      colors,
      fonts: { heading: cleanFont(rawHFont), body: cleanFont(rawBFont) },
    };

    console.log(`[BROWSER] header=${layout.header.height}px sticky=${sticky} topBar=${topBarExists}`);
    console.log(`[BROWSER] hero=${layout.hero.height}px grid=${layout.productGrid.columnsDesktop}cols footer=${layout.footer.columns}cols`);
    console.log(`[BROWSER] colors: ${JSON.stringify(colors)}`);
    console.log(`[BROWSER] fonts: heading="${layout.fonts.heading}" body="${layout.fonts.body}"`);
    return layout;
  });
}

// ── 5. crawlSite ─────────────────────────────────────────────────────────────
// BFS crawler. Same-domain links only. Collects url/title/h1/meta/status.

export async function crawlSite(startUrl: string, maxPages = 50): Promise<CrawlResult | null> {
  console.log(`[BROWSER] crawlSite ${startUrl} (max ${maxPages})`);
  return withBrowser(async (b) => {
    const origin  = new URL(startUrl).origin;
    const visited = new Set<string>([startUrl]);
    const queue   = [startUrl];
    const pages: PageData[] = [];

    while (queue.length > 0 && pages.length < maxPages) {
      const pageUrl = queue.shift()!;
      console.log(`[BROWSER]   [${pages.length + 1}/${maxPages}] ${pageUrl}`);

      try {
        const page = await b.newPage();
        const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
        const statusCode = response?.status() ?? 0;

        const title    = await page.$eval('title', el => el.textContent?.trim() ?? '').catch(() => '');
        const h1       = await page.$eval('h1', el => el.textContent?.trim() ?? '').catch(() => '');
        const metaDesc = await page.$eval('meta[name="description"]',
          el => (el as HTMLMetaElement).content ?? '').catch(() => '');

        pages.push({ url: pageUrl, title, h1, metaDescription: metaDesc, statusCode });

        // Discover internal links (pass origin as argument to avoid closure capture)
        const links: string[] = await page.$$eval('a[href]',
          (els, orig) => (els as HTMLAnchorElement[])
            .map(el => el.href)
            .filter(href => href.startsWith(orig) && !href.includes('#') && !href.includes('?')),
          origin,
        ).catch(() => []);

        for (const link of links) {
          const norm = link.replace(/\/$/, '');
          if (!visited.has(norm) && !visited.has(norm + '/')) {
            visited.add(norm);
            queue.push(norm);
          }
        }
        await page.close();
      } catch (err) {
        console.warn(`[BROWSER]   error: ${pageUrl} — ${err}`);
        pages.push({ url: pageUrl, title: '', h1: '', metaDescription: '', statusCode: 0 });
      }
    }

    const lengths = pages.map(p => p.title.length);
    const summary = {
      total:          pages.length,
      errors:         pages.filter(p => p.statusCode >= 400 || p.statusCode === 0).length,
      missingH1:      pages.filter(p => !p.h1).length,
      missingMeta:    pages.filter(p => !p.metaDescription).length,
      avgTitleLength: Math.round(lengths.reduce((s, n) => s + n, 0) / (lengths.length || 1)),
    };

    console.log(`[BROWSER] crawl complete: ${summary.total} pages, ${summary.errors} errors, ${summary.missingH1} missing H1, ${summary.missingMeta} missing meta`);
    return { startUrl, pages, summary };
  });
}

// ── CLI mode ──────────────────────────────────────────────────────────────────
// Run directly: URL=https://example.com npx tsx scripts/browser.ts
// or:           npx tsx scripts/browser.ts https://example.com

if (process.argv[1]?.endsWith('browser.ts') || process.argv[1]?.endsWith('browser.js')) {
  const url = process.env.URL ?? process.argv[2] ?? '';
  if (!url) {
    console.error('Usage: URL=https://example.com npx tsx scripts/browser.ts');
    process.exit(1);
  }
  detectApps(url).then(result => {
    console.log('\n' + JSON.stringify(result, null, 2));
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
