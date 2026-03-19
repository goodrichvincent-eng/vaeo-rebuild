'use client';

export default function NewsletterForm() {
  return (
    <form
      onSubmit={e => e.preventDefault()}
      className="flex flex-col sm:flex-row gap-3"
    >
      <label htmlFor="newsletter-email" className="sr-only">Email address</label>
      <input
        id="newsletter-email"
        type="email"
        placeholder="Your email address"
        required
        className="flex-1 border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors"
      />
      <button
        type="submit"
        className="bg-black text-white px-8 py-3 text-xs font-bold tracking-widest uppercase hover:bg-gray-800 transition-colors whitespace-nowrap"
      >
        Subscribe
      </button>
    </form>
  );
}
