# VAEO Rebuild Sandbox

## Clients

| Client | Type | Status | Live URL |
|--------|------|--------|----------|
| Coco Cabana | Shopify ecommerce | Live | coco-demo-silk.vercel.app |
| Trust Business Brokers | Static/WP lead gen | Live | trust-demo-murex.vercel.app |

## How to onboard a new client

1. Run: `./template/scripts/new-client.sh [name] [shopify-store] [token]`
2. Client is extracted and built automatically
3. Run: `npm run diff` to verify visual match
4. Run: `vercel --prod` to deploy

## Scripts

- **sync.ts** — daily data refresh from Shopify
- **diff.ts** — visual comparison engine (section-based)
- **extract.ts** — initial content extraction
- **new-client.sh** — one-command client onboarding

## Scores (as of 2026-03-19)

- Coco Cabana: 98 Performance / 100 SEO / 100 Accessibility / 100 Best Practices
- Trust Business Brokers: 99 Performance / 100 SEO / 96 Accessibility / 100 Best Practices
