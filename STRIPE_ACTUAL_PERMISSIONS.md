# Stripe Actual Permissions (Fill This In)

Use this document to list the actual permissions you see in the Stripe Dashboard when creating restricted keys. Then we'll update the other guides to match.

## Step 1: View Available Permissions

1. Go to https://dashboard.stripe.com/developers/api-keys
2. Click "Create restricted key"
3. Scroll through the permission sections
4. Copy the exact permission names and category structure below

## Permission Structure

For each resource, Stripe typically shows:
- [ ] None
- [ ] Read
- [ ] Write
- [ ] Connect (if applicable)

## Actual Permissions Available

### Section 1: _______________
- [ ] Permission name: _________________ (None/Read/Write)
- [ ] Permission name: _________________ (None/Read/Write)
- [ ] Permission name: _________________ (None/Read/Write)

### Section 2: _______________
- [ ] Permission name: _________________ (None/Read/Write)
- [ ] Permission name: _________________ (None/Read/Write)
- [ ] Permission name: _________________ (None/Read/Write)

### Section 3: _______________
- [ ] Permission name: _________________ (None/Read/Write)
- [ ] Permission name: _________________ (None/Read/Write)
- [ ] Permission name: _________________ (None/Read/Write)

(Continue for all sections visible in your dashboard)

## Backend Key Recommended Permissions

For a server-side key, I would need:
- [Select "Read" or "Write" for each needed permission]

## Frontend Key Recommended Permissions

For a browser-side key, I would need:
- [Select minimal permissions - mostly "Read" and maybe "Create" for payments]

---

Once you fill this in, I'll update these files to match your actual Stripe permissions:
1. STRIPE_RESTRICTED_KEYS.md
2. STRIPE_PERMISSIONS_REFERENCE.md
3. STRIPE_SETUP.md
