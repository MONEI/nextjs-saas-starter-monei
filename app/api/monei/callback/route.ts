import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers } from '@/lib/db/schema';
import { setSession } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';
import { getPlan } from '@/lib/payments/monei';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const teamId = searchParams.get('team_id');
  const planId = searchParams.get('plan_id');
  const userId = searchParams.get('user_id');

  if (!teamId || !planId || !userId) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  try {
    const plan = getPlan(planId);
    if (!plan) {
      throw new Error(`Invalid plan: ${planId}`);
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found in database.');
    }

    // The webhook will handle updating the subscription status with
    // the payment token. Here we just set the session and redirect.
    // If the webhook hasn't arrived yet, we optimistically set the plan.
    await db
      .update(teams)
      .set({
        planName: plan.name,
        subscriptionStatus: 'active',
        updatedAt: new Date(),
      })
      .where(eq(teams.id, Number(teamId)));

    await setSession(user[0]);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling MONEI callback:', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}
