/**
 * scripts/sync.ts
 *
 * Incremental Shopify → headless sync for Coco Cabana.
 *
 * What it does:
 *   1. Pulls fresh products, collections, pages, menus from Shopify
 *   2. Downloads any NEW images (skips existing files)
 *   3. Pulls appio_reviews metafields and rebuilds reviews.json
 *   4. Writes updated data/content.json and data/reviews.json
 *   5. Runs `npm run build` then `vercel --prod`
 *   6. Logs results to logs/sync-[timestamp].json
 *
 * Usage:
 *   npm run sync          — full sync: pull + build + deploy
 *   npm run sync:dry      — dry run: pull + report, no build/deploy
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import sharp from 'sharp';
import { runDiff, type DiffReport } from './diff.ts';

// ── Config ────────────────────────────────────────────────────────────────────

const SHOP        = process.env.SHOPIFY_STORE ?? 'hautedoorliving.myshopify.com';
const TOKEN       = process.env.SHOPIFY_TOKEN ?? '';
const API_VERSION = '2025-01';

const DRY_RUN = process.argv.includes('--dry-run');

const ROOT       = new URL('..', import.meta.url).pathname;
const PUBLIC_DIR = join(ROOT, 'public', 'images');
const DATA_DIR   = join(ROOT, 'data');
const LOGS_DIR   = join(ROOT, 'logs');

// ── Shopify helpers ───────────────────────────────────────────────────────────

const BASE = `https://${SHOP}/admin/api/${API_VERSION}`;

async function shopifyGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Shopify-Access-Token': TOKEN },
  });
  if (!res.ok) throw new Error(`Shopify GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function shopifyGetAll(endpoint: string, key: string, limit = 250): Promise<any[]> {
  const results: any[] = [];
  let url: string | null = `${BASE}${endpoint}?limit=${limit}`;
  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN } });
    if (!res.ok) throw new Error(`Shopify paginate ${url} → ${res.status}`);
    const body = await res.json() as Record<string, any>;
    results.push(...(body[key] ?? []));
    const link = res.headers.get('link') ?? '';
    url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return results;
}

async function shopifyGql(query: string, variables: Record<string, any> = {}): Promise<any> {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL → ${res.status} ${await res.text()}`);
  const json = await res.json() as { data?: any; errors?: any[] };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// ── Image sync ────────────────────────────────────────────────────────────────

interface ImageMeta {
  localPath: string;
  width: number;
  height: number;
  alt: string;
}

let imagesAdded = 0;
let imagesSkipped = 0;
const imageManifest: Record<string, ImageMeta> = {};

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function syncImage(
  url: string,
  folderSlug: string,
  fileName: string,
  alt = '',
): Promise<ImageMeta | null> {
  if (!url) return null;
  const cacheKey = url.split('?')[0];
  if (imageManifest[cacheKey]) return imageManifest[cacheKey];

  try {
    const dir = join(PUBLIC_DIR, folderSlug);
    await mkdir(dir, { recursive: true });

    const webpName  = fileName.replace(/\.[^.]+$/, '') + '.webp';
    const localAbs  = join(dir, webpName);
    const localPath = `/images/${folderSlug}/${webpName}`;

    if (existsSync(localAbs)) {
      // Already on disk — read dimensions only
      imagesSkipped++;
    } else {
      if (!DRY_RUN) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Image fetch ${url} → ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await sharp(buf).webp({ quality: 85 }).toFile(localAbs);
        imagesAdded++;
        console.log(`  ↓ NEW  ${localPath}`);
      } else {
        // Dry run: count as would-be-added without downloading
        imagesAdded++;
        console.log(`  ↓ WOULD ADD  ${localPath}`);
      }
    }

    if (!DRY_RUN || existsSync(localAbs)) {
      const meta = await sharp(localAbs).metadata();
      const entry: ImageMeta = { localPath, width: meta.width ?? 0, height: meta.height ?? 0, alt };
      imageManifest[cacheKey] = entry;
      return entry;
    }

    // Dry run for a new image — return placeholder dims
    const entry: ImageMeta = { localPath, width: 0, height: 0, alt };
    imageManifest[cacheKey] = entry;
    return entry;
  } catch (err) {
    console.warn(`  ⚠ image skip ${url}: ${err}`);
    return null;
  }
}

function imageFileName(url: string, index: number): string {
  const raw  = url.split('?')[0].split('/').pop() ?? `img-${index}`;
  const base = raw.replace(/\.[^.]+$/, '');
  return `${index + 1}-${toSlug(base).slice(0, 40)}`;
}

// ── Data extractors ───────────────────────────────────────────────────────────

async function pullShop() {
  const { shop } = await shopifyGet('/shop.json');
  return {
    name:            shop.name            as string,
    domain:          shop.domain          as string,
    myshopifyDomain: shop.myshopify_domain as string,
    currency:        shop.currency        as string,
    description:     (shop.description ?? '') as string,
    email:           shop.email           as string,
  };
}

async function pullProducts() {
  const raw = await shopifyGetAll('/products.json', 'products');
  console.log(`  Shopify returned ${raw.length} products`);

  return Promise.all(raw.map(async (p: any) => {
    const images = (await Promise.all(
      (p.images ?? []).map((img: any, i: number) =>
        syncImage(img.src, p.handle, imageFileName(img.src, i), img.alt ?? p.title)
      )
    )).filter(Boolean) as ImageMeta[];

    return {
      id:           String(p.id),
      title:        p.title,
      handle:       p.handle,
      description:  p.body_html ?? '',
      type:         p.product_type ?? '',
      tags:         (p.tags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
      status:       p.status,
      vendor:       p.vendor,
      variants: (p.variants ?? []).map((v: any) => ({
        id:             String(v.id),
        title:          v.title,
        price:          v.price,
        compareAtPrice: v.compare_at_price ?? null,
        sku:            v.sku ?? '',
        available:      v.inventory_quantity > 0 || v.inventory_management === null,
        inventoryQty:   v.inventory_quantity ?? 0,
      })),
      options: (p.options ?? []).map((o: any) => ({ name: o.name, values: o.values })),
      images,
      featuredImage: images[0] ?? null,
      createdAt:     p.created_at,
      updatedAt:     p.updated_at,
    };
  }));
}

async function pullCollections() {
  const customs = await shopifyGetAll('/custom_collections.json', 'custom_collections');
  const smarts  = await shopifyGetAll('/smart_collections.json',  'smart_collections');
  const all     = [...customs, ...smarts];
  console.log(`  Shopify returned ${all.length} collections`);

  return Promise.all(all.map(async (c: any) => {
    const collProds = await shopifyGetAll(
      `/collections/${c.id}/products.json`, 'products'
    ).catch(() => []);

    let featuredImage: ImageMeta | null = null;
    if (c.image?.src) {
      featuredImage = await syncImage(c.image.src, `collections/${c.handle}`, '1-cover', c.image.alt ?? c.title);
    }

    return {
      id:            String(c.id),
      title:         c.title,
      handle:        c.handle,
      description:   c.body_html ?? '',
      type:          customs.find((x: any) => x.id === c.id) ? 'custom' : 'smart',
      featuredImage,
      productHandles: collProds.map((p: any) => p.handle as string),
      sortOrder:     c.sort_order ?? 'manual',
      updatedAt:     c.updated_at,
    };
  }));
}

async function pullPages() {
  const raw = await shopifyGetAll('/pages.json', 'pages');
  console.log(`  Shopify returned ${raw.length} pages`);
  return raw.map((p: any) => ({
    id:        String(p.id),
    title:     p.title,
    handle:    p.handle,
    bodyHtml:  p.body_html ?? '',
    author:    p.author ?? '',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

async function pullMenus() {
  const menuQuery = `query { menus(first: 20) { edges { node {
    handle title items { title url type }
  } } } }`;
  try {
    const data = await shopifyGql(menuQuery);
    const nodes: any[] = (data.menus?.edges ?? []).map((e: any) => e.node);
    const normalise = (node: any) => (node?.items ?? []).map((item: any) => ({
      title: item.title, url: item.url, type: item.type,
    }));
    const main   = nodes.find((n: any) => n.handle === 'main-menu');
    const footer = nodes.find((n: any) => n.handle === 'footer-menu');
    return {
      main:   normalise(main),
      footer: normalise(footer),
      all:    nodes.map((n: any) => ({ handle: n.handle, title: n.title, items: normalise(n) })),
    };
  } catch (err) {
    console.warn(`  ⚠ menu fetch failed: ${err}`);
    return { main: [], footer: [], all: [] };
  }
}

// ── Reviews (appio_reviews metafields) ───────────────────────────────────────

async function pullReviews(products: any[]): Promise<Record<string, any>> {
  console.log('\n⭐ Reviews (appio_reviews metafields)…');
  const reviewMap: Record<string, any> = {};

  // Try to load existing reviews first so we can show delta
  let existing: Record<string, any> = {};
  try {
    const raw = await readFile(join(DATA_DIR, 'reviews.json'), 'utf-8');
    existing = JSON.parse(raw);
  } catch { /* file may not exist */ }

  let fetched = 0;

  for (const product of products) {
    try {
      const { metafields } = await shopifyGet(
        `/products/${product.id}/metafields.json?namespace=appio_reviews`
      );
      if (!metafields?.length) continue;

      // appio_reviews stores all data in a single JSON metafield
      const reviewsMeta = metafields.find(
        (m: any) => m.namespace === 'appio_reviews' && m.key === 'reviews'
      );
      const summaryMeta = metafields.find(
        (m: any) => m.namespace === 'appio_reviews' && m.key === 'summary'
      );

      let reviews: any[] = [];
      let averageRating  = 0;
      let reviewCount    = 0;

      if (reviewsMeta) {
        try {
          const parsed = JSON.parse(reviewsMeta.value);
          reviews = (parsed.reviews ?? parsed ?? []).map((r: any) => ({
            id:        String(r.id ?? r.review_id ?? Math.random()),
            author:    r.author ?? r.reviewer?.name ?? 'Anonymous',
            rating:    Number(r.rating ?? r.score ?? 5),
            title:     r.title ?? '',
            body:      r.body ?? r.content ?? '',
            createdAt: r.created_at ?? r.date ?? '',
          }));
        } catch { /* malformed JSON */ }
      }

      if (summaryMeta) {
        try {
          const s = JSON.parse(summaryMeta.value);
          averageRating = Number(s.average_rating ?? s.average ?? 0);
          reviewCount   = Number(s.review_count ?? s.count ?? reviews.length);
        } catch { /* malformed JSON */ }
      }

      if (!averageRating && reviews.length > 0) {
        averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        reviewCount   = reviews.length;
      }

      if (reviewCount > 0) {
        reviewMap[product.handle] = {
          productId:     String(product.id),
          productHandle: product.handle,
          averageRating: Math.round(averageRating * 10) / 10,
          reviewCount,
          reviews: reviews.slice(0, 50), // cap at 50 per product
        };
        fetched++;
      }
    } catch (err) {
      console.warn(`  ⚠ reviews skip ${product.handle}: ${err}`);
    }
  }

  const newCount      = Object.keys(reviewMap).length;
  const existingCount = Object.keys(existing).length;
  console.log(`  Products with reviews: ${newCount} (was ${existingCount})`);
  console.log(`  Fetched metafields for: ${fetched} products`);
  return reviewMap;
}

// ── Delta report ──────────────────────────────────────────────────────────────

async function computeDelta(newContent: any): Promise<{
  productsUpdated: number;
  productsAdded: number;
  collectionsUpdated: number;
  pagesUpdated: number;
}> {
  let existing: any = { products: [], collections: [], pages: [] };
  try {
    const raw = await readFile(join(DATA_DIR, 'content.json'), 'utf-8');
    existing = JSON.parse(raw);
  } catch { /* first run */ }

  const existingProductMap = new Map(existing.products?.map((p: any) => [p.id, p.updatedAt]) ?? []);
  const existingColMap     = new Map(existing.collections?.map((c: any) => [c.id, c.updatedAt]) ?? []);
  const existingPageMap    = new Map(existing.pages?.map((p: any) => [p.id, p.updatedAt]) ?? []);

  let productsAdded   = 0;
  let productsUpdated = 0;
  for (const p of newContent.products) {
    if (!existingProductMap.has(p.id)) productsAdded++;
    else if (existingProductMap.get(p.id) !== p.updatedAt) productsUpdated++;
  }

  let collectionsUpdated = 0;
  for (const c of newContent.collections) {
    if (!existingColMap.has(c.id) || existingColMap.get(c.id) !== c.updatedAt) collectionsUpdated++;
  }

  let pagesUpdated = 0;
  for (const p of newContent.pages) {
    if (!existingPageMap.has(p.id) || existingPageMap.get(p.id) !== p.updatedAt) pagesUpdated++;
  }

  return { productsUpdated, productsAdded, collectionsUpdated, pagesUpdated };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log(`\n🔄 VAEO Sync — Coco Cabana`);
  console.log(`   Store:   ${SHOP}`);
  console.log(`   Mode:    ${DRY_RUN ? 'DRY RUN (no build/deploy)' : 'FULL SYNC'}`);
  console.log(`   Time:    ${new Date().toISOString()}\n`);

  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(DATA_DIR,   { recursive: true });
  await mkdir(LOGS_DIR,   { recursive: true });

  // ── Pull all data ────────────────────────────────────────────────────────

  console.log('📦 Pulling shop info…');
  const shop = await pullShop();
  console.log(`  ${shop.name} (${shop.domain})`);

  console.log('\n🛍  Pulling products…');
  const products = await pullProducts();

  console.log('\n📂 Pulling collections…');
  const collections = await pullCollections();

  console.log('\n📄 Pulling pages…');
  const pages = await pullPages();

  console.log('\n🗺  Pulling menus…');
  const navigation = await pullMenus();
  console.log(`  main: ${navigation.main.length} items, footer: ${navigation.footer.length} items`);

  const reviews = await pullReviews(products);

  // ── Compute delta ────────────────────────────────────────────────────────

  const newContent = {
    extractedAt: new Date().toISOString(),
    shop,
    products,
    collections,
    pages,
    navigation,
    images: imageManifest,
  };

  const delta = await computeDelta(newContent);
  const activeProducts = products.filter(p => p.status === 'active');

  console.log('\n📊 Delta report:');
  console.log(`  Products total:     ${products.length} (${activeProducts.length} active)`);
  console.log(`  Products added:     ${delta.productsAdded}`);
  console.log(`  Products updated:   ${delta.productsUpdated}`);
  console.log(`  Collections total:  ${collections.length}`);
  console.log(`  Collections changed:${delta.collectionsUpdated}`);
  console.log(`  Pages changed:      ${delta.pagesUpdated}`);
  console.log(`  Images new:         ${imagesAdded}`);
  console.log(`  Images existing:    ${imagesSkipped}`);
  console.log(`  Review products:    ${Object.keys(reviews).length}`);

  const anyChanges = delta.productsAdded + delta.productsUpdated +
    delta.collectionsUpdated + delta.pagesUpdated + imagesAdded > 0;

  if (DRY_RUN) {
    console.log('\n⏸  DRY RUN — skipping write, build, and deploy.');
    console.log(`  Would rebuild: ${anyChanges ? 'YES — changes detected' : 'NO — data is current'}`);

    // Write dry-run log
    const logEntry = {
      timestamp:          new Date().toISOString(),
      mode:               'dry-run',
      durationMs:         Date.now() - startTime,
      productsTotal:      products.length,
      productsActive:     activeProducts.length,
      productsAdded:      delta.productsAdded,
      productsUpdated:    delta.productsUpdated,
      collectionsChanged: delta.collectionsUpdated,
      pagesChanged:       delta.pagesUpdated,
      imagesAdded,
      imagesSkipped,
      reviewProducts:     Object.keys(reviews).length,
      wouldRebuild:       anyChanges,
      buildSuccess:       null,
      deployUrl:          null,
    };

    const logFile = join(LOGS_DIR, `sync-${Date.now()}.json`);
    await writeFile(logFile, JSON.stringify(logEntry, null, 2), 'utf-8');
    console.log(`\n📝 Log written: ${logFile}`);
    return;
  }

  // ── Write data files ─────────────────────────────────────────────────────

  console.log('\n💾 Writing data files…');
  await writeFile(join(DATA_DIR, 'content.json'), JSON.stringify(newContent, null, 2), 'utf-8');
  await writeFile(join(DATA_DIR, 'reviews.json'),  JSON.stringify(reviews, null, 2),    'utf-8');
  console.log('  ✓ content.json');
  console.log('  ✓ reviews.json');

  // ── Build ─────────────────────────────────────────────────────────────────

  let buildSuccess = false;
  let deployUrl    = '';

  console.log('\n🏗  Running npm run build…');
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    buildSuccess = true;
    console.log('  ✓ Build succeeded');
  } catch (err) {
    console.error('  ✗ Build failed:', err);
  }

  // ── Deploy ────────────────────────────────────────────────────────────────

  if (buildSuccess) {
    console.log('\n🚀 Deploying to Vercel…');
    try {
      const output = execSync('vercel --prod', { cwd: ROOT }).toString();
      const match  = output.match(/https:\/\/[^\s]+vercel\.app/);
      deployUrl    = match?.[0] ?? '';
      console.log(`  ✓ Deployed: ${deployUrl}`);
    } catch (err) {
      console.error('  ✗ Deploy failed:', err);
    }
  }

  // ── Post-deploy visual diff ─────────────────────────────────────────────

  let diffResults: { overallMatch: number; status: string; sections: DiffReport['sections'] } | null = null;
  if (deployUrl) {
    console.log('\n🔍 Running post-deploy visual diff…');
    try {
      const report = await runDiff({ silent: true });
      diffResults = {
        overallMatch: report.overallMatch,
        status: report.status,
        sections: report.sections,
      };
      const color = report.status === 'PASS' ? '\x1b[32m' : report.status === 'WARN' ? '\x1b[33m' : '\x1b[31m';
      console.log(`  Visual diff: ${color}${report.overallMatch}% ${report.status}\x1b[0m`);
    } catch (err) {
      console.warn(`  ⚠ Visual diff failed: ${err}`);
    }
  }

  // ── Write log ─────────────────────────────────────────────────────────────

  const logEntry = {
    timestamp:          new Date().toISOString(),
    mode:               'full-sync',
    durationMs:         Date.now() - startTime,
    productsTotal:      products.length,
    productsActive:     activeProducts.length,
    productsAdded:      delta.productsAdded,
    productsUpdated:    delta.productsUpdated,
    collectionsChanged: delta.collectionsUpdated,
    pagesChanged:       delta.pagesUpdated,
    imagesAdded,
    imagesSkipped,
    reviewProducts:     Object.keys(reviews).length,
    buildSuccess,
    deployUrl,
    diffResults,
  };

  const logFile = join(LOGS_DIR, `sync-${Date.now()}.json`);
  await writeFile(logFile, JSON.stringify(logEntry, null, 2), 'utf-8');
  console.log(`\n📝 Log: ${logFile}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Sync complete in ${elapsed}s`);
  if (deployUrl) console.log(`   Live: ${deployUrl}`);
}

main().catch((err) => {
  console.error('\n❌ Sync failed:', err);
  process.exit(1);
});
