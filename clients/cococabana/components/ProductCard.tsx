import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/lib/content';
import { getProductPriceRange } from '@/lib/content';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { min, max, same } = getProductPriceRange(product);
  const img = product.featuredImage;

  return (
    <Link
      href={`/products/${product.handle}`}
      className="group block"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-coco-gray rounded-sm">
        {img ? (
          <Image
            src={img.localPath}
            alt={img.alt || product.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-coco-gray-mid text-sm">
            No image
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mt-3 space-y-1">
        <h3 className="text-sm font-medium text-coco-black group-hover:text-sky transition-colors line-clamp-2">
          {product.title}
        </h3>
        <p className="text-sm font-semibold text-coco-gray-dark">
          {same ? min : `${min} – ${max}`}
        </p>
      </div>
    </Link>
  );
}
