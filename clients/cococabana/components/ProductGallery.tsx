'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { ProductImage } from '@/lib/content';

interface ProductGalleryProps {
  images: ProductImage[];
  title: string;
}

export default function ProductGallery({ images, title }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const current = images[active];

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-coco-gray rounded-sm flex items-center justify-center text-coco-gray-mid">
        No image
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden bg-coco-gray rounded-sm">
        <Image
          src={current.localPath}
          alt={current.alt || title}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((img, i) => (
            <button
              key={img.localPath}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              className={`relative w-16 h-16 overflow-hidden rounded-sm border-2 transition-colors ${
                i === active ? 'border-coco-black' : 'border-transparent hover:border-coco-gray-mid'
              }`}
            >
              <Image
                src={img.localPath}
                alt={img.alt || title}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
