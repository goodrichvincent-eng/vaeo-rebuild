'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Slide {
  src: string;
  alt: string;
  align: 'left' | 'right' | 'center';
  scheme: 'dark' | 'light';
  heading: string;
  description: string;
  buttonText: string;
  buttonHref: string;
}

const SLIDES: Slide[] = [
  {
    src: '/images/hero-1.webp',
    alt: 'Colorful beach setting with sunhat and towel',
    align: 'right',
    scheme: 'dark',
    heading: 'COCOCABANA',
    description: 'Live the moment, stay relaxed',
    buttonText: 'Visit the Shop',
    buttonHref: '/collections',
  },
  {
    src: '/images/hero-2.webp',
    alt: 'Luxury lounge chairs beneath a thatched umbrella facing crystal-blue waters',
    align: 'left',
    scheme: 'dark',
    heading: 'COCOCABANA',
    description: 'Luxury Pool Foam Floats and Inflatables',
    buttonText: 'Shop All Floats',
    buttonHref: '/collections',
  },
  {
    src: '/images/hero-3.webp',
    alt: 'Cococabana foam pool loungers poolside — vibrant colors meet luxury resort energy',
    align: 'center',
    scheme: 'light',
    heading: 'COCOCABANA',
    description: 'Summer is here!',
    buttonText: 'Shop Floats Now',
    buttonHref: '/collections',
  },
];

const AUTOPLAY_SPEED = 5000;

export default function HeroCarousel() {
  const [current, setCurrent]   = useState(0);
  const [fading,  setFading]    = useState(false);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  function goTo(idx: number) {
    if (idx === current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setFading(true);
    setTimeout(() => {
      setCurrent(idx);
      setFading(false);
    }, 350);
  }

  function next() { goTo((current + 1) % SLIDES.length); }
  function prev() { goTo((current - 1 + SLIDES.length) % SLIDES.length); }

  // Autoplay — dep array includes `current` so timer resets on each slide change
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setCurrent(c => (c + 1) % SLIDES.length);
    }, AUTOPLAY_SPEED);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current]);

  const slide = SLIDES[current];

  const alignClass =
    slide.align === 'left'   ? 'items-start text-left  pl-10 md:pl-20' :
    slide.align === 'right'  ? 'items-end   text-right pr-10 md:pr-20' :
                               'items-center text-center px-4';

  const textColor   = slide.scheme === 'dark' ? 'text-white'   : 'text-black';
  const overlayBg   = slide.scheme === 'dark'
    ? 'bg-gradient-to-b from-black/25 via-black/15 to-black/25'
    : 'bg-white/10';

  const btnClass = slide.scheme === 'dark'
    ? 'bg-white text-black hover:bg-gray-100'
    : 'bg-black text-white hover:bg-gray-800';

  return (
    <section className="relative w-full h-screen min-h-[500px] overflow-hidden" aria-label="Hero slideshow">
      {/* Slide images — all pre-rendered, opacity toggle for fade */}
      {SLIDES.map((s, i) => (
        <div
          key={s.src}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current && !fading ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          aria-hidden={i !== current}
        >
          <Image
            src={s.src}
            alt={s.alt}
            fill
            priority={i === 0}
            sizes="100vw"
            quality={85}
            className="object-cover object-center"
          />
        </div>
      ))}

      {/* Overlay + copy */}
      <div className={`absolute inset-0 z-20 ${overlayBg} flex flex-col justify-center ${alignClass}`}>
        <div className="max-w-lg space-y-4">
          <h1 className={`font-heading text-5xl md:text-7xl font-normal tracking-widest uppercase ${textColor}`}>
            {slide.heading}
          </h1>
          <p className={`text-base md:text-lg font-light tracking-wide ${textColor} opacity-90`}>
            {slide.description}
          </p>
          <Link
            href={slide.buttonHref}
            className={`inline-block mt-2 px-8 py-3 text-xs font-bold tracking-widest uppercase transition-colors ${btnClass}`}
          >
            {slide.buttonText}
          </Link>
        </div>
      </div>

      {/* Arrows */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center rounded-full transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 bg-black/40 hover:bg-black/60 text-white flex items-center justify-center rounded-full transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="p-2 flex items-center justify-center"
          >
            <span className={`block w-4 h-4 rounded-full transition-all ${
              i === current ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/75'
            }`} />
          </button>
        ))}
      </div>
    </section>
  );
}
