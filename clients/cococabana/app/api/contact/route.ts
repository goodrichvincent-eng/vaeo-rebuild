import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; email?: string; message?: string };
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Log to server console (demo — wire up real email sending here)
    console.log('[Contact form submission]', { name, email, message: message.slice(0, 100) });

    // In a real implementation, send to store email via SendGrid / Resend / etc.
    // const STORE_EMAIL = 'Adamk@Greatimportance.com';
    // await sendEmail({ to: STORE_EMAIL, from: email, subject: `Contact from ${name}`, body: message });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
