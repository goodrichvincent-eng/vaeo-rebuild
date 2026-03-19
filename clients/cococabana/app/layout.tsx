import type { Metadata } from 'next';
import { Lato, Marcellus } from 'next/font/google';
import './globals.css';
import { CartProvider } from '@/components/CartProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getNavigation, getShop } from '@/lib/content';
import FreeShippingBanner from '@/apps/FreeShippingBanner';
import AnnouncementBar from '@/apps/AnnouncementBar';
// Inter removed — using Lato + Marcellus only

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-lato',
  display: 'swap',
});

const marcellus = Marcellus({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-marcellus',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const shop = getShop();
  return {
    metadataBase: new URL(`https://${shop.domain}`),
    title: {
      default: `${shop.name} — Luxury Pool Floats`,
      template: `%s | ${shop.name}`,
    },
    description: 'Premium luxury foam pool floats, inflatable loungers, and pool accessories designed for the ultimate relaxation experience.',
    openGraph: {
      siteName: shop.name,
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const nav = getNavigation();
  const mainNav = nav.main ?? [];

  return (
    <html lang="en" className={`${lato.variable} ${marcellus.variable}`}>
      <body>
        <CartProvider>
          <FreeShippingBanner />
          <AnnouncementBar />

          <Header navItems={mainNav} />

          <main id="main-content">
            {children}
          </main>

          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
