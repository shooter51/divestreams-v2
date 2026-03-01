# Stripe Configuration Checklist

Use this checklist to track your Stripe setup progress.

## Prerequisites
- [ ] Stripe account created at stripe.com
- [ ] Identity verification completed
- [ ] Account in Test Mode (ready to develop)

## Environment Setup
- [ ] Retrieved Secret Key (sk_test_...) from Stripe Dashboard
- [ ] Retrieved Publishable Key (pk_test_...) from Stripe Dashboard
- [ ] Updated `.env` file with `STRIPE_SECRET_KEY`
- [ ] Verified `.env` is in `.gitignore`
- [ ] Restarted dev server

## Products & Pricing
- [ ] Created "Starter" product in Stripe
- [ ] Created "Pro" product in Stripe
- [ ] Created "Enterprise" product in Stripe
- [ ] Created monthly price for Starter → Added to `.env`
- [ ] Created yearly price for Starter → Added to `.env`
- [ ] Created monthly price for Pro → Added to `.env`
- [ ] Created yearly price for Pro → Added to `.env`
- [ ] Created monthly price for Enterprise → Added to `.env`
- [ ] Created yearly price for Enterprise → Added to `.env`

Environment variables filled:
```env
STRIPE_STARTER_PRICE_MONTHLY=price_...
STRIPE_STARTER_PRICE_YEARLY=price_...
STRIPE_PRO_PRICE_MONTHLY=price_...
STRIPE_PRO_PRICE_YEARLY=price_...
STRIPE_ENTERPRISE_PRICE_MONTHLY=price_...
STRIPE_ENTERPRISE_PRICE_YEARLY=price_...
```

## Database Setup
- [ ] Ran `npm run db:generate`
- [ ] Ran `npm run db:migrate`
- [ ] Ran `npm run db:seed`
- [ ] Verified Stripe tables created: `stripe_*`
- [ ] Verified subscription plans populated

## Webhooks
- [ ] Installed Stripe CLI (https://stripe.com/docs/stripe-cli)
- [ ] Authenticated with `stripe login`
- [ ] Set up webhook endpoint URL in Stripe Dashboard
- [ ] Selected webhook events (see STRIPE_SETUP.md for list)
- [ ] Retrieved webhook signing secret (whsec_...)
- [ ] Added `STRIPE_WEBHOOK_SECRET` to `.env`
- [ ] Tested webhook forwarding: `stripe listen --forward-to localhost:5173/api/webhooks/stripe`

## Testing
- [ ] Started dev server: `npm run dev`
- [ ] Visited billing page: http://localhost:5173/billing
- [ ] Tested checkout with test card: 4242 4242 4242 4242
- [ ] Verified subscription created in database
- [ ] Verified webhook events received
- [ ] Tested billing portal redirect
- [ ] Verified subscription status queries work

## Optional: Stripe Terminal
- [ ] Purchased or registered readers in Stripe Dashboard
- [ ] Tested Terminal reader registration
- [ ] Implemented Terminal UI components if needed

## Pre-Production
- [ ] Code review of Stripe integration complete
- [ ] All tests passing: `npm run test`
- [ ] Webhook error handling tested
- [ ] Database migration tested on staging
- [ ] Email notifications tested (payment confirmations)

## Production Setup
- [ ] Created live Stripe account (or enabled live mode)
- [ ] Generated live API keys
- [ ] Created live products and prices
- [ ] Updated `.env.production` with live keys
- [ ] Deployed application
- [ ] Verified webhook endpoint is publicly accessible
- [ ] Created webhook endpoint in live Stripe account
- [ ] Tested live payment with $1 transaction
- [ ] Monitored logs for any errors
- [ ] Verified payments appear in Stripe Dashboard

## Post-Launch
- [ ] Monitor Stripe Dashboard for disputes/chargebacks
- [ ] Set up email alerts in Stripe Dashboard
- [ ] Review webhook delivery logs weekly
- [ ] Implement monitoring/alerting for payment failures
- [ ] Regular backups of customer/subscription data
- [ ] Document any custom modifications to Stripe flows

## Key Contacts & Resources
- Stripe Support: https://support.stripe.com
- Your Stripe Account: https://dashboard.stripe.com
- Stripe Documentation: https://stripe.com/docs

## Notes
```
[Add any specific notes or configurations below]




```
