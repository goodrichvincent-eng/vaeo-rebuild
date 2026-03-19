import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProducts, getProductByHandle, formatPrice, getProductPriceRange } from '@/lib/content';
import { getReviewsByHandle } from '@/lib/reviews';
import ProductGallery from '@/components/ProductGallery';
import AddToCartButton from '@/components/AddToCartButton';
import ProductReviews from '@/components/ProductReviews';
import PageBanner from '@/components/PageBanner';

interface Props {
  params: { handle: string };
}

export async function generateStaticParams() {
  return getProducts().map(p => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = getProductByHandle(params.handle);
  if (!product) return {};

  // Strip HTML, collapse whitespace, truncate at 150 chars on word boundary
  const plain = product.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const maxDesc = 150;
  const description = plain.length > maxDesc
    ? plain.substring(0, plain.lastIndexOf(' ', maxDesc)) + '.'
    : plain || `Shop ${product.title} at Cococabana. Premium luxury pool floats with free shipping over $50.`;

  // Truncate title to fit "title | Cococabana" under 60 chars total
  const maxTitleLen = 60 - ' | Cococabana'.length; // 47 chars for product name
  const shortTitle = product.title.length > maxTitleLen
    ? product.title.substring(0, maxTitleLen - 3) + '...'
    : product.title;

  return {
    title: shortTitle,
    description,
    alternates: { canonical: `https://coco-demo-silk.vercel.app/products/${params.handle}` },
    openGraph: {
      title: shortTitle,
      description,
      images: product.featuredImage ? [{ url: `https://coco-demo-silk.vercel.app${product.featuredImage.localPath}`, alt: product.featuredImage.alt }] : [],
    },
  };
}

function ProductSchema({
  product,
  reviews,
}: {
  product: ReturnType<typeof getProductByHandle>;
  reviews: ReturnType<typeof getReviewsByHandle>;
}) {
  if (!product) return null;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description.replace(/<[^>]*>/g, ''),
    brand: { '@type': 'Brand', name: product.vendor || 'Cococabana' },
    image: product.images.map(img => `https://coco-demo-silk.vercel.app${img.localPath}`),
    offers: product.variants.map(v => ({
      '@type': 'Offer',
      price: v.price,
      priceCurrency: 'USD',
      availability: v.available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      sku: v.sku,
    })),
    ...(reviews && reviews.reviewCount > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: reviews.averageRating,
        reviewCount: reviews.reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    } : {}),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function ProductPage({ params }: Props) {
  const product = getProductByHandle(params.handle);
  if (!product) notFound();

  const { min, max, same } = getProductPriceRange(product);
  const hasOptions   = product.options.some(o => o.values.length > 1);
  const firstVariant = product.variants[0];
  const compareAt    = firstVariant?.compareAtPrice;
  const reviews      = getReviewsByHandle(product.handle);

  return (
    <>
      <ProductSchema product={product} reviews={reviews} />

      <PageBanner
        src="/images/hero-4.webp"
        alt="Cococabana luxury pool floats"
        title={product.title}
        headingLevel="p"
      />

      <div className="max-w-container mx-auto px-4 py-10">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            <li><Link href="/" className="hover:text-black transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/collections" className="hover:text-black transition-colors">Collections</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-black font-medium line-clamp-1">{product.title}</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

          {/* Gallery */}
          <ProductGallery images={product.images} title={product.title} />

          {/* Product info */}
          <div className="flex flex-col gap-6">
            {product.vendor && (
              <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">
                {product.vendor}
              </p>
            )}
            <h1 className="font-heading text-2xl md:text-3xl font-normal leading-tight">
              {product.title.length > 70 ? product.title.substring(0, 67) + '...' : product.title}
            </h1>

            {/* Reviews badge */}
            {reviews && reviews.reviewCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-flex">
                  {[1,2,3,4,5].map(i => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24"
                      fill={i <= Math.round(reviews.averageRating) ? '#000' : 'none'}
                      stroke="#000" strokeWidth="1.5">
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
                    </svg>
                  ))}
                </span>
                <span className="text-xs text-gray-500">{reviews.reviewCount.toLocaleString()} reviews</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold">
                {same ? min : `${min} – ${max}`}
              </span>
              {compareAt && parseFloat(compareAt) > parseFloat(firstVariant.price) && (
                <span className="text-base text-gray-400 line-through">{formatPrice(compareAt)}</span>
              )}
            </div>

            {/* Variants */}
            {hasOptions && (
              <div className="space-y-4">
                {product.options.map(opt => (
                  <div key={opt.name}>
                    <p className="text-sm font-semibold mb-2 uppercase tracking-wide">{opt.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {opt.values.map(val => (
                        <span key={val} className="border border-gray-200 px-3 py-1.5 text-sm hover:border-black cursor-pointer transition-colors">
                          {val}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add to Cart */}
            <AddToCartButton
              variantId={firstVariant?.id ? `gid://shopify/ProductVariant/${firstVariant.id}` : ''}
              available={firstVariant?.available ?? false}
            />

            {/* Tags */}
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {product.tags.map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{tag}</span>
                ))}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="border-t border-gray-100 pt-6">
                <h2 className="font-heading text-sm font-normal uppercase tracking-widest mb-3">Description</h2>
                <div
                  className="prose prose-sm max-w-none text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-1"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Reviews section */}
        <ProductReviews data={reviews} />
      </div>
    </>
  );
}
