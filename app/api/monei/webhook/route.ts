import { verifyMoneiSignature, handlePaymentWebhook } from '@/lib/payments/monei';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('monei-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing MONEI-Signature header' },
      { status: 400 }
    );
  }

  let verified: any;

  try {
    verified = verifyMoneiSignature(payload, signature);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 401 }
    );
  }

  // Dashboard webhooks wrap the payment in { type, object }
  // callbackUrl webhooks send the payment directly
  const payment = verified.object || verified;

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
