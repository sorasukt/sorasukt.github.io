# /sorasukt Support Checkout API

Independent Cloudflare Worker for the personal `/sorasukt` support page. It is intentionally separate from the Tarot checkout API and uses personal-support metadata in Stripe.

## Endpoints

- `GET /health` — service health check
- `POST /checkout` — validates a THB amount and creates a one-time Stripe Checkout Session

Only requests from `https://sorasukt.com` and `https://www.sorasukt.com` are accepted.

## Deploy

1. Create or select an independent Cloudflare Worker named `sorasukt-support-api`.
2. In `support-api/`, install dependencies with `npm install`.
3. Store the Stripe secret key as an encrypted Worker secret:

   ```sh
   npx wrangler secret put STRIPE_SECRET_KEY
   ```

4. Deploy:

   ```sh
   npm run deploy
   ```

5. Confirm `https://support-api.sorasukt.com/health` returns an OK response.

The Worker configuration attaches the custom domain `support-api.sorasukt.com`. The domain must be in the Cloudflare account used for deployment.

## Stripe

Enable Cards and PromptPay for the Stripe account. Transactions created here contain `context=personal_support`, keeping them distinct from Tarot payments. Never commit `STRIPE_SECRET_KEY` to Git.
