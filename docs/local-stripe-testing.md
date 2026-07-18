# Testing the Stripe trial flow on your own machine

This guide lets you run the **full trial → checkout → "Trial active"** loop locally,
in **test mode** (fake cards, no real money — ever), and *watch* each step happen.

You don't need to understand the code. Follow the steps in order.

---

## Why a "forwarder" is needed (30-second version)

When someone subscribes, Stripe sends your app a little "it happened" message called
a **webhook** (e.g. *"a checkout completed"*, *"a subscription started"*). In
production Stripe delivers these over the internet to `majorcycle.com`. But your
laptop has no public address, so Stripe can't reach it directly.

The **Stripe CLI forwarder** solves this: it holds an open line to Stripe and relays
every webhook to your local dev server. Without it running, you can complete a
checkout but your local app never hears back — so it never flips you to "Trial
active." **The forwarder is the missing link that makes local testing work.**

> **The gotcha it avoids:** the Stripe CLI can be logged in to a *different* Stripe
> account than the app uses. If they disagree, the forwarder watches the wrong
> account and **no webhook ever arrives** — a silent, baffling failure. Our
> `pnpm stripe:listen` helper reads the app's own key from `web/.env.local` and
> forces the forwarder onto the **right account** (the sandbox). You never have to
> think about it.

---

## One-time check (already done for you)

- **Stripe CLI installed?** Run `stripe version` — you should see a version number.
  (If not: install from https://stripe.com/docs/stripe-cli, then re-run.)
- **Signing secret matches?** Already verified ✓ — `web/.env.local`'s
  `STRIPE_WEBHOOK_SECRET` matches what the forwarder uses. Nothing to do.

---

## The test loop

You'll use **two terminals**, both opened in the `web/` folder.

### Terminal 1 — the app

```
pnpm dev
```

Wait for `Ready`. The app is now at http://localhost:3000.

### Terminal 2 — the forwarder

```
pnpm stripe:listen
```

You should see:

```
▶ Forwarding webhooks for: MajorCycle sandbox (acct_1TrdbFGc5r0QcK9U)
  → localhost:3000/api/stripe/webhook
  Test mode — safe. Press Ctrl+C to stop.
...
Ready! ... Your webhook signing secret is whsec_… (^C to quit)
```

Seeing **"MajorCycle sandbox"** confirms it's on the right (test) account. Leave this
terminal running — it prints a line every time a webhook arrives.

> If the `whsec_…` it prints ever **differs** from `STRIPE_WEBHOOK_SECRET` in
> `web/.env.local` (it currently matches), paste the new value into that file and
> restart Terminal 1. This is the only manual step that can ever be needed.

### Do the checkout

1. Open http://localhost:3000 and **sign in with a test account** — *not* your main
   account, so you don't leave a test subscription on your real profile. (Any
   throwaway account works; create one at `/signup` if needed.)
2. Go to **Account** → click **Start free trial** → pick Monthly or Annual →
   **Start 7-day free trial**. This sends you to Stripe's checkout page.
3. Fill it in with a **test card** (these only exist in test mode):
   - Card number: `4242 4242 4242 4242`
   - Expiry: any future date, e.g. `12 / 34`
   - CVC: any 3 digits, e.g. `123`
   - Name / postcode: anything
   - If a "Save my info / Link" box asks for a phone number, just **untick it**.
4. Submit. Stripe processes the (fake) card and sends you back to your **Account**.

### Watch it work

- **Terminal 2** prints lines like:
  ```
  checkout.session.completed  → [200]
  customer.subscription.created  → [200]
  customer.subscription.updated  → [200]
  ```
  `[200]` means your app received and accepted the webhook. (A `[400]` would mean the
  signing secret is wrong — see the note above.)
- **The Account page** now shows the **"Trial active"** badge with your trial end
  date. 🎉 That's the whole loop working end to end.

---

## Resetting between tests

Because the test account now has a (sandbox) subscription, the "Start free trial"
button becomes "Manage billing." To run the loop again cleanly, either:

- Use a different test account, **or**
- Cancel + clear it in the **sandbox** Stripe dashboard (test mode), which sends a
  `customer.subscription.deleted` webhook that resets the profile, **or**
- Ask me to reset the test account's `subscription_status` in Supabase.

Nothing here ever touches live customers or real money — it's all the sandbox.

---

## Firing events without a full checkout (optional)

To check the endpoint is alive without going through the UI:

```
stripe trigger checkout.session.completed
```

This sends a *synthetic* event. Useful to confirm the forwarder → app link returns
`[200]`, but note it has **no real user attached**, so it won't flip any account to
"Trial active." Only a real checkout (above) does the full loop.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Terminal 2 shows a different account name (not "MajorCycle sandbox") | App key changed | Check `STRIPE_SECRET_KEY` in `web/.env.local` is the sandbox `sk_test_…` |
| Webhooks show `[400]` | Signing secret mismatch | Copy the `whsec_…` from Terminal 2 into `STRIPE_WEBHOOK_SECRET`, restart `pnpm dev` |
| No webhook lines appear after checkout | Forwarder not running, or app on a different port | Ensure Terminal 2 is running; if `pnpm dev` used a port other than 3000, run `PORT=3001 pnpm stripe:listen` (match the port) |
| `stripe: command not found` | CLI not installed | Install the Stripe CLI, then `stripe version` |
| Checkout page stuck on "Processing" | Link asked for a phone number | Untick "Save my info" and resubmit |

---

*Test cards reference: https://stripe.com/docs/testing — `4242…` succeeds; other
numbers simulate declines, 3-D Secure, etc.*
