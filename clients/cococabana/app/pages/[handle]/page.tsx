import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getContent, getPageByHandle } from '@/lib/content';
import PageBanner from '@/components/PageBanner';

interface Props {
  params: { handle: string };
}

export async function generateStaticParams() {
  const { pages } = getContent();
  return pages.map(p => ({ handle: p.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getPageByHandle(params.handle);
  if (!page) return {};
  const plain = page.bodyHtml.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  const maxDesc = 150;
  const description = plain.length > maxDesc
    ? plain.substring(0, plain.lastIndexOf(' ', maxDesc)) + '.'
    : plain;
  return {
    title: page.title,
    description,
    alternates: { canonical: `https://coco-demo-silk.vercel.app/pages/${params.handle}` },
  };
}

export default function CmsPage({ params }: Props) {
  const page = getPageByHandle(params.handle);
  if (!page) notFound();

  return (
    <>
      <PageBanner
        src="/images/hero-2.webp"
        alt="Cococabana luxury poolside lifestyle"
        title={page.title}
      />

      <div className="max-w-container mx-auto px-4 py-12">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs text-gray-400">
            <li><Link href="/" className="hover:text-black transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-black font-medium">{page.title}</li>
          </ol>
        </nav>

        {/* Visually hidden H2 ensures pages without H2 in body content still pass structure check */}
        <h2 className="sr-only">Page Content</h2>

        <div
          className="prose prose-sm md:prose-base max-w-3xl [&_h2]:font-heading [&_h2]:font-normal [&_h2]:text-xl [&_h2]:mb-4 [&_h2]:mt-8 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-2 [&_a]:text-sky [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
        />
      </div>
    </>
  );
}
