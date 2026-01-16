# Stripe POS Card Payments Design

**Date:** 2026-01-16
**Status:** Approved
**Estimated Effort:** 3-4 hours

## Overview

Implement card payment processing in the POS system using each tenant's connected Stripe account. Supports both manual card entry (Stripe Elements) and physical card readers (Stripe Terminal).

## Architecture

### Payment Flow

1. POS loader checks if tenant has Stripe connected via `getStripeSettings(orgId)`
2. If connected, loader fetches `getStripePublishableKey(orgId)` for client-side Stripe.js
3. CardModal receives `stripeConnected` and `publishableKey` props
4. When staff clicks Card payment:
   - If no Stripe: show disabled state with tooltip
   - If Stripe connected: show payment method selector (Manual Entry vs Terminal)

### Manual Entry Flow

1. Load Stripe.js with tenant's publishable key
2. Render Stripe Elements card form in modal
3. On submit: call action with `intent: "create-payment-intent"` to create PaymentIntent server-side
4. Confirm payment client-side with `stripe.confirmCardPayment()`
5. On success: complete checkout with `stripePaymentIntentId` in payment record

### Terminal Flow

1. Initialize Stripe Terminal SDK with tenant's credentials
2. Discover and connect to registered reader
3. Collect payment method from physical card
4. Process payment through Terminal API
5. Complete checkout with payment details

## Files to Modify

- `app/routes/tenant/pos.tsx` - loader adds Stripe status, action handles payment intents
- `app/components/pos/CheckoutModals.tsx` - CardModal with Elements + Terminal
- `lib/integrations/stripe.server.ts` - add POS payment functions
- `app/routes/tenant/settings/integrations.tsx` - Terminal reader registration UI

## Data Flow

### Loader Additions

```typescript
// Add to pos.tsx loader return
stripeConnected: boolean           // true if tenant has active Stripe integration
stripePublishableKey: string | null // for client-side Stripe.js
stripeTerminalLocationId: string | null // for Terminal SDK (if configured)
```

### New Action Intents

```typescript
// intent: "create-payment-intent"
// Input: { amount: number } (in cents)
// Output: { clientSecret: string, paymentIntentId: string }

// intent: "connection-token"
// Output: { secret: string } for Terminal SDK

// intent: "register-terminal-reader"
// Input: { registrationCode: string }
// Output: { readerId: string, label: string }
```

### Payment Record

Add optional field to payment records: `stripePaymentIntentId?: string`

## Server Functions

Add to `lib/integrations/stripe.server.ts`:

```typescript
// Create payment intent for POS transaction
export async function createPOSPaymentIntent(
  orgId: string,
  amount: number, // cents
  metadata?: { customerId?: string; receiptNumber?: string }
): Promise<{ clientSecret: string; paymentIntentId: string } | null>

// Create location for Terminal (once per org)
export async function getOrCreateTerminalLocation(orgId: string)

// Register a reader with registration code
export async function registerTerminalReader(
  orgId: string,
  registrationCode: string,
  label?: string
)

// List registered readers
export async function listTerminalReaders(orgId: string)

// Create connection token for Terminal SDK
export async function createTerminalConnectionToken(orgId: string)
```

## UI Design

### CardModal States

1. **Not Connected** - Stripe not configured
   - Show message: "Connect Stripe in Settings → Integrations to accept card payments"
   - Cancel button only

2. **Payment Method Selection** - Choose how to pay
   - Two large buttons: "Enter Card Manually" / "Use Card Reader"
   - Card Reader button disabled with "(No reader connected)" if no terminal
   - Cancel button

3. **Manual Entry** - Stripe Elements form
   - Total amount display at top
   - Stripe CardElement (single input for card number, expiry, CVC)
   - "Processing..." state with spinner during payment
   - Error display area for declined cards
   - Cancel / Pay buttons

4. **Terminal** - Physical reader flow
   - "Present card on reader" instruction with animation
   - Reader status (connecting, waiting for card, processing)
   - Cancel button to abort

5. **Success** - Payment complete
   - Checkmark animation
   - "Payment approved" message
   - Auto-closes after 1.5s and triggers checkout completion

### Error Handling

- Declined cards: Show Stripe's error message, allow retry
- Network errors: "Connection failed, please try again"
- Terminal disconnected: "Reader disconnected, switch to manual entry?"

## Terminal Setup

Reader registration happens in Settings → Integrations → Stripe section:

- "Card Readers" subsection under Stripe settings
- "Register Reader" button → modal with registration code input
- List of registered readers with status (online/offline)
- Delete reader option

Terminal location auto-created per organization using org name/address.

## Testing Strategy

### Unit Tests

`tests/unit/lib/integrations/stripe-pos.test.ts`:
- `createPOSPaymentIntent` - mocks Stripe API, verifies amount/metadata
- `createTerminalConnectionToken` - verifies token generation
- `registerTerminalReader` - validates registration flow
- Error cases: no Stripe connected, invalid amounts, API failures

### Integration Tests

`tests/integration/routes/tenant/pos.test.ts`:
- `create-payment-intent` returns clientSecret when Stripe connected
- `create-payment-intent` returns error when Stripe not connected
- Loader includes `stripeConnected` and `stripePublishableKey`

### Component Tests

`tests/unit/components/pos/CheckoutModals.test.ts`:
- CardModal renders disabled state when `stripeConnected: false`
- CardModal shows payment method selection when connected
- Manual entry form validation (mocked Stripe Elements)
- Terminal status displays correctly

### Manual Testing

- Use Stripe test keys + test card numbers (4242 4242 4242 4242)
- Test declined card scenario (4000 0000 0000 0002)
- Test Terminal with Stripe's simulated reader

## Implementation Order

1. **Server-side foundation** (~30 min)
   - Add `createPOSPaymentIntent()` to `stripe.server.ts`
   - Add `create-payment-intent` action intent in `pos.tsx`
   - Update loader to include Stripe status

2. **CardModal with Manual Entry** (~1 hour)
   - Refactor CardModal to check `stripeConnected` prop
   - Add Stripe.js loading (dynamic import)
   - Implement CardElement form with payment confirmation
   - Handle success/error states

3. **Terminal support** (~1.5 hours)
   - Add Terminal functions to `stripe.server.ts`
   - Add `connection-token` action for Terminal SDK
   - Implement Terminal UI flow in CardModal
   - Add reader registration to integrations settings

4. **Testing** (~45 min)
   - Unit tests for new server functions
   - Integration tests for new action intents
   - Component tests for CardModal states

5. **Documentation** (~15 min)
   - Update integrations settings for Terminal setup
