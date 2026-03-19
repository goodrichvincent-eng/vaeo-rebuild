import type { Metadata } from 'next';
import Image from 'next/image';

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:       'About Us | Trust Business Brokers and Advisors',
  description: 'Trust Business Brokers is a team of professional, hands on business brokers, whom have actually been entrepreneurs themselves. Expert business sales in Arizona.',
  alternates: {
    canonical: 'https://www.trustbusinessbrokers.com/about-us/',
  },
  openGraph: {
    title:       'About Us | Trust Business Brokers and Advisors',
    description: 'Trust Business Brokers is a team of professional, hands on business brokers, whom have actually been entrepreneurs themselves. Expert business sales in Arizona.',
    url:         'https://www.trustbusinessbrokers.com/about-us/',
    type:        'website',
  },
  robots: 'index, follow',
};

// ── JSON-LD Schema ─────────────────────────────────────────────────────────────

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type':       'LocalBusiness',
      name:          'TrusT Business Brokers & Advisors',
      url:           'https://www.trustbusinessbrokers.com',
      telephone:     '+14804799900',
      description:   'Trust Business Brokers is a team of professional, hands on business brokers, whom have actually been entrepreneurs themselves.',
      address: {
        '@type':        'PostalAddress',
        addressRegion:  'AZ',
        addressCountry: 'US',
      },
    },
    {
      '@type':   'Organization',
      name:      'TrusT Business Brokers & Advisors',
      url:       'https://www.trustbusinessbrokers.com',
      telephone: '+14804799900',
      member: [
        {
          '@type':     'Person',
          name:        'Chris Prasifka',
          jobTitle:    'Founder & Lead Broker',
          description: 'Chris Prasifka, Founder of TrusT Business Brokers, has more than 30-plus years of experience working with small and medium size business owners.',
        },
        {
          '@type':     'Person',
          name:        'Vinny Goodrich',
          jobTitle:    'Partner',
          description: 'Vinny Goodrich, Partner at TrusT Business Brokers, brings over seven years of diverse experience in real estate, mortgage, and mergers and acquisitions.',
        },
      ],
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home',     item: 'https://www.trustbusinessbrokers.com/' },
        { '@type': 'ListItem', position: 2, name: 'About Us', item: 'https://www.trustbusinessbrokers.com/about-us/' },
      ],
    },
  ],
};

// ── Nav links ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Sell Your Business', href: '/sell-your-business/' },
  { label: 'Listings',           href: '/listings/',           dropdown: true },
  { label: 'Testimonials',       href: '/testimonials/' },
  { label: 'About',              href: '/about-us/' },
  { label: 'Contact',            href: '/contact/' },
  { label: 'Service Areas',      href: '/service-areas/' },
];

// ── Page component ─────────────────────────────────────────────────────────────

export default function AboutUsPage() {
  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── 1. Announcement Bar ──────────────────────────────────────── */}
      <div
        className="bg-navy text-white text-[14px] font-inter"
        style={{ padding: '10px 40px' }}
      >
        <div className="max-w-container mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-center sm:text-left">
          <span className="flex items-center justify-center sm:justify-start gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C10.61 21 3 13.39 3 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.25 1.01l-2.2 2.2z" />
            </svg>
            Most Businesses SOLD as West USA Affiliate
          </span>
          <a href="tel:+14804799900" className="hover:text-gold transition-colors">
            Serving All of Arizona | CALL (480) 479-9900 TODAY
          </a>
        </div>
      </div>

      {/* ── 2. Sticky Navigation ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b border-border-light">
        <div className="max-w-container mx-auto px-5 flex items-center justify-between h-[90px]">
          {/* Logo */}
          <a href="/" className="shrink-0">
            <Image
              src="/images/logo.png"
              alt="Trust Business Brokers logo"
              width={162}
              height={74}
              priority
              className="object-contain"
            />
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Main navigation">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-1 text-[13px] font-semibold tracking-[1px] uppercase text-navy hover:text-gold transition-colors"
              >
                {link.label}
                {link.dropdown && (
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                )}
              </a>
            ))}
          </nav>

          {/* CTA — gold bg, navy text for contrast */}
          <a
            href="/contact/"
            className="hidden lg:inline-flex items-center gap-2 bg-gold text-navy text-[15px] font-semibold tracking-[1.3px] uppercase transition-opacity hover:opacity-90"
            style={{ padding: '20px 40px', borderRadius: 0 }}
          >
            Receive a Free Evaluation
            <span aria-hidden="true">→</span>
          </a>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden flex flex-col gap-1.5 p-2"
            aria-label="Open menu"
          >
            <span className="block w-6 h-0.5 bg-navy" />
            <span className="block w-6 h-0.5 bg-navy" />
            <span className="block w-6 h-0.5 bg-navy" />
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main id="main-content">

        {/* ── 3. Hero Section ────────────────────────────────────────── */}
        <section className="bg-navy text-white" style={{ padding: '100px 0' }}>
          <div className="max-w-container mx-auto px-5 flex flex-col items-center text-center">
            {/* h1 — page title */}
            <h1 className="font-playfair text-[32px] font-semibold text-white mb-4">
              About Us
            </h1>
            {/* gold bg, navy text for contrast */}
            <a
              href="/contact/"
              className="inline-flex items-center gap-2 bg-gold text-navy text-[15px] font-semibold tracking-[1.3px] uppercase transition-opacity hover:opacity-90"
              style={{ padding: '20px 40px', borderRadius: 0 }}
            >
              Contact Us
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>

        {/* ── 4. About Text + Form ──────────────────────────────────── */}
        <section className="bg-white" style={{ padding: '60px 30px' }}>
          <div className="max-w-container mx-auto">
            <div className="flex flex-col lg:flex-row gap-10">

              {/* Left: body text */}
              <div className="lg:w-[58%]">
                <div className="space-y-5 text-[16px] text-text-body leading-[28px] font-inter">
                  <p>
                    Trust Business Brokers is a team of professional, hands on business brokers, whom have actually been entrepreneurs themselves.
                  </p>
                  <p>
                    Our goals are to assist sellers and buyers achieve their goals of selling or buying a business. The decision to sell or purchase a business is a major event in your life. Trust Business Brokers is an expert at assisting sellers and purchasers in navigating and negotiating the sale. We are personally involved in the transaction from the initial listing all the way through the closing.
                  </p>
                  <p>
                    If you desire professional, honest and thorough assistance, contact Trust Business brokers. I assure you that it will be your best decision when selling or purchasing a business.
                  </p>
                </div>

                {/* h2 — correct heading order (h1 → h2, not h1 → h3) */}
                <h2 className="font-playfair text-[24px] font-semibold text-navy mt-8 mb-0">
                  Our Leadership
                </h2>
              </div>

              {/* Right: evaluation form panel */}
              <div className="lg:w-[38%] bg-navy" style={{ padding: '50px 25px' }}>
                {/* h2 — parallel to "Our Leadership" */}
                <h2 className="font-playfair text-[30px] font-semibold text-white mb-3">
                  Receive a FREE Business Evaluation
                </h2>
                <p className="text-[14px] text-white/80 mb-6 font-inter">
                  Use the form below or call{' '}
                  <a href="tel:+14804799900" className="text-gold font-semibold hover:underline">
                    (480) 479-9900
                  </a>{' '}
                  today.
                </p>

                <form
                  action="mailto:info@trustbusinessbrokers.com"
                  method="POST"
                  encType="text/plain"
                  className="flex flex-col gap-3"
                >
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    placeholder="First Name"
                    required
                    aria-label="First Name"
                    className="w-full bg-white text-text-dark text-[14px] border border-border-light font-inter outline-none focus:ring-2 focus:ring-gold/40"
                    style={{ padding: '15px' }}
                  />
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    placeholder="Last Name"
                    required
                    aria-label="Last Name"
                    className="w-full bg-white text-text-dark text-[14px] border border-border-light font-inter outline-none focus:ring-2 focus:ring-gold/40"
                    style={{ padding: '15px' }}
                  />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Email Address"
                    required
                    aria-label="Email Address"
                    className="w-full bg-white text-text-dark text-[14px] border border-border-light font-inter outline-none focus:ring-2 focus:ring-gold/40"
                    style={{ padding: '15px' }}
                  />
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    placeholder="Phone Number"
                    aria-label="Phone Number"
                    className="w-full bg-white text-text-dark text-[14px] border border-border-light font-inter outline-none focus:ring-2 focus:ring-gold/40"
                    style={{ padding: '15px' }}
                  />
                  <textarea
                    id="message"
                    name="message"
                    placeholder="How may we assist you?"
                    rows={4}
                    aria-label="How may we assist you?"
                    className="w-full bg-white text-text-dark text-[14px] border border-border-light font-inter outline-none focus:ring-2 focus:ring-gold/40 resize-none"
                    style={{ padding: '15px' }}
                  />

                  {/* Select with visible label (sr-only keeps layout clean) */}
                  <div>
                    <label
                      htmlFor="inquiry_type"
                      className="sr-only"
                    >
                      I am a
                    </label>
                    <select
                      id="inquiry_type"
                      name="inquiry_type"
                      className="w-full bg-white text-text-body text-[14px] border border-border-light font-inter outline-none focus:ring-2 focus:ring-gold/40 cursor-pointer"
                      style={{ padding: '15px' }}
                    >
                      <option value="">Please Select</option>
                      <option value="seller">Seller</option>
                      <option value="buyer">Buyer</option>
                    </select>
                  </div>

                  {/* gold bg, navy text for contrast */}
                  <button
                    type="submit"
                    className="w-full bg-gold text-navy text-[15px] font-semibold tracking-[1.3px] uppercase transition-opacity hover:opacity-90 font-inter"
                    style={{ padding: '18px', borderRadius: 0, border: 'none', cursor: 'pointer' }}
                  >
                    Send Inquiry
                  </button>
                </form>
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Leadership Team ──────────────────────────────────────── */}
        <section className="bg-white" style={{ padding: '40px 30px' }}>
          <div className="max-w-container mx-auto space-y-8">

            {/* ── Chris Prasifka ── */}
            <div className="bg-[#f5f5f5] p-8">
              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                <div className="shrink-0">
                  <Image
                    src="/images/chris.jpg"
                    alt="Chris Prasifka, Founder & Lead Broker"
                    width={160}
                    height={160}
                    className="object-cover"
                    style={{ aspectRatio: '1/1' }}
                  />
                </div>
                <div className="flex flex-col justify-center">
                  {/* h3 — correct order under h2 "Our Leadership" */}
                  <h3 className="font-playfair text-[34px] font-semibold text-text-dark mb-1">
                    Chris Prasifka
                  </h3>
                  <p className="text-[14px] text-text-body font-inter mb-3">
                    Founder &amp; Lead Broker, LICENSE# SA656935000
                  </p>
                  <div className="h-[2px] w-16 bg-gold" />
                </div>
              </div>

              <div className="text-[16px] text-text-body leading-[28px] font-inter space-y-4">
                <p>
                  Chris Prasifka, Founder of TrusT Business Brokers, has more than 30-plus years of experience working with small and medium size business owners. Chris is one of the most respected Business Brokers in Arizona. Every year he is recognized by his peers as a top performer in the Business Broker Industry. Prior to forming TBB, Chris served as President of Kahala Franchise Corp, a $1.1 billion company with a diversified portfolio of high-quality, quick-service restaurant concepts including Cold Stone Creamery, Blimpie Subs, and Great Steak and Potato. Chris also held the position of Chief Operating Officer with Focus Brands parent company to Cinnabon, Carvel Ice Cream, and Seattle&apos;s Best Coffee. Chris has spent his entire career committed to the success of small business owners. From guiding countless entrepreneurs through the opening of their first business, to lobbying on Capitol Hill protecting the rights of small business owners.
                </p>
                <p className="italic">
                  &ldquo;I truly believe in the American Dream, and I am dedicated to helping people just like you achieve the dream.&rdquo;
                </p>
                <p>
                  Whether you are looking to buy your own business or would like to explore selling a business. I would be honored to get to know you and guide you through the process.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 mt-6 justify-end items-end">
                <Image
                  src="/images/badge-top1.jpg"
                  alt="Top 1 Percent Badge 2023"
                  width={100}
                  height={126}
                  className="object-contain"
                />
                <Image
                  src="/images/badge-million.jpg"
                  alt="Multi-Million Dollar Producers Badge 2023"
                  width={100}
                  height={101}
                  className="object-contain"
                />
                <Image
                  src="/images/badge-azbba.png"
                  alt="Arizona Business Brokers Association member"
                  width={100}
                  height={154}
                  className="object-contain"
                />
              </div>
            </div>

            {/* ── Vinny Goodrich ── */}
            <div className="bg-[#f5f5f5] p-8">
              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                <div className="shrink-0">
                  <Image
                    src="/images/vinny.jpg"
                    alt="Vinny Goodrich, Partner"
                    width={160}
                    height={160}
                    className="object-cover"
                    style={{ aspectRatio: '1/1' }}
                  />
                </div>
                <div className="flex flex-col justify-center">
                  {/* h3 — correct order under h2 "Our Leadership" */}
                  <h3 className="font-playfair text-[34px] font-semibold text-text-dark mb-1">
                    Vinny Goodrich
                  </h3>
                  <p className="text-[14px] text-text-body font-inter mb-3">
                    Partner, LICENSE# SA656935000
                  </p>
                  <div className="h-[2px] w-16 bg-gold" />
                </div>
              </div>

              <div className="text-[16px] text-text-body leading-[28px] font-inter">
                <p>
                  Vinny Goodrich, Partner at TrusT Business Brokers, brings over seven years of diverse experience in real estate, mortgage, and mergers and acquisitions. With a proven track record of success, Vinny has closed over $100 million in transactions, demonstrating his expertise in both real estate and business brokering. Vinny&apos;s greatest passion lies in helping others achieve their business goals. For him, assisting clients in navigating the complexities of buying or selling a business is not just a career but his most fulfilling purpose. There&apos;s nothing more rewarding to Vinny than witnessing the growth and success of his clients. Vinny&apos;s exceptional problem-solving skills and deep industry knowledge allow him to craft tailored solutions that address the specific needs of each business owner. His approach extends beyond simple transactions; he is dedicated to fully understanding and aligning with his clients&apos; unique objectives, offering personalized guidance every step of the way.
                </p>
              </div>
            </div>

          </div>
        </section>

      </main>{/* end #main-content */}

      {/* ── 6. Sticky Call Bar (mobile) ──────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border-light lg:hidden">
        <a
          href="tel:+14804799900"
          className="flex items-center justify-center text-[16px] font-inter text-navy font-medium"
          style={{ padding: '14px 20px' }}
        >
          Call (480) 479-9900 Today
        </a>
      </div>

      {/* ── 7. Footer ────────────────────────────────────────────────── */}
      <footer
        className="bg-navy-dark"
        style={{ padding: '10px 0', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        <p className="text-center text-[12px] text-text-body font-inter px-4">
          LIC# sa656935000 Copyright &copy; 2024 &ndash; TrusT Business Brokers &amp; Advisors. All rights reserved.
        </p>
      </footer>
    </>
  );
}
