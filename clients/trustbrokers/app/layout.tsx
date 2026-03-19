import type { Metadata } from 'next';
import { Playfair_Display, Inter } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets:  ['latin'],
  weight:   ['400', '600', '700'],
  style:    ['normal', 'italic'],
  variable: '--font-playfair',
  display:  'swap',
});

const inter = Inter({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  variable: '--font-inter',
  display:  'swap',
});

export const metadata: Metadata = {
  title:       'About Us | Trust Business Brokers and Advisors',
  description: 'Trust Business Brokers is a team of professional, hands on business brokers, whom have actually been entrepreneurs themselves. Expert business sales in Arizona.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="font-inter antialiased">
        {children}
      </body>
    </html>
  );
}
