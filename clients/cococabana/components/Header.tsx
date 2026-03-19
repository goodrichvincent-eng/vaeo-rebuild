'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useCart } from '@/components/CartProvider';
import type { NavItem } from '@/lib/content';

interface HeaderProps {
  navItems: NavItem[];
}

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function CartIcon({ count }: { count: number }) {
  return (
    <span className="relative inline-flex items-center">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
      {count > 0 && (
        <span className="absolute -top-2 -right-2 bg-sky text-white text-[9px] leading-none font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </span>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="4"   x2="20" y2="20"/>
      <line x1="20" y1="4"  x2="4"  y2="20"/>
    </svg>
  );
}

export default function Header({ navItems }: HeaderProps) {
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [scrolled, setScrolled]       = useState(false);
  const { lineCount, openCart }       = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function navHref(item: NavItem): string {
    if (item.url === '/') return '/';
    if (item.url.startsWith('/collections')) return '/collections';
    return item.url;
  }

  return (
    <header className={`sticky top-0 z-30 w-full transition-shadow ${scrolled ? 'shadow-md' : ''}`}>

      {/* ── Row 1: black bar ─────────────────────────────────────── */}
      <div className={`bg-black text-white transition-all overflow-hidden ${scrolled ? 'max-h-0 opacity-0' : 'max-h-12 opacity-100'}`}>
        <div className="max-w-container mx-auto px-4 h-10 flex items-center justify-between">
          {/* Left: socials */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/hautedorliving"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cococabana on Facebook"
              className="hover:opacity-70 transition-opacity"
            >
              <FacebookIcon />
            </a>
            <a
              href="https://www.instagram.com/hautedoorliving/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cococabana on Instagram"
              className="hover:opacity-70 transition-opacity"
            >
              <InstagramIcon />
            </a>
          </div>

          {/* Right: currency + account + cart */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium tracking-wide">USD</span>
            <a
              href="https://hautedoorliving.myshopify.com/account"
              aria-label="My account"
              className="hover:opacity-70 transition-opacity"
            >
              <AccountIcon />
            </a>
            <button
              onClick={openCart}
              aria-label="Open cart"
              className="hover:opacity-70 transition-opacity"
            >
              <CartIcon count={lineCount} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 2: logo ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-container mx-auto px-4 py-3 flex items-center justify-center relative">
          {/* Mobile hamburger — absolute left */}
          <button
            className="md:hidden absolute left-4 p-1"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          {/* Logo */}
          <Link href="/" aria-label="Cococabana home">
            <Image
              src="/images/logo.png"
              alt="Cococabana"
              width={200}
              height={91}
              className="h-14 w-auto object-contain"
              priority
            />
          </Link>

          {/* Mobile cart — absolute right */}
          <button
            onClick={openCart}
            aria-label="Open cart"
            className="md:hidden absolute right-4 hover:opacity-60 transition-opacity"
          >
            <CartIcon count={lineCount} />
          </button>
        </div>
      </div>

      {/* ── Row 3: nav links ─────────────────────────────────────── */}
      <nav className="hidden md:block bg-white border-b border-gray-200" aria-label="Main navigation">
        <div className="max-w-container mx-auto px-4">
          <ul className="flex items-center justify-center gap-8 h-10">
            {navItems.map(item => (
              <li key={item.url}>
                <Link
                  href={navHref(item)}
                  className="text-xs font-semibold tracking-widest uppercase text-black hover:text-sky transition-colors"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav className="md:hidden bg-white border-t border-gray-100" aria-label="Mobile navigation">
          <ul className="flex flex-col py-2">
            {navItems.map(item => (
              <li key={item.url}>
                <Link
                  href={navHref(item)}
                  className="block px-6 py-3 text-sm font-semibold tracking-widest uppercase text-black hover:bg-gray-50 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
