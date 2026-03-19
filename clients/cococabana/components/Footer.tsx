import Link from 'next/link';
import Image from 'next/image';

const QUICK_LINKS = [
  { href: '/search',                 label: 'Search' },
  { href: '/pages/privacy-policy',   label: 'Privacy Policy' },
  { href: '/pages/returns',          label: 'Returns' },
  { href: '/pages/terms-of-service', label: 'Terms of Service' },
];

export default function Footer() {
  return (
    <footer style={{ background: '#000000' }} className="text-white">
      <div className="max-w-container mx-auto px-4 pt-14 pb-8">

        {/* 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-10 border-b border-white/10">

          {/* Col 1 — Brand */}
          <div>
            <h3 className="font-heading text-lg font-normal tracking-widest uppercase mb-4">
              Cococabana
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#afafaf' }}>
              Cococabana was founded to redefine modern outdoor living—blending luxury, leisure, and escape into every float.
            </p>
            <p className="text-sm leading-relaxed mt-3" style={{ color: '#afafaf' }}>
              This isn&apos;t your parents&apos; poolside lifestyle. It&apos;s our vision of freedom, comfort, and the pursuit of your own personal paradise—wherever the water takes you.
            </p>
          </div>

          {/* Col 2 — Quick Links */}
          <div>
            <h3 className="font-heading text-lg font-normal tracking-widest uppercase mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {QUICK_LINKS.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors hover:text-white"
                    style={{ color: '#afafaf' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — We Accept */}
          <div>
            <h3 className="font-heading text-lg font-normal tracking-widest uppercase mb-4">
              We Accept
            </h3>
            <div className="relative" style={{ maxWidth: '200px', height: '40px' }}>
              <Image
                src="/images/we-accept.webp"
                alt="We accept Visa, Mastercard, Amex, PayPal and more"
                fill
                sizes="200px"
                className="object-contain object-left"
              />
            </div>
          </div>

          {/* Col 4 — Follow Us */}
          <div>
            <h3 className="font-heading text-lg font-normal tracking-widest uppercase mb-4">
              Follow Us!
            </h3>
            <div className="flex items-center gap-4">
              <a
                href="https://www.facebook.com/hautedorliving"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Cococabana on Facebook"
                className="transition-opacity hover:opacity-60"
                style={{ color: '#afafaf' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                </svg>
              </a>
              <a
                href="https://www.instagram.com/hautedoorliving/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Cococabana on Instagram"
                className="transition-opacity hover:opacity-60"
                style={{ color: '#afafaf' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </a>
            </div>
          </div>

        </div>

        {/* Copyright */}
        <p className="text-center text-xs pt-6" style={{ color: '#afafaf' }}>
          Copyright © 2022, cococabana.com
        </p>

      </div>
    </footer>
  );
}
