# Stripe Restricted Key Permissions Reference

Quick reference for permissions needed for different use cases.

## Backend Key Permissions (Server-Side)

**Use this key in your Node.js backend**

```
✅ ENABLED:

CHARGES & PAYMENTS
├── charge:read
├── charge:create
├── paymentintent:read
├── paymentintent:create
├── paymentmethod:read
└── paymentmethod:write

CUSTOMERS
├── customer:read
├── customer:create
└── customer:write

SUBSCRIPTIONS
├── subscription:read
├── subscription:create
└── subscription:write

INVOICES
├── invoice:read
├── invoice:create
└── invoice:write

BILLING
└── billingportal:read

WEBHOOKS
├── webhookendpoint:read
├── webhookendpoint:create
└── webhookendpoint:write

TERMINAL
├── terminalreader:read
├── terminalreader:create
├── terminalreader:write
└── terminal_location:read/create

BALANCE
└── balance:read

❌ DISABLED:
All other permissions
```

**Environment Variable:**
```env
STRIPE_SECRET_KEY=rk_test_51ABC...xyz
```

---

## Frontend Key Permissions (Client-Side)

**Use this key in your browser/React code**

```
✅ ENABLED:

CHARGES & PAYMENTS
├── paymentintent:read
└── paymentintent:create

CUSTOMERS
└── customer:read

SUBSCRIPTIONS
└── subscription:read

BILLING
└── billingportal:read

❌ DISABLED:
All other permissions
(No write access to sensitive data)
```

**Environment Variable:**
```env
STRIPE_PUBLISHABLE_KEY=rk_test_51DEF...xyz
```

---

## API Operations by Permission

### Payment Processing

| Operation | Backend Key | Frontend Key | Permission |
|-----------|-------------|--------------|------------|
| Create PaymentIntent | ✅ | ❌ | `paymentintent:create` |
| Confirm PaymentIntent | ❌ | ✅ | `paymentintent:create` |
| Read PaymentIntent | ✅ | ✅ | `paymentintent:read` |
| Create Charge | ✅ | ❌ | `charge:create` |
| List Charges | ✅ | ❌ | `charge:read` |

### Customer Management

| Operation | Backend Key | Frontend Key | Permission |
|-----------|-------------|--------------|------------|
| Create Customer | ✅ | ❌ | `customer:create` |
| Update Customer | ✅ | ❌ | `customer:write` |
| List Customers | ✅ | ❌ | `customer:read` |
| Get Customer | ✅ | ✅ | `customer:read` |

### Subscription Management

| Operation | Backend Key | Frontend Key | Permission |
|-----------|-------------|--------------|------------|
| Create Subscription | ✅ | ❌ | `subscription:create` |
| Update Subscription | ✅ | ❌ | `subscription:write` |
| Cancel Subscription | ✅ | ❌ | `subscription:write` |
| List Subscriptions | ✅ | ❌ | `subscription:read` |
| Get Subscription | ✅ | ✅ | `subscription:read` |

### Billing Portal

| Operation | Backend Key | Frontend Key | Permission |
|-----------|-------------|--------------|------------|
| Create Portal Session | ✅ | ❌ | `billingportal:read` |
| Access Portal (Client) | ❌ | ✅ | `billingportal:read` |

### Webhooks

| Operation | Backend Key | Permission |
|-----------|-------------|------------|
| Create Webhook Endpoint | ✅ | `webhookendpoint:create` |
| Update Webhook Endpoint | ✅ | `webhookendpoint:write` |
| List Webhooks | ✅ | `webhookendpoint:read` |
| Delete Webhook | ✅ | `webhookendpoint:write` |

### Terminal/POS

| Operation | Backend Key | Permission |
|-----------|-------------|------------|
| Register Reader | ✅ | `terminalreader:create` |
| List Readers | ✅ | `terminalreader:read` |
| Delete Reader | ✅ | `terminalreader:write` |
| Create Location | ✅ | `terminal_location:create` |
| Get Location | ✅ | `terminal_location:read` |

### Balance & Account

| Operation | Backend Key | Permission |
|-----------|-------------|------------|
| Get Account Balance | ✅ | `balance:read` |
| Get Account Info | ✅ | (No specific permission, always allowed) |

---

## Adding Additional Permissions

If you need to add a permission to an existing restricted key:

1. Go to https://dashboard.stripe.com/developers/api-keys
2. Find your restricted key in the **Restricted Keys** section
3. Click the key name
4. Scroll to **Permissions**
5. Check the box for the permission you need
6. Click **Save changes**
7. The key will continue working with the new permission

---

## Permission Categories

### Safe for Frontend
- `paymentintent:read` - Read payment status
- `paymentintent:create` - Create payments
- `customer:read` - Read own customer data
- `subscription:read` - Read subscription status
- `billingportal:read` - Access billing portal

### Backend Only (Sensitive)
- `charge:create` - Direct charge creation
- `customer:create/write` - Modify customer data
- `subscription:create/write` - Modify subscriptions
- `invoice:create/write` - Create/modify invoices
- `webhookendpoint:*` - Manage webhooks
- `terminalreader:*` - Manage hardware
- `balance:read` - View account balance

---

## Common Issues & Solutions

### "Permission denied" Error

**Problem**: Your key doesn't have the permission for the operation

**Solution**:
1. Check which permission you need from the table above
2. Go to your restricted key in Stripe Dashboard
3. Enable that permission
4. Save changes
5. Retry the operation

### Key stopped working after adding permission

**Problem**: Application cache or node_modules issue

**Solution**:
```bash
# Clear any caches
npm cache clean --force

# Restart dev server
npm run dev
```

### Frontend key can't create payments

**Problem**: Probably using backend key by mistake

**Solution**:
1. Verify you're using `STRIPE_PUBLISHABLE_KEY` in frontend code
2. Check it starts with `pk_` or `rk_test_`
3. Ensure it has `paymentintent:create` permission

---

## Security Best Practices

1. **Separate Keys**: Always use different keys for backend and frontend
2. **Minimal Permissions**: Only enable permissions you actually use
3. **Rotate Regularly**: Change keys quarterly or after exposure
4. **Monitor Usage**: Check Stripe Dashboard for unusual activity
5. **Audit Logs**: Enable audit logs in Stripe for compliance
6. **Environment Specific**: Use different keys for dev/staging/prod

