/**
 * scripts/extract.ts
 *
 * Shopify → headless content extractor.
 * Pulls products, collections, pages, menus, metafields, active theme,
 * downloads every image as WebP, and writes /data/content.json.
 *
 * Run: npx tsx scripts/extract.ts
 */

import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';

// ── Config ────────────────────────────────────────────────────────────────────

const SHOP  = 'hautedoorliving.myshopify.com';
const TOKEN = process.env.SHOPIFY_TOKEN ?? '';
const API_VERSION = '2025-01';

const ROOT       = new URL('..', import.meta.url).pathname;
const PUBLIC_DIR = join(ROOT, 'public', 'images');
const DATA_DIR   = join(ROOT, 'data');
const OUT_FILE   = join(DATA_DIR, 'content.json');

// ── Shopify REST helpers ───────────────────────────────────────────────────────

const BASE = `https://${SHOP}/admin/api/${API_VERSION}`;

async function shopifyGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Shopify GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

/** Paginate through all pages of a REST endpoint using link header. */
async function shopifyGetAll(endpoint: string, key: string, limit = 250): Promise<any[]> {
  const results: any[] = [];
  let url: string | null = `${BASE}${endpoint}?limit=${limit}`;

  while (url) {
    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': TOKEN },
    });
    if (!res.ok) throw new Error(`Shopify paginate ${url} → ${res.status}`);
    const body = await res.json() as Record<string, any>;
    results.push(...(body[key] ?? []));

    // Parse Link header for next page
    const link = res.headers.get('link') ?? '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    url = next;
  }

  return results;
}

// ── Shopify GraphQL helper ────────────────────────────────────────────────────

async function shopifyGql(query: string, variables: Record<string, any> = {}): Promise<any> {
  const res = await fetch(`https://${SHOP}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL → ${res.status} ${await res.text()}`);
  const json = await res.json() as { data?: any; errors?: any[] };
  if (json.errors?.length) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

// ── Image downloader ──────────────────────────────────────────────────────────

interface ImageMeta {
  localPath: string;  // relative to /public, e.g. /images/my-product/1.webp
  width:     number;
  height:    number;
  alt:       string;
}

const imageManifest: Record<string, ImageMeta> = {};
let   downloadCount = 0;

async function downloadImage(
  url:        string,
  folderSlug: string,
  fileName:   string,
  alt:        string = '',
): Promise<ImageMeta | null> {
  if (!url) return null;

  // Strip query params for cache key
  const cacheKey = url.split('?')[0];
  if (imageManifest[cacheKey]) return imageManifest[cacheKey];

  try {
    const dir = join(PUBLIC_DIR, folderSlug);
    await mkdir(dir, { recursive: true });

    const webpName  = fileName.replace(/\.[^.]+$/, '') + '.webp';
    const localAbs  = join(dir, webpName);
    const localPath = `/images/${folderSlug}/${webpName}`;

    if (!existsSync(localAbs)) {
      // Download to buffer
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Image fetch ${url} → ${res.status}`);
      const arrayBuf = await res.arrayBuffer();
      const inputBuf = Buffer.from(arrayBuf);

      // Convert to WebP via sharp, get native dimensions
      const sharpInst = sharp(inputBuf);
      await sharpInst
        .webp({ quality: 85 })
        .toFile(localAbs);
    }

    // Read dimensions from the saved file
    const meta   = await sharp(localAbs).metadata();
    const width  = meta.width  ?? 0;
    const height = meta.height ?? 0;

    const entry: ImageMeta = { localPath, width, height, alt };
    imageManifest[cacheKey] = entry;
    downloadCount++;
    process.stdout.write(`  ↓ ${localPath}\n`);
    return entry;
  } catch (err) {
    console.warn(`  ⚠ image skip ${url}: ${err}`);
    return null;
  }
}

// ── Slug helpers ──────────────────────────────────────────────────────────────

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function imageFileName(url: string, index: number): string {
  const raw  = basename(url.split('?')[0]);
  const base = raw.replace(/\.[^.]+$/, '');
  return `${index + 1}-${toSlug(base).slice(0, 40)}`;
}

// ── Extractors ────────────────────────────────────────────────────────────────

async function extractShop() {
  console.log('\n📦 Shop info…');
  const { shop } = await shopifyGet('/shop.json');
  return {
    name:        shop.name        as string,
    domain:      shop.domain      as string,
    myshopifyDomain: shop.myshopify_domain as string,
    currency:    shop.currency    as string,
    description: (shop.description ?? '') as string,
    email:       shop.email       as string,
  };
}

async function extractProducts() {
  console.log('\n🛍  Products…');
  const raw = await shopifyGetAll('/products.json', 'products');
  console.log(`   fetched ${raw.length} products`);

  const products = await Promise.all(raw.map(async (p: any) => {
    const images = await Promise.all(
      (p.images ?? []).map((img: any, i: number) =>
        downloadImage(img.src, p.handle, imageFileName(img.src, i), img.alt ?? p.title)
      )
    );

    return {
      id:              String(p.id),
      title:           p.title,
      handle:          p.handle,
      description:     p.body_html ?? '',
      type:            p.product_type ?? '',
      tags:            (p.tags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
      status:          p.status,
      vendor:          p.vendor,
      variants: (p.variants ?? []).map((v: any) => ({
        id:             String(v.id),
        title:          v.title,
        price:          v.price,
        compareAtPrice: v.compare_at_price ?? null,
        sku:            v.sku ?? '',
        available:      v.inventory_quantity > 0 || v.inventory_management === null,
        inventoryQty:   v.inventory_quantity ?? 0,
        weight:         v.weight ?? 0,
        weightUnit:     v.weight_unit ?? 'lb',
        options: {
          option1: v.option1 ?? null,
          option2: v.option2 ?? null,
          option3: v.option3 ?? null,
        },
      })),
      options: (p.options ?? []).map((o: any) => ({
        name:   o.name,
        values: o.values,
      })),
      images: images.filter(Boolean),
      featuredImage: images[0] ?? null,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }));

  return products;
}

async function extractCollections() {
  console.log('\n📂 Collections…');
  const customs = await shopifyGetAll('/custom_collections.json', 'custom_collections');
  const smarts  = await shopifyGetAll('/smart_collections.json',  'smart_collections');
  const all     = [...customs, ...smarts];
  console.log(`   fetched ${all.length} collections`);

  const collections = await Promise.all(all.map(async (c: any) => {
    // Get product handles for this collection
    const collProds = await shopifyGetAll(
      `/collections/${c.id}/products.json`,
      'products',
    ).catch(() => []);
    const productHandles = collProds.map((p: any) => p.handle as string);

    let featuredImage: ImageMeta | null = null;
    if (c.image?.src) {
      featuredImage = await downloadImage(
        c.image.src,
        `collections/${c.handle}`,
        '1-cover',
        c.image.alt ?? c.title,
      );
    }

    return {
      id:            String(c.id),
      title:         c.title,
      handle:        c.handle,
      description:   c.body_html ?? '',
      type:          customs.find((x: any) => x.id === c.id) ? 'custom' : 'smart',
      featuredImage,
      productHandles,
      sortOrder:     c.sort_order ?? 'manual',
      updatedAt:     c.updated_at,
    };
  }));

  return collections;
}

async function extractPages() {
  console.log('\n📄 Pages…');
  const raw = await shopifyGetAll('/pages.json', 'pages');
  console.log(`   fetched ${raw.length} pages`);

  return raw.map((p: any) => ({
    id:        String(p.id),
    title:     p.title,
    handle:    p.handle,
    bodyHtml:  p.body_html ?? '',
    author:    p.author    ?? '',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

async function extractMenus() {
  console.log('\n🗺  Navigation menus…');

  // 2025-01 Admin API: use menus(first:) — menu(handle:) is not supported.
  const menuQuery = `
    query GetMenus {
      menus(first: 20) {
        edges {
          node {
            handle
            title
            items {
              title
              url
              type
            }
          }
        }
      }
    }
  `;

  try {
    const data = await shopifyGql(menuQuery);
    const nodes: any[] = (data.menus?.edges ?? []).map((e: any) => e.node);

    const normalise = (node: any) =>
      (node?.items ?? []).map((item: any) => ({
        title: item.title,
        url:   item.url,
        type:  item.type,
      }));

    const main   = nodes.find((n: any) => n.handle === 'main-menu');
    const footer = nodes.find((n: any) => n.handle === 'footer-menu');

    console.log(`   found menus: ${nodes.map((n: any) => n.handle).join(', ')}`);

    return {
      main:   normalise(main),
      footer: normalise(footer),
      all:    nodes.map((n: any) => ({ handle: n.handle, title: n.title, items: normalise(n) })),
    };
  } catch (err) {
    console.warn(`  ⚠ menu fetch failed (non-fatal): ${err}`);
    return { main: [], footer: [], all: [] };
  }
}

async function extractMetafields() {
  console.log('\n🔖 Shop metafields…');
  try {
    const { metafields } = await shopifyGet('/metafields.json?owner_resource=shop');
    return (metafields ?? []).map((m: any) => ({
      namespace: m.namespace,
      key:       m.key,
      value:     m.value,
      type:      m.type,
    }));
  } catch (err) {
    console.warn(`  ⚠ metafields failed (non-fatal): ${err}`);
    return [];
  }
}

async function extractActiveTheme() {
  console.log('\n🎨 Active theme…');
  try {
    const { themes } = await shopifyGet('/themes.json');
    const main = (themes ?? []).find((t: any) => t.role === 'main');
    return {
      id:   main ? String(main.id) : null,
      name: main?.name ?? null,
      role: main?.role ?? null,
    };
  } catch (err) {
    console.warn(`  ⚠ theme fetch failed (non-fatal): ${err}`);
    return { id: null, name: null, role: null };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 Coco-demo extractor`);
  console.log(`   Shop: ${SHOP}`);
  console.log(`   API:  ${API_VERSION}`);
  console.log(`   Out:  ${OUT_FILE}\n`);

  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(DATA_DIR,   { recursive: true });

  const [shop, products, collections, pages, navigation, metafields, theme] =
    await Promise.all([
      extractShop(),
      extractProducts(),
      extractCollections(),
      extractPages(),
      extractMenus(),
      extractMetafields(),
      extractActiveTheme(),
    ]);

  const content = {
    extractedAt: new Date().toISOString(),
    shop,
    theme,
    metafields,
    products,
    collections,
    pages,
    navigation,
    images: imageManifest,
  };

  await writeFile(OUT_FILE, JSON.stringify(content, null, 2), 'utf-8');

  // ── Summary ────────────────────────────────────────────────────────────────
  const totalVariants  = products.reduce((n, p) => n + p.variants.length, 0);
  const totalImgRefs   = products.reduce((n, p) => n + p.images.length, 0);

  console.log('\n✅ Done!');
  console.log(`   Products:         ${products.length}  (${totalVariants} variants)`);
  console.log(`   Collections:      ${collections.length}`);
  console.log(`   Pages:            ${pages.length}`);
  console.log(`   Nav items:        main=${navigation.main.length}  footer=${navigation.footer.length}`);
  console.log(`   Metafields:       ${metafields.length}`);
  console.log(`   Images in refs:   ${totalImgRefs}`);
  console.log(`   Images downloaded:${downloadCount} (WebP, public/images/)`);
  console.log(`   Manifest entries: ${Object.keys(imageManifest).length}`);
  console.log(`   Output:           ${OUT_FILE}`);
}

main().catch((err) => {
  console.error('\n❌ Extract failed:', err);
  process.exit(1);
});
