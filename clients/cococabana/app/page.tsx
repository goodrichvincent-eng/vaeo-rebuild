import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  getCollectionByHandle,
  getCollectionProducts,
  getActiveProducts,
  getShop,
} from '@/lib/content';
import HeroCarousel from '@/components/HeroCarousel';
import ProductCard from '@/components/ProductCard';
import NewsletterForm from '@/components/NewsletterForm';
import TrustBadges from '@/apps/TrustBadges';

export const metadata: Metadata = {
  title: 'Luxury Pool Floats & Inflatable Loungers',
  description: "Shop Cococabana's premium foam pool floats, inflatable loungers, and pool accessories. Free shipping on orders over $75.",
  alternates: { canonical: 'https://coco-demo-silk.vercel.app/' },
  openGraph: {
    title: 'Cococabana — Luxury Pool Floats',
    description: 'Premium foam pool floats and inflatable loungers for the ultimate pool experience.',
  },
};

function HomeSchema() {
  const shop = getShop();
  const siteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: shop.name,
    url: 'https://coco-demo-silk.vercel.app',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://coco-demo-silk.vercel.app/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: shop.name,
    url: 'https://coco-demo-silk.vercel.app',
    logo: 'https://coco-demo-silk.vercel.app/images/logo.png',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'customerservice@cococabanalife.com',
      contactType: 'customer service',
    },
    sameAs: [
      'https://www.facebook.com/hautedorliving',
      'https://www.instagram.com/hautedoorliving/',
    ],
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />
    </>
  );
}

export default function HomePage() {
  // Featured products: prefer multi-use-pool-floats, fall back to all active if fewer than 4
  const multiUseCol        = getCollectionByHandle('multi-use-pool-floats');
  const collectionProducts = multiUseCol ? getCollectionProducts(multiUseCol) : [];
  const featuredProducts   = collectionProducts.length >= 4
    ? collectionProducts.slice(0, 6)
    : getActiveProducts().slice(0, 6);

  return (
    <>
      <HomeSchema />

      {/* ── 1. Hero Carousel ──────────────────────────────────────────────── */}
      <HeroCarousel />

      {/* ── Trust Badges ───────────────────────────────────────────────── */}
      <TrustBadges />

      {/* ── 2. Shop info icon strip ──────────────────────────────────────── */}
      <section className="py-12 px-4 border-b border-gray-100" aria-label="Why Cococabana">
        <div className="max-w-container mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Icon 1 */}
            <div className="flex flex-col items-center text-center gap-3 px-4">
              <div className="w-14 h-14 rounded-full border-2 border-black flex items-center justify-center">
                {/* fa-users equivalent */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                  <path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <h3 className="font-heading text-base font-normal tracking-wide uppercase">
                Loved by 100K+ Pool &amp; Lake Enthusiasts
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Over 10 years of delivering premium vinyl‑coated floats with 4.8★ average ratings.
              </p>
            </div>

            {/* Icon 2 */}
            <div className="flex flex-col items-center text-center gap-3 px-4">
              <div className="w-14 h-14 rounded-full border-2 border-black flex items-center justify-center">
                {/* fa-shield equivalent */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3 className="font-heading text-base font-normal tracking-wide uppercase">
                Built to Last, Season After Season
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Crafted from marine‑grade vinyl foam and durable inflatables — made for sun, salt, and serious floating.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Collection list — 3 columns ───────────────────────────────── */}
      <section className="py-16 px-4" aria-label="Shop by collection">
        <div className="max-w-container mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

            {/* Col 1 — Multi-Use Pool Floats */}
            <Link href="/collections/multi-use-pool-floats" className="group block">
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                <Image
                  src="/images/col-multi-use.webp"
                  alt="Woman smiling on a Cococabana green saddle float"
                  fill
                  sizes="(max-width:640px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="mt-4 text-center">
                <h3 className="font-heading text-lg font-normal uppercase tracking-wide">Multi-Use Pool Floats</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Sit, lay, drift, or lounge — these floats flex with your mood. One float, endless fun.
                </p>
                <span className="mt-3 inline-block text-xs font-bold tracking-widest uppercase border-b border-black pb-0.5 hover:opacity-60 transition-opacity">
                  Shop Now
                </span>
              </div>
            </Link>

            {/* Col 2 — Pool Chairs & Loungers */}
            <Link href="/collections/pool-chairs-and-loungers" className="group block">
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                <Image
                  src="/images/col-loungers.webp"
                  alt="Cococabana inflatable pool chair lifestyle photo"
                  fill
                  sizes="(max-width:640px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="mt-4 text-center">
                <h3 className="font-heading text-lg font-normal uppercase tracking-wide">Floating Pool Chairs &amp; Loungers</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Lean back, sip something cold, and float like you mean it — luxury meets lake life.
                </p>
                <span className="mt-3 inline-block text-xs font-bold tracking-widest uppercase border-b border-black pb-0.5 hover:opacity-60 transition-opacity">
                  Shop Now
                </span>
              </div>
            </Link>

            {/* Col 3 — Luxury Foam Pool Floats */}
            <Link href="/collections/luxury-foam-pool-floats" className="group block">
              <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                <Image
                  src="/images/col-foam-floats.webp"
                  alt="Man and woman on bright green foam pool loungers"
                  fill
                  sizes="(max-width:640px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="mt-4 text-center">
                <h3 className="font-heading text-lg font-normal uppercase tracking-wide">Luxury Foam Pool Floats</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Unwind on ultra‑thick, headrest‑equipped loungers built for endless poolside fun.
                </p>
                <span className="mt-3 inline-block text-xs font-bold tracking-widest uppercase border-b border-black pb-0.5 hover:opacity-60 transition-opacity">
                  Shop Now
                </span>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* ── 4. Image-text overlay banner ─────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ height: '500px' }}
        aria-label="Make the most of this summer"
      >
        <Image
          src="/images/banner-with-text.webp"
          alt="Person lounging on white sand beach under turquoise sun hat"
          fill
          sizes="100vw"
          quality={85}
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center text-center px-4">
          <h2 className="font-heading text-3xl md:text-5xl font-normal text-white uppercase tracking-widest mb-6">
            Make the Most of This Summer
          </h2>
          <Link href="/collections" className="bg-white text-black px-10 py-3 text-xs font-bold tracking-widest uppercase hover:bg-gray-100 transition-colors">
            Shop Now
          </Link>
        </div>
      </section>

      {/* ── 5. Featured Products carousel (multi-use-pool-floats) ────────── */}
      <section className="py-16 px-4 bg-gray-50" aria-label="Featured products">
        <div className="max-w-container mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-heading text-3xl font-normal uppercase tracking-widest">
              Featured Products
            </h2>
          </div>

          {/* 3-col grid, max 6 products (2 rows × 3) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {featuredProducts.slice(0, 6).map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/collections/multi-use-pool-floats"
              className="btn-outline"
              aria-label="See more pool floats"
            >
              See more pool floats
            </Link>
          </div>
        </div>
      </section>

      {/* ── 6. Bottom banner (no button) ─────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ height: '800px' }}
        aria-label="Plan your next pool party"
      >
        <Image
          src="/images/bottom-banner.webp"
          alt="Cococabana pool floats and pool party atmosphere"
          quality={85}
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/15 flex flex-col items-center justify-center text-center px-4">
          <h2 className="font-heading text-3xl md:text-5xl font-normal text-white uppercase tracking-widest">
            Plan Your Next Pool Party
          </h2>
        </div>
      </section>

      {/* ── 7. Newsletter ─────────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-white border-t border-gray-100" aria-label="Newsletter signup">
        <div className="max-w-md mx-auto text-center">
          <p className="text-xs font-semibold tracking-widest uppercase text-gray-600 mb-2">
            Stay with us
          </p>
          <h2 className="font-heading text-3xl font-normal uppercase tracking-widest mb-3">
            Get Newsletter
          </h2>
          <p className="text-sm text-gray-500 mb-7 leading-relaxed">
            Subscribe to hear more about our stories and announcements
          </p>
          <NewsletterForm />
        </div>
      </section>

    </>
  );
}

