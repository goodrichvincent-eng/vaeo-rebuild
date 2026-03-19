import Image from 'next/image';

interface PageBannerProps {
  src: string;
  alt: string;
  title: string;
  headingLevel?: 'h1' | 'p';
}

export default function PageBanner({ src, alt, title, headingLevel = 'h1' }: PageBannerProps) {
  // Truncate long titles in the banner (SEO fix: H1 over 70 chars)
  const displayTitle = title.length > 60 ? title.substring(0, 57) + '...' : title;

  const titleClass = 'font-heading text-3xl md:text-4xl font-normal text-white uppercase tracking-widest text-center px-4';

  return (
    <div className="relative w-full overflow-hidden" style={{ height: '300px' }}>
      <Image
        src={src}
        alt={alt}
        fill
        priority
        sizes="100vw"
        quality={85}
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
        {headingLevel === 'p' ? (
          <p className={titleClass}>{displayTitle}</p>
        ) : (
          <h1 className={titleClass}>{displayTitle}</h1>
        )}
      </div>
    </div>
  );
}
