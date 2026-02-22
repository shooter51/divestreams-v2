# Creating Stripe Restricted API Keys

Restricted API keys allow you to limit the permissions of your keys, following the principle of least privilege. This is a security best practice for production environments.

## Why Use Restricted Keys?

- **Reduced Risk**: If a key is compromised, the attacker can only do what that key permits
- **Separation of Concerns**: Different services/environments can have keys with only needed permissions
- **Compliance**: Meets security best practices and may be required for compliance certifications
- **Auditability**: Easier to track which key was used for which operations

## Step-by-Step Guide: Create Restricted Keys

### Step 1: Go to Stripe API Keys Page

1. Log in to https://dashboard.stripe.com
2. Click **Developers** in the left sidebar
3. Click **API Keys**
4. Scroll down to the **Restricted Keys** section

### Step 2: Create Server-Side Restricted Key (for Node.js backend)

This key should have permissions for:
- Creating/managing charges and payment intents
- Reading customer and subscription data
- Creating webhooks
- Access to billing and invoices

**Click "Create restricted key"**

Fill in these details:

| Field | Value |
|-------|-------|
| **Key name** | `DiveStreams Backend` |
| **Expires** | Never (or set annual rotation) |

**Permissions to Enable:**

Under **Charges & Payments**:
- ✅ `charge:read`
- ✅ `charge:create`
- ✅ `paymentintent:read`
- ✅ `paymentintent:create`
- ✅ `paymentmethod:read`
- ✅ `paymentmethod:write`

Under **Customers**:
- ✅ `customer:read`
- ✅ `customer:create`
- ✅ `customer:write`

Under **Subscriptions**:
- ✅ `subscription:read`
- ✅ `subscription:create`
- ✅ `subscription:write`

Under **Invoices**:
- ✅ `invoice:read`
- ✅ `invoice:create`
- ✅ `invoice:write`

Under **Billing**:
- ✅ `billingportal:read`

Under **Webhooks**:
- ✅ `webhookendpoint:read`
- ✅ `webhookendpoint:create`
- ✅ `webhookendpoint:write`

Under **Terminal**:
- ✅ `terminalreader:read`
- ✅ `terminalreader:create`
- ✅ `terminalreader:write`
- ✅ `terminal_location:read`
- ✅ `terminal_location:create`

Under **Balance**:
- ✅ `balance:read`

**Click "Create key"**

Copy the key and add to `.env`:
```env
STRIPE_SECRET_KEY=rk_test_YOUR_RESTRICTED_KEY_HERE
```

### Step 3: Create Frontend Restricted Key (for client-side)

This key is for your browser/frontend and should have minimal permissions:
- Only read access to necessary data
- No write permissions
- No sensitive data access

**Click "Create restricted key" again**

Fill in these details:

| Field | Value |
|-------|-------|
| **Key name** | `DiveStreams Frontend` |
| **Expires** | Never |

**Permissions to Enable:**

Under **Charges & Payments**:
- ✅ `paymentintent:read`
- ✅ `paymentintent:create` (for client-side payment processing)

Under **Customers**:
- ✅ `customer:read`

Under **Subscriptions**:
- ✅ `subscription:read`

Under **Billing**:
- ✅ `billingportal:read`

**Leave all other permissions unchecked**

**Click "Create key"**

Copy the key and add to `.env`:
```env
STRIPE_PUBLISHABLE_KEY=rk_test_YOUR_RESTRICTED_FRONTEND_KEY_HERE
```

### Step 4: Update Your .env File

Your `.env` should now look like:

```env
# Backend restricted key (secret)
STRIPE_SECRET_KEY=rk_test_51ABC...

# Frontend restricted key (publishable)
STRIPE_PUBLISHABLE_KEY=rk_test_51DEF...

# Webhook secret (set up after webhook configuration)
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (from products you create)
STRIPE_STARTER_PRICE_MONTHLY=price_...
STRIPE_STARTER_PRICE_YEARLY=price_...
STRIPE_PRO_PRICE_MONTHLY=price_...
STRIPE_PRO_PRICE_YEARLY=price_...
STRIPE_ENTERPRISE_PRICE_MONTHLY=price_...
STRIPE_ENTERPRISE_PRICE_YEARLY=price_...
```

### Step 5: Verify Your Keys Work

Test your restricted keys by running:

```bash
# Verify backend key can read account info
curl https://api.stripe.com/v1/account \
  -u YOUR_RESTRICTED_SECRET_KEY:

# Should return account details
```

If you see account information, your backend key works! ✅

## Key Naming Convention

For your team, use descriptive names:

| Environment | Purpose | Key Prefix |
|------------|---------|-----------|
| Development | Backend operations | `rk_test_[backend]` |
| Development | Frontend operations | `rk_test_[frontend]` |
| Production | Backend operations | `rk_live_[backend]` |
| Production | Frontend operations | `rk_live_[frontend]` |

Example names:
- `DiveStreams Dev Backend`
- `DiveStreams Dev Frontend`
- `DiveStreams Prod Backend`
- `DiveStreams Prod Frontend`

## Rotating Restricted Keys

### When to Rotate:
- ✅ Quarterly (security best practice)
- ✅ If a key is accidentally exposed
- ✅ After employee departure
- ✅ After security audit recommendations

### How to Rotate:

1. **Create a new restricted key** with the same permissions
2. **Update .env** with the new key
3. **Deploy** your application
4. **Wait 24 hours** to ensure all instances are updated
5. **Deactivate the old key** in Stripe Dashboard
   - Click the key → Click "Deactivate"
   - Stripe will show a warning if anything uses it
6. **Monitor logs** for any errors for the next hour

## Troubleshooting Restricted Keys

### Error: "Permission Denied"
- **Cause**: The key doesn't have the required permission
- **Solution**: Add the permission to the restricted key in Stripe Dashboard

### Error: "Invalid API Key"
- **Cause**: Wrong key type or typo
- **Solution**: Copy the key again from Stripe Dashboard and update `.env`

### Key stopped working after rotation
- **Cause**: Old key is still in use somewhere
- **Solution**: Check all deployment targets and restart services

## Security Checklist

- ✅ Using restricted keys instead of standard keys
- ✅ Backend key is kept secret (in .env, not committed to git)
- ✅ Frontend key has minimal permissions (read-only)
- ✅ Different keys for dev/staging/production
- ✅ Key rotation plan documented
- ✅ Key expiration dates set (optional but recommended)
- ✅ Old keys deactivated after rotation
- ✅ Webhook signing secret is strong and secret
- ✅ All secrets are in .env and .gitignore
- ✅ Monitoring alerts set up for failed payments

## Next Steps

1. ✅ Create restricted backend key
2. ✅ Create restricted frontend key
3. ✅ Update `.env` with new keys
4. ✅ Test keys work
5. ✅ Continue with STRIPE_SETUP.md Step 3 (Products & Pricing)

## Resources

- [Stripe Restricted Keys Docs](https://stripe.com/docs/keys#limit-api-key-permissions)
- [API Key Security Best Practices](https://stripe.com/docs/guides/best-practices#api-security)
- [Rotating API Keys Guide](https://stripe.com/docs/keys#rotating-keys)
