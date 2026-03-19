/**
 * template/scripts/extract.ts
 *
 * Generalized Shopify → headless content extractor.
 * Works for ANY Shopify store. Run once to onboard a new client.
 *
 * Usage:
 *   SHOPIFY_STORE=store.myshopify.com \
 *   SHOPIFY_TOKEN=shpat_xxxx \
 *   CLIENT_NAME=myclient \
 *   npx tsx template/scripts/extract.ts
 *
 * Output:
 *   clients/[CLIENT_NAME]/data/content.json  — all Shopify data
 *   clients/[CLIENT_NAME]/data/reviews.json  — appio_reviews metafields
 *   clients/[CLIENT_NAME]/public/images/     — WebP-converted images
 *
 * What gets extracted:
 *   - Shop info (name, domain, currency, email)
 *   - All products + variants + images (status: all, including draft)
 *   - All collections (custom + smart) + their product handles
 *   - All pages (about-us, privacy-policy, etc.)
 *   - Navigation menus (main-menu + footer-menu)
 *   - Shop-level metafields
 *   - Active theme metadata
 *   - Product review metafields (namespace: appio_reviews)
 *
 * Images:
 *   - Downloads from Shopify CDN
 *   - Converts to WebP at quality=85
 *   - Skips files that already exist on disk
 *   - Organizes into /public/images/[product-handle]/1-image-name.webp
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import sharp from 'sharp';

// ── Config (from environment variables) ──────────────────────────────────────

const SHOP        = process.env.SHOPIFY_STORE  ?? '';
const TOKEN       = process.env.SHOPIFY_TOKEN  ?? '';
const CLIENT_NAME = process.env.CLIENT_NAME    ?? '';
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? '2025-01';

// Validate required env vars
if (!SHOP || !TOKEN || !CLIENT_NAME) {
  console.error(`
❌ Missing required environment variables.

Required:
  SHOPIFY_STORE   — e.g. mystore.myshopify.com
  SHOPIFY_TOKEN   — Admin API access token (shpat_...)
  CLIENT_NAME     — slug for the client folder (e.g. cococabana)

Example:
  SHOPIFY_STORE=mystore.myshopify.com \\
  SHOPIFY_TOKEN=shpat_xxxx \\
  CLIENT_NAME=myclient \\
  npx tsx template/scripts/extract.ts
`);
  process.exit(1);
}

// Resolve output paths relative to the vaeo-rebuild root
const REPO_ROOT  = new URL('../..', import.meta.url).pathname;
const CLIENT_DIR = join(REPO_ROOT, 'clients', CLIENT_NAME);
const PUBLIC_DIR = join(CLIENT_DIR, 'public', 'images');
const DATA_DIR   = join(CLIENT_DIR, 'data');

// ── Shopify REST helpers ───────────────────────────────────────────────────────

const BASE = `https://${SHOP}/admin/api/${API_VERSION}`;

/** Single GET request to Shopify REST Admin API */
async function shopifyGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Shopify GET ${path} → ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * Paginate through all pages of a REST endpoint.
 * Uses the Link header for cursor-based pagination.
 */
async function shopifyGetAll(endpoint: string, key: string, limit = 250): Promise<any[]> {
  const results: any[] = [];
  let url: string | null = `${BASE}${endpoint}?limit=${limit}`;

  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN } });
    if (!res.ok) throw new Error(`Shopify paginate ${url} → ${res.status}`);
    const body = await res.json() as Record<string, any>;
    results.push(...(body[key] ?? []));

    // Extract "next" URL from Link header
    const link = res.headers.get('link') ?? '';
    url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }

  return results;
}

/** GraphQL request to Shopify Admin API */
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

// ── Image downloader ──────────────────────────────────────────────────────────

interface ImageMeta {
  localPath: string;  // relative to /public, e.g. /images/product-handle/1-name.webp
  width:     number;
  height:    number;
  alt:       string;
}

/** In-memory cache: CDN URL (no query params) → ImageMeta */
const imageManifest: Record<string, ImageMeta> = {};
let downloadCount = 0;
let skipCount     = 0;

/**
 * Download an image from Shopify CDN, convert to WebP, save locally.
 * Skips if the file already exists on disk.
 *
 * @param url        - Shopify CDN URL (may have query params)
 * @param folderSlug - subdirectory under public/images/ (e.g. product handle)
 * @param fileName   - base filename without extension
 * @param alt        - alt text for the image
 */
async function downloadImage(
  url:        string,
  folderSlug: string,
  fileName:   string,
  alt:        string = '',
): Promise<ImageMeta | null> {
  if (!url) return null;

  // Strip CDN query params for deduplication
  const cacheKey = url.split('?')[0];
  if (imageManifest[cacheKey]) return imageManifest[cacheKey];

  try {
    const dir = join(PUBLIC_DIR, folderSlug);
    await mkdir(dir, { recursive: true });

    const webpName  = fileName.replace(/\.[^.]+$/, '') + '.webp';
    const localAbs  = join(dir, webpName);
    const localPath = `/images/${folderSlug}/${webpName}`;

    if (!existsSync(localAbs)) {
      // Download image buffer from CDN
      const res = await fetch(url);
      if (!res.ok) throw new Error(`CDN fetch ${url} → ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      // Convert to WebP with sharp
      await sharp(buf).webp({ quality: 85 }).toFile(localAbs);
      downloadCount++;
      process.stdout.write(`  ↓ ${localPath}\n`);
    } else {
      skipCount++;
    }

    // Read dimensions from the saved file
    const meta   = await sharp(localAbs).metadata();
    const entry: ImageMeta = {
      localPath,
      width:  meta.width  ?? 0,
      height: meta.height ?? 0,
      alt,
    };
    imageManifest[cacheKey] = entry;
    return entry;
  } catch (err) {
    console.warn(`  ⚠ image skip ${url}: ${err}`);
    return null;
  }
}

// ── Slug / filename helpers ───────────────────────────────────────────────────

function toSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function imageFileName(url: string, index: number): string {
  const raw  = basename(url.split('?')[0]);
  const base = raw.replace(/\.[^.]+$/, '');
  return `${index + 1}-${toSlug(base).slice(0, 40)}`;
}

// ── Extractors ────────────────────────────────────────────────────────────────

/**
 * Extract shop-level information.
 * Includes: name, domain, currency, email, description.
 */
async function extractShop() {
  console.log('\n📦 Shop info…');
  const { shop } = await shopifyGet('/shop.json');
  return {
    name:            shop.name             as string,
    domain:          shop.domain           as string,
    myshopifyDomain: shop.myshopify_domain as string,
    currency:        shop.currency         as string,
    description:     (shop.description ?? '') as string,
    email:           shop.email            as string,
  };
}

/**
 * Extract all products with full variant, option, and image data.
 * Downloads product images to /public/images/[handle]/.
 * All statuses included (active, draft, archived).
 */
async function extractProducts() {
  console.log('\n🛍  Products…');
  const raw = await shopifyGetAll('/products.json', 'products');
  console.log(`   fetched ${raw.length} products`);

  return Promise.all(raw.map(async (p: any) => {
    // Download all product images
    const images = (await Promise.all(
      (p.images ?? []).map((img: any, i: number) =>
        downloadImage(img.src, p.handle, imageFileName(img.src, i), img.alt ?? p.title)
      )
    )).filter(Boolean) as ImageMeta[];

    return {
      id:           String(p.id),
      title:        p.title,
      handle:       p.handle,
      description:  p.body_html ?? '',
      type:         p.product_type ?? '',
      tags:         (p.tags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
      status:       p.status,          // 'active' | 'draft' | 'archived'
      vendor:       p.vendor,
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
      options: (p.options ?? []).map((o: any) => ({ name: o.name, values: o.values })),
      images,
      featuredImage: images[0] ?? null,
      createdAt:     p.created_at,
      updatedAt:     p.updated_at,
    };
  }));
}

/**
 * Extract all collections (custom + smart) with product handle lists.
 * Downloads collection featured images.
 */
async function extractCollections() {
  console.log('\n📂 Collections…');
  const customs = await shopifyGetAll('/custom_collections.json', 'custom_collections');
  const smarts  = await shopifyGetAll('/smart_collections.json',  'smart_collections');
  const all     = [...customs, ...smarts];
  console.log(`   fetched ${all.length} collections (${customs.length} custom, ${smarts.length} smart)`);

  return Promise.all(all.map(async (c: any) => {
    // Get all product handles for this collection
    const collProds = await shopifyGetAll(
      `/collections/${c.id}/products.json`, 'products'
    ).catch(() => []);

    // Download collection featured image
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
      id:             String(c.id),
      title:          c.title,
      handle:         c.handle,
      description:    c.body_html ?? '',
      type:           customs.find((x: any) => x.id === c.id) ? 'custom' : 'smart',
      featuredImage,
      productHandles: collProds.map((p: any) => p.handle as string),
      sortOrder:      c.sort_order ?? 'manual',
      updatedAt:      c.updated_at,
    };
  }));
}

/**
 * Extract all Shopify Pages (About Us, Privacy Policy, Terms, etc.)
 * These are the static content pages managed in Shopify admin.
 */
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

/**
 * Extract navigation menus via GraphQL.
 * Returns main-menu, footer-menu, and all menus.
 */
async function extractMenus() {
  console.log('\n🗺  Navigation menus…');

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
    const data  = await shopifyGql(menuQuery);
    const nodes = (data.menus?.edges ?? []).map((e: any) => e.node) as any[];

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

/**
 * Extract shop-level metafields.
 * Useful for global settings, social links, custom data.
 */
async function extractShopMetafields() {
  console.log('\n🔖 Shop metafields…');
  try {
    const { metafields } = await shopifyGet('/metafields.json?owner_resource=shop');
    const fields = (metafields ?? []).map((m: any) => ({
      namespace: m.namespace,
      key:       m.key,
      value:     m.value,
      type:      m.type,
    }));
    console.log(`   found ${fields.length} metafields`);
    return fields;
  } catch (err) {
    console.warn(`  ⚠ metafields failed (non-fatal): ${err}`);
    return [];
  }
}

/**
 * Extract active theme metadata.
 * Useful for knowing which theme is live (for theme apply operations).
 */
async function extractActiveTheme() {
  console.log('\n🎨 Active theme…');
  try {
    const { themes } = await shopifyGet('/themes.json');
    const main = (themes ?? []).find((t: any) => t.role === 'main');
    if (main) console.log(`   active theme: ${main.name} (id: ${main.id})`);
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

/**
 * Extract product review metafields (namespace: appio_reviews).
 * Each product can have reviews stored as JSON in its metafields.
 * Returns a map of productHandle → review data.
 *
 * Note: Other review apps (Judge.me, Yotpo, Okendo) use different namespaces.
 * Extend this function if your client uses a different review provider.
 */
async function extractReviews(products: any[]): Promise<Record<string, any>> {
  console.log('\n⭐ Product reviews (appio_reviews)…');
  const reviewMap: Record<string, any> = {};
  let productsWithReviews = 0;

  for (const product of products) {
    try {
      const { metafields } = await shopifyGet(
        `/products/${product.id}/metafields.json?namespace=appio_reviews`
      );
      if (!metafields?.length) continue;

      // Find the reviews list metafield
      const reviewsMeta = metafields.find(
        (m: any) => m.namespace === 'appio_reviews' && m.key === 'reviews'
      );
      // Find the summary metafield (average rating, count)
      const summaryMeta = metafields.find(
        (m: any) => m.namespace === 'appio_reviews' && m.key === 'summary'
      );

      let reviews: any[]  = [];
      let averageRating   = 0;
      let reviewCount     = 0;

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
        } catch { /* malformed JSON — skip */ }
      }

      if (summaryMeta) {
        try {
          const s = JSON.parse(summaryMeta.value);
          averageRating = Number(s.average_rating ?? s.average ?? 0);
          reviewCount   = Number(s.review_count   ?? s.count   ?? reviews.length);
        } catch { /* malformed JSON — compute from reviews */ }
      }

      // Fall back: compute summary from individual reviews
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
          reviews: reviews.slice(0, 100), // cap at 100 per product
        };
        productsWithReviews++;
      }
    } catch (err) {
      // Non-fatal: product may not have reviews metafield
      console.warn(`  ⚠ reviews skip ${product.handle}: ${err}`);
    }
  }

  console.log(`   products with reviews: ${productsWithReviews}`);
  return reviewMap;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log(`\n🚀 VAEO Rebuild — Shopify Extractor`);
  console.log(`   Store:  ${SHOP}`);
  console.log(`   Client: ${CLIENT_NAME}`);
  console.log(`   API:    ${API_VERSION}`);
  console.log(`   Output: ${DATA_DIR}\n`);

  // Ensure output directories exist
  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(DATA_DIR,   { recursive: true });

  // ── Extract all data in parallel where safe ──────────────────────────────
  // Note: products and collections are sequential due to per-item image downloads
  // Shop info, pages, menus, metafields, and theme can all run in parallel

  const [shop, pages, navigation, metafields, theme] = await Promise.all([
    extractShop(),
    extractPages(),
    extractMenus(),
    extractShopMetafields(),
    extractActiveTheme(),
  ]);

  // Products and collections must be sequential (image downloads per-item)
  const products    = await extractProducts();
  const collections = await extractCollections();

  // Reviews: sequential, one API call per product with reviews metafield
  const reviews = await extractReviews(products);

  // ── Assemble output ──────────────────────────────────────────────────────

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

  await writeFile(join(DATA_DIR, 'content.json'), JSON.stringify(content, null, 2), 'utf-8');
  await writeFile(join(DATA_DIR, 'reviews.json'),  JSON.stringify(reviews, null, 2),  'utf-8');

  // ── Summary ──────────────────────────────────────────────────────────────

  const activeProducts   = products.filter(p => p.status === 'active');
  const totalVariants    = products.reduce((n, p) => n + p.variants.length, 0);
  const totalImgRefs     = products.reduce((n, p) => n + p.images.length,   0);
  const elapsed          = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n✅ Extraction complete!');
  console.log(`   Client:           ${CLIENT_NAME}`);
  console.log(`   Products total:   ${products.length} (${activeProducts.length} active)`);
  console.log(`   Variants:         ${totalVariants}`);
  console.log(`   Collections:      ${collections.length}`);
  console.log(`   Pages:            ${pages.length}`);
  console.log(`   Nav items:        main=${navigation.main.length} footer=${navigation.footer.length}`);
  console.log(`   Metafields:       ${metafields.length}`);
  console.log(`   Product images:   ${totalImgRefs} refs`);
  console.log(`   Images downloaded:${downloadCount} new, ${skipCount} already existed`);
  console.log(`   Reviews:          ${Object.keys(reviews).length} products`);
  console.log(`   Time:             ${elapsed}s`);
  console.log(`\n   → ${join(DATA_DIR, 'content.json')}`);
  console.log(`   → ${join(DATA_DIR, 'reviews.json')}`);
  console.log(`\nNext step: build the Next.js frontend in clients/${CLIENT_NAME}/`);
}

main().catch((err) => {
  console.error('\n❌ Extraction failed:', err);
  process.exit(1);
});
