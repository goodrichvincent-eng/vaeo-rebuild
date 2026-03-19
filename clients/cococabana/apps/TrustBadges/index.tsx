export type BadgeIcon = 'shield' | 'truck' | 'refresh' | 'star';

export interface TrustBadge {
  icon: BadgeIcon;
  text: string;
  enabled: boolean;
}

export interface TrustBadgesConfig {
  enabled: boolean;
  backgroundColor: string;
  badges: TrustBadge[];
}

export const defaultConfig: TrustBadgesConfig = {
  enabled: true,
  backgroundColor: '#ffffff',
  badges: [
    { icon: 'shield',  text: 'Secure Checkout',    enabled: true },
    { icon: 'truck',   text: 'Free Shipping $50+',  enabled: true },
    { icon: 'refresh', text: '30-Day Returns',       enabled: true },
    { icon: 'star',    text: '4.8★ Rated',           enabled: true },
  ],
};

// ── Inline SVG icons ─────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

const ICONS: Record<BadgeIcon, () => React.JSX.Element> = {
  shield:  ShieldIcon,
  truck:   TruckIcon,
  refresh: RefreshIcon,
  star:    StarIcon,
};

// ── Component ────────────────────────────────────────────────────────────────

export default function TrustBadges(props: Partial<TrustBadgesConfig> = {}) {
  const config = { ...defaultConfig, ...props };

  if (!config.enabled) return null;

  const activeBadges = config.badges.filter(b => b.enabled);
  if (activeBadges.length === 0) return null;

  return (
    <div
      className="py-6 px-4 border-y border-gray-100"
      style={{ backgroundColor: config.backgroundColor }}
    >
      <div className="max-w-container mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        {activeBadges.map((badge, i) => {
          const Icon = ICONS[badge.icon];
          return (
            <div key={i} className="flex items-center justify-center gap-2 text-coco-gray-dark">
              <Icon />
              <span className="text-xs font-semibold tracking-wide uppercase">{badge.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
