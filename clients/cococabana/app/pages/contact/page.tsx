import type { Metadata } from 'next';
import Link from 'next/link';
import PageBanner from '@/components/PageBanner';
import ContactForm from '@/components/ContactForm';
import { getShop } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the Cococabana team. We\'d love to hear from you.',
  alternates: { canonical: 'https://coco-demo-silk.vercel.app/pages/contact' },
};

export default function ContactPage() {
  const shop = getShop();

  return (
    <>
      <PageBanner
        src="/images/hero-2.webp"
        alt="Cococabana luxury poolside lifestyle"
        title="Contact Us"
      />

      <div className="max-w-container mx-auto px-4 py-12">
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-2 text-xs text-gray-400">
            <li><Link href="/" className="hover:text-black transition-colors">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li className="text-black font-medium">Contact Us</li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl">
          {/* Store info */}
          <div>
            <h2 className="font-heading text-2xl font-normal uppercase tracking-widest mb-6">
              Get in Touch
            </h2>
            <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
              <p>
                Have a question about our products, an order, or just want to say hello?
                We&apos;d love to hear from you.
              </p>
              <div className="pt-2 space-y-2">
                <p className="font-semibold text-black">Cococabana</p>
                <p>{shop.domain}</p>
                <p>
                  <a href="mailto:customerservice@cococabanalife.com" className="hover:text-black transition-colors">
                    customerservice@cococabanalife.com
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <div>
            <h2 className="font-heading text-2xl font-normal uppercase tracking-widest mb-6">
              Send a Message
            </h2>
            <ContactForm />
          </div>
        </div>
      </div>
    </>
  );
}
