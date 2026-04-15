# nextjs-saas-starter-monei

A Next.js SaaS starter template with **MONEI Payments** — Cards, Bizum, PayPal, Apple Pay, Google Pay & more.

> Forked from [nextjs/saas-starter](https://github.com/nextjs/saas-starter) — Stripe has been fully replaced with [MONEI](https://monei.com), Europe's multi-method payment gateway.

## Features

- Marketing landing page (`/`) with animated Terminal element
- Pricing page (`/pricing`) with locally-configured plans via MONEI hosted checkout
- Dashboard with subscription management portal (change plan, update payment method, cancel)
- Recurring billing via payment tokenization + Vercel Cron
- Trial period support (configurable per plan)
- Basic RBAC with Owner and Member roles
- Email/password authentication with JWTs stored to cookies
- Webhook signature verification via `@monei-js/node-sdk`
- GitHub Actions CI (type check + build on every PR)
- Activity logging system for any user events

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **Database**: [Postgres](https://www.postgresql.org/)
- **ORM**: [Drizzle](https://orm.drizzle.team/)
- **Payments**: [MONEI](https://monei.com/) via [`@monei-js/node-sdk`](https://www.npmjs.com/package/@monei-js/node-sdk)
- **UI Library**: [shadcn/ui](https://ui.shadcn.com/)

## Getting Started

```bash
git clone https://github.com/MONEI/nextjs-saas-starter-monei
cd nextjs-saas-starter-monei
pnpm install
```

## Running Locally

Use the included setup script to create your `.env` file:

```bash
pnpm db:setup
```

You'll need your MONEI API Key and Account ID from the [MONEI Dashboard](https://dashboard.monei.com/settings/api). Use **test mode** keys for development.

Run the database migrations and seed the database with a default user and team:

```bash
pnpm db:migrate
pnpm db:seed
```

This will create the following user and team:

- User: `test@test.com`
- Password: `admin123`

You can also create new users through the `/sign-up` route.

Finally, run the Next.js development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app in action.

## How Payments Work

This template uses MONEI's **hosted payment page** for the initial checkout flow:

1. User selects a plan → backend creates a MONEI payment with `generatePaymentToken: true`
2. User is redirected to MONEI's hosted page to pay (Cards, Bizum, PayPal, etc.)
3. After payment, MONEI redirects back and sends a webhook to confirm the status
4. A `paymentToken` is saved for future recurring charges
5. A Vercel Cron job (`/api/cron/billing`) runs daily and charges teams whose `currentPeriodEnd` has passed

Plans are defined locally in `lib/payments/monei.ts` — no external product catalog required.

### Subscription Management

The dashboard includes a full in-app subscription portal:

- **Update Payment Method** — redirects to MONEI hosted page with `transactionType: VERIF` (zero-amount) to capture a new token
- **Change Plan** — charges the new plan amount using the stored token, or redirects to checkout if no token exists
- **Cancel Subscription** — clears the stored token and sets status to `canceled`

### Trial Periods

Each plan has a configurable `trialDays` value. When a new subscription is created, `trialEndsAt` and `currentPeriodEnd` are set accordingly. The cron job won't charge until the period expires.

## Testing Payments

Use MONEI's [test mode](https://docs.monei.com/testing/) with these test card details:

- Card Number: `4111 1111 1111 1111`
- Expiration: Any future date
- CVC: Any 3-digit number

For Bizum testing, see the [MONEI testing docs](https://docs.monei.com/testing/).

## Going to Production

### Set up a MONEI webhook

1. Go to the [MONEI Dashboard → Settings → Webhooks](https://dashboard.monei.com/settings/webhooks)
2. Add your production callback URL: `https://yourdomain.com/api/monei/webhook`
3. MONEI will send payment status updates to this endpoint

### Deploy to Vercel

1. Push your code to a GitHub repository
2. Connect your repository to [Vercel](https://vercel.com/) and deploy it
3. The Vercel Cron job for recurring billing is configured automatically via `vercel.json`

### Add environment variables

In your Vercel project settings, add:

| Variable | Description |
|---|---|
| `BASE_URL` | Your production domain (e.g., `https://yourdomain.com`) |
| `MONEI_API_KEY` | Your **live** MONEI API key |
| `MONEI_ACCOUNT_ID` | Your MONEI Account ID |
| `POSTGRES_URL` | Your production database URL |
| `AUTH_SECRET` | A random string (`openssl rand -base64 32`) |
| `CRON_SECRET` | A random string to secure the billing cron endpoint |
| `DEMO_MODE` | Set to `true` for live demo with auto-refund (optional) |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `true` to show demo banner in UI (optional) |

## Architecture

```
lib/payments/monei.ts     → MONEI SDK client, plan config, all payment operations
lib/payments/actions.ts   → Server Actions (checkout, cancel, change plan, update PM)
app/api/monei/webhook/    → Webhook handler with signature verification
app/api/monei/callback/   → Post-payment redirect handler
app/api/cron/billing/     → Vercel Cron for recurring charges
lib/db/schema.ts          → Drizzle schema (teams with MONEI fields)
```

## Differences from the Original Stripe Version

| Feature | Original (Stripe) | This Fork (MONEI) |
|---|---|---|
| Checkout | Stripe Checkout Sessions | MONEI Hosted Payment Page |
| Subscriptions | Stripe Subscriptions API | Payment tokenization + cron billing |
| Customer Portal | Stripe Customer Portal | In-app portal (change plan, update payment, cancel) |
| Webhook | `stripe-signature` HMAC | `MONEI-Signature` via `@monei-js/node-sdk` |
| Payment methods | Cards only | Cards, Bizum, PayPal, Apple Pay, Google Pay |
| Currency | USD | EUR (configurable) |
| Products/Prices | Stripe Dashboard | Local config in `lib/payments/monei.ts` |
| Trial periods | Stripe-managed | App-managed with `trialEndsAt` column |
| Recurring billing | Stripe automatic | Vercel Cron + stored payment tokens |
| CI | None | GitHub Actions (type check + build) |

## Demo Mode

To deploy a live demo (like `saas-starter.monei.com`) where visitors can experience the full payment flow without actually being charged:

```env
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
MONEI_API_KEY=pk_live_***   # Use LIVE keys for real payment methods
```

When enabled:
- An orange banner appears at the top: "Live Demo — All payments are automatically refunded"
- Every successful payment is immediately refunded via `monei.payments.refund()`
- The subscription is still activated so the full dashboard experience works
- Recurring billing cron is disabled (no charge-refund loops)
- Visitors can test with real Cards, Bizum, PayPal, Apple Pay, Google Pay

This is powerful for showcasing MONEI's capabilities with real payment method flows.

## License

MIT
