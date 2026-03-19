import type { Metadata } from 'next';
import FreeShippingBanner, { defaultConfig as freeShippingDefaults } from '@/apps/FreeShippingBanner';
import AnnouncementBar, { defaultConfig as announcementDefaults } from '@/apps/AnnouncementBar';
import TrustBadges, { defaultConfig as trustBadgesDefaults } from '@/apps/TrustBadges';
import ReviewBadge, { defaultConfig as reviewBadgeDefaults } from '@/apps/ReviewBadge';

export const metadata: Metadata = {
  title: 'App Library Preview',
  robots: { index: false, follow: false },
};

interface AppEntry {
  name: string;
  description: string;
  config: Record<string, unknown>;
  render: () => React.ReactNode;
}

const apps: AppEntry[] = [
  {
    name: 'FreeShippingBanner',
    description: 'Configurable free shipping threshold strip displayed at the top of the page.',
    config: freeShippingDefaults as unknown as Record<string, unknown>,
    render: () => <FreeShippingBanner />,
  },
  {
    name: 'AnnouncementBar',
    description: 'Simple announcement strip for sales, events, or seasonal messages.',
    config: announcementDefaults as unknown as Record<string, unknown>,
    render: () => <AnnouncementBar />,
  },
  {
    name: 'TrustBadges',
    description: 'Horizontal strip of trust and value-prop badges with SVG icons.',
    config: trustBadgesDefaults as unknown as Record<string, unknown>,
    render: () => <TrustBadges />,
  },
  {
    name: 'ReviewBadge',
    description: 'Star rating display for product pages. Shows rating, stars, and review count.',
    config: reviewBadgeDefaults as unknown as Record<string, unknown>,
    render: () => (
      <div className="p-6">
        <ReviewBadge rating={4.5} reviewCount={255} />
      </div>
    ),
  },
];

export default function PreviewPage({
  searchParams,
}: {
  searchParams: { app?: string };
}) {
  const filter = searchParams.app;
  const visible = filter
    ? apps.filter(a => a.name.toLowerCase() === filter.toLowerCase())
    : apps;

  if (filter && visible.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">
          App not found: <code className="bg-gray-100 px-2 py-1 rounded text-xs">{filter}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {!filter && (
        <header className="border-b border-gray-100 px-6 py-8 max-w-4xl mx-auto">
          <h1 className="font-heading text-2xl uppercase tracking-widest">
            VAEO App Library
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {apps.length} installed apps — live preview with default configs
          </p>
        </header>
      )}

      <div className="max-w-4xl mx-auto divide-y divide-gray-100">
        {visible.map(app => (
          <section key={app.name} className="py-8">
            {/* Name + description */}
            <div className="px-6 mb-4">
              <h2 className="font-heading text-lg uppercase tracking-widest">
                {app.name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{app.description}</p>
            </div>

            {/* Live render at full width */}
            <div className="border border-gray-100 rounded-lg overflow-hidden mx-6">
              {app.render()}
            </div>

            {/* Config */}
            <div className="px-6 mt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                Config
              </p>
              <pre className="bg-gray-50 border border-gray-100 rounded-lg p-4 text-xs text-gray-700 overflow-x-auto">
                {JSON.stringify(app.config, null, 2)}
              </pre>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
