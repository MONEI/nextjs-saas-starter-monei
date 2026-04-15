'use server';

import { redirect } from 'next/navigation';
import {
  createCheckoutPayment,
  cancelSubscription,
  updatePaymentMethod,
  changePlan,
} from './monei';
import { withTeam } from '@/lib/auth/middleware';
import { db } from '@/lib/db/drizzle';
import { users, teams, teamMembers } from '@/lib/db/schema';
import { setSession, hashPassword } from '@/lib/auth/session';
import { getUser, getTeamForUser } from '@/lib/db/queries';
import crypto from 'crypto';

export const checkoutAction = withTeam(async (formData, team) => {
  const planId = formData.get('planId') as string;
  await createCheckoutPayment({ team, planId });
});

export const cancelSubscriptionAction = withTeam(async (_, team) => {
  await cancelSubscription(team.id);
  redirect('/dashboard');
});

export const updatePaymentMethodAction = withTeam(async (_, team) => {
  await updatePaymentMethod({ team });
});

export const changePlanAction = withTeam(async (formData, team) => {
  const planId = formData.get('planId') as string;
  await changePlan({ team, planId });
});

// ─── Guest checkout (demo mode) ─────────────────────────────────────────────
// Creates a guest user + team on the fly, sets session, and redirects
// straight to MONEI checkout. No sign-up form needed.

export async function guestCheckoutAction(formData: FormData) {
  const planId = formData.get('planId') as string;

  // Check if already logged in
  const existingUser = await getUser();
  if (existingUser) {
    const team = await getTeamForUser();
    if (team) {
      await createCheckoutPayment({ team, planId });
      return;
    }
  }

  // Create guest user
  const guestId = crypto.randomBytes(6).toString('hex');
  const guestEmail = `guest_${guestId}@demo.monei.com`;
  const guestPassword = crypto.randomBytes(16).toString('hex');
  const passwordHash = await hashPassword(guestPassword);

  const [user] = await db
    .insert(users)
    .values({
      email: guestEmail,
      name: `Guest ${guestId.slice(0, 6)}`,
      passwordHash,
      role: 'owner',
    })
    .returning();

  // Create team
  const [team] = await db
    .insert(teams)
    .values({
      name: `Demo Team`,
    })
    .returning();

  // Link user to team
  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: 'owner',
  });

  // Set session
  await setSession(user);

  // Go straight to MONEI checkout
  await createCheckoutPayment({ team, planId });
}
