import { redirect } from 'next/navigation';
import { Monei } from '@monei-js/node-sdk';
import { Team } from '@/lib/db/schema';
import {
  getUser,
  updateTeamSubscription,
} from '@/lib/db/queries';

// ─── MONEI SDK client ───────────────────────────────────────────────────────

const MONEI_API_KEY = process.env.MONEI_API_KEY!;
const BASE_URL = process.env.BASE_URL!;

export const monei = new Monei(MONEI_API_KEY);

// ─── Plan configuration (local, no external product catalog) ────────────────

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number; // in cents
  currency: string;
  interval: 'month' | 'year';
  trialDays: number;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'base',
    name: 'Base',
    description: 'Everything you need to get started',
    price: 800,
    currency: 'EUR',
    interval: 'month',
    trialDays: 14,
    features: [
      'Unlimited Usage',
      'Unlimited Workspace Members',
      'Email Support',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    description: 'For growing teams that need more',
    price: 1200,
    currency: 'EUR',
    interval: 'month',
    trialDays: 14,
    features: [
      'Everything in Base, and:',
      'Early Access to New Features',
      '24/7 Support + Slack Access',
    ],
  },
];

export function getPlan(planId: string): Plan | undefined {
  return PLANS.find((p) => p.id === planId);
}

// ─── Create a checkout payment ──────────────────────────────────────────────

export async function createCheckoutPayment({
  team,
  planId,
}: {
  team: Team | null;
  planId: string;
}) {
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&planId=${planId}`);
  }

  const plan = getPlan(planId);
  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  const orderId = `sub_${team.id}_${planId}_${Date.now()}`;

  const payment = await monei.payments.create({
    amount: plan.price,
    currency: plan.currency,
    orderId,
    description: `${plan.name} Plan — ${plan.interval}ly subscription`,
    customer: {
      name: user.name || user.email,
      email: user.email,
    },
    generatePaymentToken: true,
    callbackUrl: `${BASE_URL}/api/monei/webhook`,
    completeUrl: `${BASE_URL}/api/monei/callback?team_id=${team.id}&plan_id=${planId}&user_id=${user.id}`,
    cancelUrl: `${BASE_URL}/pricing`,
    metadata: {
      teamId: team.id.toString(),
      userId: user.id.toString(),
      planId,
    },
  });

  const redirectUrl = payment.nextAction?.redirectUrl;
  if (!redirectUrl) {
    throw new Error('MONEI did not return a redirect URL');
  }

  redirect(redirectUrl);
}

// ─── Charge using saved token (for recurring billing) ───────────────────────

export async function chargeWithToken({
  team,
  plan,
}: {
  team: Team;
  plan: Plan;
}) {
  if (!team.moneiPaymentToken) {
    throw new Error('No payment token saved for this team');
  }

  const orderId = `renewal_${team.id}_${plan.id}_${Date.now()}`;

  return monei.payments.create({
    amount: plan.price,
    currency: plan.currency,
    orderId,
    description: `${plan.name} Plan — recurring charge`,
    paymentToken: team.moneiPaymentToken,
    callbackUrl: `${BASE_URL}/api/monei/webhook`,
    metadata: {
      teamId: team.id.toString(),
      planId: plan.id,
      type: 'recurring',
    },
  });
}

// ─── Get payment details ────────────────────────────────────────────────────

export async function getPayment(paymentId: string) {
  return monei.payments.get(paymentId);
}

// ─── Handle webhook payment status ──────────────────────────────────────────

export async function handlePaymentWebhook(payment: any) {
  const { metadata, status, id: paymentId } = payment;

  if (!metadata?.teamId) {
    console.error('No teamId in payment metadata:', paymentId);
    return;
  }

  const teamId = parseInt(metadata.teamId, 10);
  const planId = metadata.planId;
  const plan = getPlan(planId);

  if (status === 'SUCCEEDED') {
    const paymentToken = payment.paymentToken || null;
    const isUpdatePaymentMethod = metadata.type === 'update_payment_method';

    // ─── Demo mode: auto-refund real payments immediately ───────────
    const isDemoMode = process.env.DEMO_MODE === 'true';
    if (isDemoMode && !isUpdatePaymentMethod && payment.amount > 0) {
      try {
        await monei.payments.refund(paymentId, {
          amount: payment.amount,
          refundReason: 'Demo — automatic refund',
        });
        console.log(`[DEMO] Auto-refunded payment ${paymentId} (€${(payment.amount / 100).toFixed(2)})`);
      } catch (err) {
        console.error(`[DEMO] Auto-refund failed for ${paymentId}:`, err);
      }
    }

    if (isUpdatePaymentMethod) {
      // Only update the token, don't change plan or period
      await updateTeamSubscription(teamId, {
        moneiPaymentId: paymentId,
        moneiPaymentToken: paymentToken,
        planName: plan?.name || null,
        subscriptionStatus: 'active',
      });
      return;
    }

    // Calculate next billing period
    const intervalMs = plan?.interval === 'year'
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

    // New subscriptions get a trial period before first real charge
    const isNewSubscription = metadata.type !== 'recurring' && metadata.type !== 'plan_change';
    const trialEndsAt = isNewSubscription && plan?.trialDays
      ? new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000)
      : null;

    const currentPeriodEnd = trialEndsAt || new Date(Date.now() + intervalMs);

    await updateTeamSubscription(teamId, {
      moneiPaymentId: paymentId,
      moneiPaymentToken: paymentToken,
      planName: plan?.name || planId,
      subscriptionStatus: 'active',
      currentPeriodEnd,
      trialEndsAt,
    });
  } else if (status === 'FAILED' || status === 'CANCELED') {
    await updateTeamSubscription(teamId, {
      moneiPaymentId: paymentId,
      moneiPaymentToken: null,
      planName: null,
      subscriptionStatus: status.toLowerCase(),
    });
  }
}

// ─── Verify MONEI webhook signature (using official SDK) ────────────────────

export function verifyMoneiSignature(payload: string, signature: string): any {
  return monei.verifySignature(payload, signature);
}

// ─── Cancel subscription (clear stored token) ───────────────────────────────

export async function cancelSubscription(teamId: number) {
  await updateTeamSubscription(teamId, {
    moneiPaymentId: null,
    moneiPaymentToken: null,
    planName: null,
    subscriptionStatus: 'canceled',
  });
}

// ─── Update payment method (0-amount VERIF to get a new token) ──────────────

export async function updatePaymentMethod({
  team,
}: {
  team: Team;
}) {
  const user = await getUser();
  if (!team || !user) {
    redirect('/sign-in');
  }

  const orderId = `update_pm_${team.id}_${Date.now()}`;

  const payment = await monei.payments.create({
    amount: 0,
    currency: 'EUR',
    orderId,
    transactionType: 'VERIF',
    description: 'Update payment method',
    generatePaymentToken: true,
    customer: {
      name: user.name || user.email,
      email: user.email,
    },
    callbackUrl: `${BASE_URL}/api/monei/webhook`,
    completeUrl: `${BASE_URL}/api/monei/callback?team_id=${team.id}&plan_id=${team.planName?.toLowerCase() || 'base'}&user_id=${user.id}`,
    cancelUrl: `${BASE_URL}/dashboard`,
    metadata: {
      teamId: team.id.toString(),
      userId: user.id.toString(),
      type: 'update_payment_method',
      planId: team.planName?.toLowerCase() || 'base',
    },
  });

  const redirectUrl = payment.nextAction?.redirectUrl;
  if (!redirectUrl) {
    throw new Error('MONEI did not return a redirect URL');
  }

  redirect(redirectUrl);
}

// ─── Change plan (new payment on different plan) ────────────────────────────

export async function changePlan({
  team,
  planId,
}: {
  team: Team;
  planId: string;
}) {
  const user = await getUser();
  if (!team || !user) {
    redirect('/sign-in');
  }

  const plan = getPlan(planId);
  if (!plan) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  // If we have a stored token, charge it directly for the new plan
  if (team.moneiPaymentToken) {
    const orderId = `change_${team.id}_${planId}_${Date.now()}`;

    await monei.payments.create({
      amount: plan.price,
      currency: plan.currency,
      orderId,
      description: `Plan change to ${plan.name}`,
      paymentToken: team.moneiPaymentToken,
      callbackUrl: `${BASE_URL}/api/monei/webhook`,
      metadata: {
        teamId: team.id.toString(),
        planId: plan.id,
        type: 'plan_change',
      },
    });

    // Optimistically update the plan name
    await updateTeamSubscription(team.id, {
      moneiPaymentId: team.moneiPaymentId,
      moneiPaymentToken: team.moneiPaymentToken,
      planName: plan.name,
      subscriptionStatus: 'active',
    });

    redirect('/dashboard');
  }

  // No token — go through full checkout
  return createCheckoutPayment({ team, planId });
}
