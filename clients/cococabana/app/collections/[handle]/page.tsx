import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getCollections,
  getCollectionByHandle,
  getCollectionProducts,
} from '@/lib/content';
import ProductCard from '@/components/ProductCard';
import PageBanner from '@/components/PageBanner';

interface Props {
  params: { handle: string };
}

export async function generateStaticParams() {
  return getCollections().map(c => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const col = getCollectionByHandle(params.handle);
  if (!col) return {};
  const desc = col.description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const maxDesc = 150;
  const description = desc.length > maxDesc
    ? desc.substring(0, desc.lastIndexOf(' ', maxDesc)) + '.'
    : desc || `Shop ${col.title} — luxury pool floats and accessories from Cococabana.`;

  const maxTitleLen = 60 - ' | Cococabana'.length;
  const shortTitle = col.title.length > maxTitleLen
    ? col.title.substring(0, maxTitleLen - 3) + '...'
    : col.title;

  return {
    title: shortTitle,
    description,
    alternates: { canonical: `https://coco-demo-silk.vercel.app/collections/${params.handle}` },
    openGraph: {
      title: shortTitle,
      images: col.featuredImage ? [{ url: col.featuredImage.localPath }] : [],
    },
  };
}

function CollectionSchema({ col }: { col: ReturnType<typeof getCollectionByHandle> }) {
  if (!col) return null;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: col.title,
    description: col.description.replace(/<[^>]*>/g, ''),
    url: `https://coco-demo-silk.vercel.app/collections/${col.handle}`,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function CollectionPage({ params }: Props) {
  const col = getCollectionByHandle(params.handle);
  if (!col) notFound();

  const products = getCollectionProducts(col);
  const desc = col.description.replace(/<[^>]*>/g, '').trim();

  return (
    <>
      <CollectionSchema col={col} />

      <PageBanner
        src="/images/hero-4.webp"
        alt={col.featuredImage?.alt || col.title}
        title={col.title}
      />

      <div className="max-w-container mx-auto px-4 py-12">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-xs text-gray-400">
            <li><Link href="/" className="hover:text-black transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/collections" className="hover:text-black transition-colors">Collections</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-black font-medium">{col.title}</li>
          </ol>
        </nav>

        {desc && (
          <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-2xl">{desc}</p>
        )}

        <p className="text-xs text-gray-400 uppercase tracking-widest mb-6">
          {products.length} {products.length === 1 ? 'product' : 'products'}
        </p>

        {products.length > 0 ? (
          <>
            <h2 className="sr-only">Products in {col.title}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-4">No products in this collection yet.</p>
            <Link href="/collections" className="btn-primary">Browse All Collections</Link>
          </div>
        )}
      </div>
    </>
  );
}
