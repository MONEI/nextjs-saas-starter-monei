import { NextRequest, NextResponse } from 'next/server';
import { getTeamsDueForRenewal } from '@/lib/db/queries';
import { chargeWithToken, getPlan } from '@/lib/payments/monei';

// Vercel Cron: runs daily at 6:00 AM UTC
// Configure in vercel.json: { "crons": [{ "path": "/api/cron/billing", "schedule": "0 6 * * *" }] }

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (or has the correct secret)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // In demo mode, don't run recurring billing (all payments are refunded anyway)
    if (process.env.DEMO_MODE === 'true') {
      return NextResponse.json({ skipped: true, reason: 'Demo mode — billing disabled' });
    }

    const teams = await getTeamsDueForRenewal();

    const results = {
      processed: 0,
      charged: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const team of teams) {
      results.processed++;

      const planId = team.planName?.toLowerCase() || 'base';
      const plan = getPlan(planId);

      if (!plan) {
        results.errors.push(`Team ${team.id}: invalid plan "${planId}"`);
        results.failed++;
        continue;
      }

      try {
        await chargeWithToken({ team, plan });
        results.charged++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Team ${team.id}: ${message}`);
        results.failed++;
      }
    }

    console.log('Billing cron results:', results);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Billing cron failed:', error);
    return NextResponse.json(
      { error: 'Billing cron failed' },
      { status: 500 }
    );
  }
}
