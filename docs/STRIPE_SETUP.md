# Stripe Setup — Real Card Payments

The app is fully wired for real Stripe card payments in TEST mode today. It needs
**only the client's live secret key dropped into an env var** to go live — no code
changes required.

Until real keys are set, the app runs in an honest "not configured yet" state:
`POST /api/payments/create-intent` returns `501 {"error": "Stripe not configured for this environment yet"}`,
and the customer-facing `Pay Booking Fee` screen shows *"Card payments aren't enabled
yet — booking fee will be collected another way"* instead of a broken form or a fake
simulated payment.

Note: `.env.example` at the repo root could not be edited directly (blocked by this
environment's secret-file guardrail). The three env var names below are exactly what
would have been added there.

## Env vars to set on LOKI

File: `/opt/htf/barber-app/.env.production` (or wherever the systemd service's
`EnvironmentFile=` points — check `barber-app.service`).

| Variable | Where it's read | Where to get it |
|---|---|---|
| `STRIPE_SECRET_KEY` | `src/server/index.ts` (server only, never sent to the browser) | Stripe Dashboard → Developers → API keys → **Secret key**. Use the **test mode** key first (`sk_test_...`), then the **live mode** key (`sk_live_...`) when ready to go live. |
| `STRIPE_WEBHOOK_SECRET` | `src/server/index.ts` webhook handler, used to verify Stripe's signature | Stripe Dashboard → Developers → Webhooks → (the endpoint below) → **Signing secret** (`whsec_...`). Generated per-endpoint, per-mode (test vs live have different secrets). |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Frontend build (`src/features/customer/PayFee.tsx`), baked in at **build time** via Vite | Stripe Dashboard → Developers → API keys → **Publishable key** (`pk_test_...` / `pk_live_...`). Safe to expose in the browser bundle by design. |

Because `VITE_STRIPE_PUBLISHABLE_KEY` is compiled into the frontend bundle at build
time (not read at runtime), the frontend must be rebuilt (`npm run build`) and
redeployed after setting it — just setting the env var on the server isn't enough
for the publishable key. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are read at
server runtime, so a `systemctl restart barber-app.service` after setting them is
sufficient (no rebuild needed).

## Webhook endpoint to register in Stripe

Stripe Dashboard → Developers → Webhooks → **Add endpoint**:

```
https://barber.safetykat.com/api/payments/webhook
```

Subscribe to at least:
- `payment_intent.succeeded`

This is the only event the handler currently acts on — it marks the matching
booking's `payment_status` as `'paid'` in that booking's tenant database, matched
via the `booking_id` and `tenant_id` metadata set when the PaymentIntent was created.

## Steps once the client provides real keys

1. Set `STRIPE_SECRET_KEY` (test key first) and `VITE_STRIPE_PUBLISHABLE_KEY` on
   `/opt/htf/barber-app/.env.production`.
2. Register the webhook endpoint above in Stripe (test mode), copy its signing
   secret into `STRIPE_WEBHOOK_SECRET`.
3. Rebuild the frontend (`VITE_API_URL=https://barber.safetykat.com npm run build`)
   and redeploy `dist/`, since the publishable key is compile-time.
4. `systemctl restart barber-app.service` to pick up the server-side vars.
5. Run a real test-mode booking + payment end to end, confirm the webhook fires and
   `payment_status` flips to `paid` on the booking row.
6. Only once that's verified working in test mode, swap in the **live** secret key,
   live publishable key, and a live-mode webhook secret (register a second webhook
   endpoint in live mode — test and live are separate).

No code changes are needed for any of the above — every Stripe key is read purely
from environment variables (`process.env.STRIPE_SECRET_KEY`,
`process.env.STRIPE_WEBHOOK_SECRET`, `import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY`).
