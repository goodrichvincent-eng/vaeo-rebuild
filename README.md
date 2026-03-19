# VAEO Rebuild Sandbox

A reusable template system for rebuilding client websites as Next.js 14 headless frontends,
powered by Shopify data.

## Structure

```
vaeo-rebuild/
├── clients/
│   └── cococabana/          # Client #1 — Coco Cabana (cococabanalife.com)
│       ├── app/             # Next.js App Router pages
│       ├── components/      # React components
│       ├── lib/             # Content + reviews helpers
│       ├── data/
│       │   ├── content.json # Extracted Shopify data (products, collections, pages, nav)
│       │   └── reviews.json # Product review metafields
│       ├── public/images/   # Downloaded + WebP-converted product images
│       ├── scripts/
│       │   ├── extract.ts   # One-time: full Shopify extraction
│       │   └── sync.ts      # Incremental: pull changes → build → deploy
│       └── logs/            # Sync run logs (JSON)
│
├── template/
│   ├── scripts/
│   │   └── extract.ts       # Generalized extractor for any Shopify store
│   └── apps/                # Future: starter Next.js app template
│
└── README.md
```

## Workflow

### Onboard a new client
```bash
# Set env vars for the new store
export SHOPIFY_STORE=newclient.myshopify.com
export SHOPIFY_TOKEN=shpat_xxxxx
export CLIENT_NAME=newclient

# Run the generalized extractor
npx tsx template/scripts/extract.ts

# This creates clients/newclient/data/content.json + downloads all images
```

### Keep a client site up to date
```bash
cd clients/cococabana

# Dry run — see what changed without rebuilding
npm run sync:dry

# Full sync — pull changes, rebuild, deploy to Vercel
npm run sync
```

## Clients

| Client | Store | Deployed | Last Sync |
|--------|-------|----------|-----------|
| cococabana | hautedoorliving.myshopify.com | https://coco-demo-silk.vercel.app | see logs/ |

## Tech Stack

- **Framework**: Next.js 14 App Router (static generation)
- **Styling**: Tailwind CSS
- **Fonts**: Google Fonts via next/font
- **Images**: next/image with WebP conversion (sharp)
- **Data**: Static JSON extracted from Shopify Admin API
- **Deploy**: Vercel
- **Scripts**: TypeScript + tsx (no build step)
