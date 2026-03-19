# VAEO App Library

Configurable React components that replace third-party Shopify apps.
Zero external scripts. Pure React + Tailwind.

## Apps

### FreeShippingBanner

Displays a "Free shipping over $X" strip at the top of the page.

```tsx
import FreeShippingBanner from '@/apps/FreeShippingBanner';

<FreeShippingBanner />                          // uses defaults
<FreeShippingBanner threshold="$75" />          // override threshold
<FreeShippingBanner closeable linkUrl="/shop" /> // with close button and link
```

| Config Key        | Type    | Default     |
|-------------------|---------|-------------|
| `enabled`         | boolean | `true`      |
| `text`            | string  | `"Free shipping for orders over"` |
| `threshold`       | string  | `"$50"`     |
| `backgroundColor` | string  | `"#006064"` |
| `textColor`       | string  | `"#ffffff"` |
| `bold`            | boolean | `true`      |
| `closeable`       | boolean | `false`     |
| `linkUrl`         | string  | `""`        |

### AnnouncementBar

A simple announcement strip (sale, event, seasonal message).

```tsx
import AnnouncementBar from '@/apps/AnnouncementBar';

<AnnouncementBar />
<AnnouncementBar text="🎉 Flash Sale — 20% Off Everything" backgroundColor="#dc2626" />
```

| Config Key        | Type    | Default     |
|-------------------|---------|-------------|
| `enabled`         | boolean | `true`      |
| `text`            | string  | `"Summer 2025"` |
| `backgroundColor` | string  | `"#000000"` |
| `textColor`       | string  | `"#ffffff"` |
| `linkUrl`         | string  | `""`        |
| `openInNewTab`    | boolean | `false`     |

### TrustBadges

A horizontal strip of trust/value-prop badges with SVG icons.

```tsx
import TrustBadges from '@/apps/TrustBadges';

<TrustBadges />
<TrustBadges badges={[
  { icon: 'shield', text: 'SSL Encrypted', enabled: true },
  { icon: 'truck',  text: 'Next-Day Delivery', enabled: true },
]} />
```

| Config Key        | Type         | Default     |
|-------------------|--------------|-------------|
| `enabled`         | boolean      | `true`      |
| `backgroundColor` | string       | `"#ffffff"` |
| `badges`          | TrustBadge[] | 4 default badges |

Each badge: `{ icon: 'shield' | 'truck' | 'refresh' | 'star', text: string, enabled: boolean }`

### ReviewBadge

Star rating display for product pages.

```tsx
import ReviewBadge from '@/apps/ReviewBadge';

<ReviewBadge rating={4.5} reviewCount={255} />
<ReviewBadge rating={4.8} reviewCount={42} starColor="#f59e0b" />
```

| Config Key  | Type    | Default     |
|-------------|---------|-------------|
| `enabled`   | boolean | `true`      |
| `showStars` | boolean | `true`      |
| `showCount` | boolean | `true`      |
| `starColor` | string  | `"#000000"` |
| `textColor` | string  | `"#6b7280"` |

**Required props:** `rating` (number), `reviewCount` (number)

## Usage

Import individually or from the barrel:

```tsx
// Individual
import FreeShippingBanner from '@/apps/FreeShippingBanner';

// Barrel
import { FreeShippingBanner, AnnouncementBar, TrustBadges, ReviewBadge } from '@/apps';
```

All components accept partial config — pass only what you want to override.
