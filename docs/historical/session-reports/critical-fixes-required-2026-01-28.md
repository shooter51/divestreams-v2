# Critical Fixes Required - 2026-01-28

## 🚨 URGENT: Deployment Verification Issue

**Problem:** All 13 bugs marked "Fixed in staging" on 2026-01-27 are still failing QA testing.

**Root Cause:** Latest staging deployment (f2fdeeb) shows **1 failure** in CI/CD logs. The B2 secrets injection may have failed.

**Action Required:**
```bash
# Check staging deployment status
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose logs app | tail -100"

# Verify B2 credentials exist
ssh root@76.13.28.28 "cd /docker/divestreams-staging && grep B2_ .env"

# Check migration logs
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose logs worker | grep migration"

# Restart containers to ensure migrations run
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose restart"
```

---

## Priority 1: B2 Storage Failures (KAN-608, KAN-609)

### Files to Fix:

**1. Check environment variable injection:**
```yaml
# .github/workflows/staging.yml
# Verify B2 secrets are being written to .env file on VPS
```

**2. Verify B2 client initialization:**
```typescript
// app/lib/storage/b2.server.ts
if (!process.env.B2_APPLICATION_KEY_ID || !process.env.B2_APPLICATION_KEY) {
  console.error('❌ B2 credentials missing!');
  console.error('B2_APPLICATION_KEY_ID:', !!process.env.B2_APPLICATION_KEY_ID);
  console.error('B2_APPLICATION_KEY:', !!process.env.B2_APPLICATION_KEY);
  throw new Error('B2 storage not configured');
}
```

**3. Add startup health check:**
```typescript
// app/entry.server.tsx (or app.ts)
async function verifyB2Connection() {
  try {
    const b2 = await getB2Client();
    await b2.authorize();
    console.log('✅ B2 storage connected');
  } catch (error) {
    console.error('❌ B2 storage connection failed:', error);
  }
}

// Call during app initialization
if (process.env.NODE_ENV === 'production') {
  verifyB2Connection();
}
```

---

## Priority 2: Email Not Sending (KAN-592)

### Root Cause:
SMTP credentials may not be in **worker** container (emails are sent via BullMQ background jobs).

### Fix:

**1. Verify worker container has SMTP credentials:**
```bash
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose exec worker env | grep SMTP"
```

**2. Check email queue status:**
```bash
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose exec redis redis-cli LLEN bull:email:waiting"
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose exec redis redis-cli LLEN bull:email:failed"
```

**3. Check worker logs for email errors:**
```bash
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose logs worker | grep -i 'email\|smtp'"
```

**4. Fix soft delete issue:**
```typescript
// app/routes/auth/signup.tsx
const existingTenant = await db.query.tenants.findFirst({
  where: and(
    eq(tenants.ownerEmail, email),
    or(
      isNull(tenants.deletedAt),
      // Only consider as existing if deleted less than 30 days ago
      gt(tenants.deletedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    )
  )
});
```

---

## Priority 3: Subscription Access Control (KAN-594)

### Verification Script:
```sql
-- Run on staging database
SELECT
  o.subdomain,
  o.ownerEmail,
  s.plan AS legacy_plan,
  s.planId,
  sp.name AS actual_plan,
  sp.features
FROM public.tenants o
JOIN public.subscriptions s ON s.organizationId = o.id
LEFT JOIN public.subscription_plans sp ON sp.id = s.planId
WHERE o.ownerEmail = 'kkudo311@gmail.com';
```

### Expected Result:
```
subdomain | ownerEmail         | legacy_plan | planId | actual_plan | features
----------|-------------------|-------------|--------|-------------|------------------
kkudo311  | kkudo311@gmail.com | Enterprise  | 3      | Enterprise  | {"integrations"}
```

### If planId is NULL:
```typescript
// Run migration manually or fix subscription update
await db.update(subscription)
  .set({
    planId: (await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.name, 'Enterprise')
    }))?.id
  })
  .where(eq(subscription.organizationId, tenantId));
```

### Check tenant context loader:
```typescript
// app/lib/auth/tenant-context.server.ts
export async function getTenantContext(subdomain: string) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.subdomain, subdomain),
    with: {
      subscription: {
        with: {
          plan: true // Make sure this JOIN is happening!
        }
      }
    }
  });

  console.log('🔍 Tenant context:', {
    subdomain,
    planId: tenant?.subscription?.planId,
    planName: tenant?.subscription?.plan?.name,
    features: tenant?.subscription?.plan?.features
  });

  return tenant;
}
```

---

## Priority 4: Form Data Preservation (KAN-611)

### File to Fix:
**app/routes/auth/login.tsx**

### Current (broken):
```typescript
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email) {
    return json({ error: "Email required" }, { status: 400 });
  }
  // ... validation errors returned WITHOUT email/password values
};
```

### Fixed (preserve form data):
```typescript
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const errors: Record<string, string> = {};

  if (!email) {
    errors.email = "Email is required";
  }
  if (!password) {
    errors.password = "Password is required";
  }

  if (Object.keys(errors).length > 0) {
    return json(
      {
        errors,
        values: { email } // Return form values (NOT password for security)
      },
      { status: 400 }
    );
  }

  // ... rest of logic
};
```

### Update component:
```typescript
export default function Login() {
  const actionData = useActionData<typeof action>();

  return (
    <form method="post">
      <input
        name="email"
        type="email"
        defaultValue={actionData?.values?.email || ''} // Preserve value
      />
      {actionData?.errors?.email && <p>{actionData.errors.email}</p>}

      <input
        name="password"
        type="password"
        // Never preserve password for security
      />
      {actionData?.errors?.password && <p>{actionData.errors.password}</p>}
    </form>
  );
}
```

---

## Priority 5: Tour Image Duplication (KAN-614)

### File to Fix:
**app/routes/tenant/tours/$id/duplicate.tsx** (or wherever duplication logic is)

### Current (broken - images not copied):
```typescript
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const sourceId = params.id!;
  const formData = await request.formData();
  const newName = formData.get("name") as string;

  const sourceTour = await db.query.tours.findFirst({
    where: eq(tours.id, parseInt(sourceId))
  });

  const [newTour] = await db.insert(tours).values({
    ...sourceTour,
    name: newName,
    createdAt: new Date()
  }).returning();

  // ❌ Images NOT copied!

  return redirect(`/tenant/tours/${newTour.id}`);
};
```

### Fixed (copy images):
```typescript
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const sourceId = parseInt(params.id!);
  const formData = await request.formData();
  const newName = formData.get("name") as string;

  const sourceTour = await db.query.tours.findFirst({
    where: eq(tours.id, sourceId),
    with: {
      images: true // Include images in query
    }
  });

  if (!sourceTour) {
    throw new Response("Tour not found", { status: 404 });
  }

  // Create new tour
  const [newTour] = await db.insert(tours).values({
    organizationId: sourceTour.organizationId,
    name: newName,
    description: sourceTour.description,
    price: sourceTour.price,
    duration: sourceTour.duration,
    maxParticipants: sourceTour.maxParticipants,
    // ... other fields
    createdAt: new Date()
  }).returning();

  // ✅ Copy images
  if (sourceTour.images && sourceTour.images.length > 0) {
    await db.insert(tourImages).values(
      sourceTour.images.map((image, index) => ({
        tourId: newTour.id,
        imageUrl: image.imageUrl, // Same B2 URL (read-only reference)
        caption: image.caption,
        displayOrder: index + 1,
        createdAt: new Date()
      }))
    );
  }

  return redirect(`/tenant/tours/${newTour.id}`);
};
```

---

## Priority 6: Validation Improvements

### KAN-622: Discount Code Validation
**File:** `app/routes/tenant/marketing/discounts/new.tsx`

```typescript
const discountSchema = z.object({
  code: z.string().min(1, "Discount code is required"),
  discountValue: z.number()
    .min(1, "Discount must be at least 1%")
    .max(100, "Discount cannot exceed 100%"),
  minBooking: z.number()
    .min(1, "Minimum booking must be at least $1")
    .nonnegative("Minimum booking cannot be negative"),
  // ... other fields
});
```

### KAN-624: Enrollment Payment Validation
**File:** `app/routes/tenant/training/sessions/$id/enrollments/new.tsx`

```typescript
const enrollmentSchema = z.object({
  studentId: z.number(),
  amountPaid: z.number()
    .min(1, "Payment amount must be at least $1")
    .or(z.number().refine(val => val === 0, {
      message: "For free enrollments, please use the scholarship option"
    })),
  // ... other fields
});
```

---

## Testing Verification Script

Create this script to verify fixes:
**scripts/verify-staging-fixes.sh**

```bash
#!/bin/bash

echo "🔍 Verifying Staging Deployment..."

# Check container status
echo -e "\n1️⃣ Container Status:"
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose ps"

# Check B2 credentials
echo -e "\n2️⃣ B2 Credentials:"
ssh root@76.13.28.28 "cd /docker/divestreams-staging && cat .env | grep B2_"

# Check SMTP credentials
echo -e "\n3️⃣ SMTP Credentials:"
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose exec worker env | grep SMTP"

# Check migration status
echo -e "\n4️⃣ Migration Status:"
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose logs worker | grep 'migration\|Applied\|Failed' | tail -20"

# Check email queue
echo -e "\n5️⃣ Email Queue Status:"
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose exec redis redis-cli LLEN bull:email:waiting"
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose exec redis redis-cli LLEN bull:email:failed"

# Verify subscription planId
echo -e "\n6️⃣ Subscription planId Check:"
ssh root@76.13.28.28 "cd /docker/divestreams-staging && docker compose exec db psql -U divestreams -d divestreams -c \"SELECT COUNT(*) as total, COUNT(\\\"planId\\\") as with_plan_id FROM public.subscriptions;\""

echo -e "\n✅ Verification complete!"
```

Make executable:
```bash
chmod +x scripts/verify-staging-fixes.sh
```

---

## Next Steps

1. **Run verification script** to identify deployment issues
2. **Fix critical issues** (B2, SMTP, subscription) first
3. **Deploy fixes** via CI/CD (push to staging branch)
4. **Verify each fix** with QA before marking as "Done"
5. **Update Jira issues** with verification evidence (screenshots, logs)
6. **Close resolved issues** and create follow-up tasks for remaining work

---

## Success Criteria

Before marking any issue as "Done":
- [ ] Fix deployed to staging
- [ ] Manual QA verification passed
- [ ] Root cause documented in Jira comment
- [ ] No regression in related features
- [ ] Error logging/monitoring added for future issues
