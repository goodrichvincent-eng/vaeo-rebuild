import type { Metadata } from 'next';
import { Lato, Marcellus } from 'next/font/google';
import './globals.css';

// TODO: import CartProvider from '@/components/CartProvider';
// TODO: import Header from '@/components/Header';
// TODO: import Footer from '@/components/Footer';

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

export const metadata: Metadata = {
  title: {
    default: 'Client Site',
    template: '%s | Client Site',
  },
  description: 'Powered by VAEO Rebuild',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lato.variable} ${marcellus.variable}`}>
      <body>
        {/* TODO: <CartProvider> */}
        {/* TODO: <Header /> */}
        <main id="main-content">
          {children}
        </main>
        {/* TODO: <Footer /> */}
        {/* TODO: </CartProvider> */}
      </body>
    </html>
  );
}
