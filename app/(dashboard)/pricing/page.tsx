import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { PLANS, Plan } from '@/lib/payments/monei';
import { SubmitButton } from './submit-button';

export default function PricingPage() {
  const basePlan = PLANS.find((p) => p.id === 'base')!;
  const plusPlan = PLANS.find((p) => p.id === 'plus')!;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid md:grid-cols-2 gap-8 max-w-xl mx-auto">
        <PricingCard plan={basePlan} />
        <PricingCard plan={plusPlan} />
      </div>
    </main>
  );
}

function PricingCard({ plan }: { plan: Plan }) {
  return (
    <div className="pt-6">
      <h2 className="text-2xl font-medium text-gray-900 mb-2">{plan.name}</h2>
      <p className="text-sm text-gray-600 mb-4">
        with {plan.trialDays} day free trial
      </p>
      <p className="text-4xl font-medium text-gray-900 mb-6">
        €{(plan.price / 100).toFixed(0)}{' '}
        <span className="text-xl font-normal text-gray-600">
          per user / {plan.interval}
        </span>
      </p>
      <ul className="space-y-4 mb-8">
        {plan.features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      <form action={checkoutAction}>
        <input type="hidden" name="planId" value={plan.id} />
        <SubmitButton />
      </form>
    </div>
  );
}
