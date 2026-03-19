import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getCollections } from '@/lib/content';
import PageBanner from '@/components/PageBanner';

export const metadata: Metadata = {
  title: 'All Collections',
  description: 'Browse our full range of luxury foam pool floats, inflatable loungers, pool chairs, and waterproof speakers.',
  alternates: { canonical: 'https://coco-demo-silk.vercel.app/collections' },
};

export default function CollectionsPage() {
  const collections = getCollections().filter(
    c => !c.title.toLowerCase().includes('discontinued')
  );

  return (
    <>
      <PageBanner
        src="/images/hero-4.webp"
        alt="Cococabana pool floats collection"
        title="Epic Luxury Water Floats"
      />

      <div className="max-w-container mx-auto px-4 py-12">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs text-gray-400">
            <li><Link href="/" className="hover:text-black transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-black font-medium">Collections</li>
          </ol>
        </nav>

        <h2 className="sr-only">All Collections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {collections.map(col => (
            <Link
              key={col.handle}
              href={`/collections/${col.handle}`}
              className="group block relative overflow-hidden rounded-sm bg-gray-100"
            >
              <div className="relative aspect-[16/9]">
                {col.featuredImage ? (
                  <Image
                    src={col.featuredImage.localPath}
                    alt={col.featuredImage.alt || col.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-sky/20 to-gray-100" />
                )}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
                <div className="absolute inset-0 flex items-end p-8">
                  <div>
                    <h2 className="font-heading text-white text-xl font-normal mb-2">{col.title}</h2>
                    {col.description && (
                      <p className="text-white/75 text-sm line-clamp-2"
                        dangerouslySetInnerHTML={{ __html: col.description.replace(/<[^>]*>/g, '') }}
                      />
                    )}
                    <span className="mt-3 inline-block text-white text-xs font-semibold tracking-widest uppercase border-b border-white/50">
                      Shop {col.productHandles.length} items →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
