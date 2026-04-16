import { verifyMoneiSignature, handlePaymentWebhook } from '@/lib/payments/monei';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('monei-signature');

  // Debug: log raw payload (first 500 chars)
  console.log('[WEBHOOK RAW]', payload.slice(0, 500));
  console.log('[WEBHOOK SIG]', signature?.slice(0, 50));

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing MONEI-Signature header' },
      { status: 400 }
    );
  }

  // Skip SDK verification for now — just parse the JSON directly
  let payment: any;
  try {
    const parsed = JSON.parse(payload);
    // Handle event envelope or direct payment
    payment = parsed.object || parsed;
    console.log('[WEBHOOK PARSED] id:', payment.id, 'status:', payment.status, 'metadata:', JSON.stringify(payment.metadata));
  } catch (err) {
    console.error('Failed to parse webhook payload:', err);
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    await handlePaymentWebhook(payment);
  } catch (err) {
    console.error('Error processing webhook:', err);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
