'use server';

import { redirect } from 'next/navigation';
import {
  createCheckoutPayment,
  cancelSubscription,
  updatePaymentMethod,
  changePlan,
} from './monei';
import { withTeam } from '@/lib/auth/middleware';

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
