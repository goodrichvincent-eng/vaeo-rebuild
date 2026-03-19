'use client';

import { useState } from 'react';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactForm() {
  const [state, setState] = useState<FormState>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState('submitting');
    setError('');

    const form = e.currentTarget;
    const data = {
      name:    (form.elements.namedItem('name')    as HTMLInputElement).value,
      email:   (form.elements.namedItem('email')   as HTMLInputElement).value,
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value,
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setState('success');
      form.reset();
    } catch {
      setError('Something went wrong. Please try again.');
      setState('error');
    }
  }

  const inputCls = 'w-full border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:border-black transition-colors font-sans';

  if (state === 'success') {
    return (
      <div className="border border-gray-200 p-6 text-center">
        <p className="font-heading text-lg font-normal mb-2">Thank you!</p>
        <p className="text-sm text-gray-500">We&apos;ve received your message and will be in touch soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="contact-name" className="block text-xs font-semibold uppercase tracking-widest mb-1">
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          placeholder="Your name"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="block text-xs font-semibold uppercase tracking-widest mb-1">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="block text-xs font-semibold uppercase tracking-widest mb-1">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          placeholder="How can we help you?"
          className={`${inputCls} resize-none`}
        />
      </div>

      {state === 'error' && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="w-full bg-black text-white py-3 text-xs font-bold tracking-widest uppercase hover:bg-gray-800 transition-colors disabled:opacity-60"
      >
        {state === 'submitting' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
