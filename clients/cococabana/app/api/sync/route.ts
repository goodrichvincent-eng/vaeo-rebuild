/**
 * POST /api/sync
 *
 * Triggers a Shopify data sync and Vercel redeploy.
 * Called automatically by Vercel cron at 3am UTC daily,
 * or manually via: POST /api/sync with header x-sync-secret: <SYNC_SECRET>
 *
 * Required env vars:
 *   SYNC_SECRET   — shared secret to authenticate manual triggers
 *
 * Response:
 *   200 { success: true,  summary: { productsUpdated, imagesAdded, deployUrl } }
 *   401 { success: false, error: 'Unauthorized' }
 *   500 { success: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.SYNC_SECRET;
  // If no secret configured, only allow Vercel cron (identified by its header)
  if (!secret) {
    return req.headers.get('x-vercel-cron') === '1';
  }
  return (
    req.headers.get('x-sync-secret') === secret ||
    req.headers.get('x-vercel-cron') === '1'
  );
}

// ── Shopify helpers (inline — no external deps) ───────────────────────────────

const SHOP        = process.env.SHOPIFY_STORE ?? 'hautedoorliving.myshopify.com';
const TOKEN       = process.env.SHOPIFY_TOKEN ?? '';
const API_VERSION = '2025-01';
const BASE        = `https://${SHOP}/admin/api/${API_VERSION}`;

async function shopifyGetAll(endpoint: string, key: string): Promise<any[]> {
  const results: any[] = [];
  let url: string | null = `${BASE}${endpoint}?limit=250`;
  while (url) {
    const res: Response = await fetch(url, { headers: { 'X-Shopify-Access-Token': TOKEN } });
    if (!res.ok) break;
    const body = await res.json() as Record<string, any>;
    results.push(...(body[key] ?? []));
    const link = res.headers.get('link') ?? '';
    url = link.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }
  return results;
}

// ── Delta check ───────────────────────────────────────────────────────────────

async function computeProductDelta(freshProducts: any[]): Promise<number> {
  try {
    const dataPath = join(process.cwd(), 'data', 'content.json');
    const raw = await readFile(dataPath, 'utf-8');
    const existing = JSON.parse(raw) as { products: any[] };
    const existingMap = new Map(existing.products.map(p => [p.id, p.updatedAt]));
    let changed = 0;
    for (const p of freshProducts) {
      if (!existingMap.has(p.id) || existingMap.get(p.id) !== p.updated_at) changed++;
    }
    return changed;
  } catch {
    return freshProducts.length; // first run
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth check
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // 1. Pull fresh product list from Shopify to check for changes
    const freshProducts = await shopifyGetAll('/products.json', 'products');
    const productsUpdated = await computeProductDelta(freshProducts);

    // 2. Run the full sync script (pulls all data, downloads new images, writes JSON)
    //    This runs in the same process tree but is separate from the Next.js runtime.
    //    On Vercel, this runs as a serverless function — exec is available in Node runtime.
    const root = process.cwd();
    let imagesAdded = 0;
    let deployUrl   = '';
    let buildOk     = false;

    try {
      // Run sync (data pull + image download + write JSON only, no build/deploy)
      // We pass --data-only to avoid triggering another vercel deploy from within Vercel
      const syncOutput = execSync('npx tsx scripts/sync.ts --data-only', {
        cwd:     root,
        timeout: 240_000, // 4 min
        env:     { ...process.env, DATA_ONLY: '1' },
      }).toString();

      // Parse images added from sync output
      const imgMatch = syncOutput.match(/Images new:\s+(\d+)/);
      imagesAdded = imgMatch ? parseInt(imgMatch[1], 10) : 0;
      buildOk = true;
    } catch (syncErr: any) {
      console.error('[sync route] sync script error:', syncErr?.message);
      // Non-fatal: data may still have been updated even if script threw
    }

    // 3. If there were changes, trigger a Vercel redeploy via deploy hook
    //    Set VERCEL_DEPLOY_HOOK_URL in env to enable auto-redeploy
    const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (deployHook && (productsUpdated > 0 || imagesAdded > 0)) {
      try {
        const deployRes = await fetch(deployHook, { method: 'POST' });
        const deployBody = await deployRes.json() as { job?: { id?: string } };
        deployUrl = deployBody.job?.id
          ? `https://vercel.com/deployments/${deployBody.job.id}`
          : 'deploy triggered';
      } catch (deployErr) {
        console.error('[sync route] deploy hook error:', deployErr);
      }
    }

    const summary = {
      productsChecked: freshProducts.length,
      productsUpdated,
      imagesAdded,
      deployUrl,
      durationMs: Date.now() - startTime,
      triggeredAt: new Date().toISOString(),
    };

    console.log('[sync route] complete', summary);

    return NextResponse.json({ success: true, summary });

  } catch (err: any) {
    console.error('[sync route] fatal error:', err);
    return NextResponse.json(
      { success: false, error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}

// Vercel cron sends GET, not POST — handle both
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
