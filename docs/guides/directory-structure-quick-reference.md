# Directory Structure - Quick Reference

## Where Do I Put This File?

| Type | Location | Example |
|------|----------|---------|
| **Configuration** | `/` (root) | `tsconfig.json`, `.env.example` |
| **How-to guide** | `docs/guides/` | `docs/guides/how-to-deploy.md` |
| **Integration setup** | `docs/integrations/<service>/` | `docs/integrations/stripe/setup.md` |
| **Architecture doc** | `docs/architecture/` | `docs/architecture/database-design.md` |
| **Feature documentation** | `docs/features/` | `docs/features/booking-system.md` |
| **Bug fix report** | `docs/historical/bug-fixes/` | `docs/historical/bug-fixes/dive-123.md` |
| **Troubleshooting** | `docs/troubleshooting/` | `docs/troubleshooting/common-errors.md` |
| **Screenshot/image** | `docs/attachments/screenshots/` | `docs/attachments/screenshots/dark-mode.png` |
| **Utility script** | `scripts/` | `scripts/seed-data.ts` |
| **React component** | `app/components/` | `app/components/ui/button.tsx` |
| **Business logic** | `lib/` | `lib/stripe/create-subscription.ts` |
| **Unit test** | `tests/unit/` | `tests/unit/lib/stripe/create-subscription.test.ts` |
| **Integration test** | `tests/integration/` | `tests/integration/routes/api/stripe.test.ts` |
| **E2E test** | `tests/e2e/workflow/` | `tests/e2e/workflow/checkout.spec.ts` |

## Naming Conventions

### Files
✅ **Use kebab-case**: `stripe-setup.md`, `create-booking.ts`
❌ **Don't use**: `STRIPE_SETUP.md`, `CreateBooking.ts`, `stripe_setup.md`

**Exceptions**: `README.md`, `CLAUDE.md`, `Dockerfile`, `Caddyfile`

### Directories
✅ **Use kebab-case**: `docs/integrations/`, `app/components/ui/`
❌ **Don't use**: `docs/Integrations/`, `app/Components/UI/`

## Essential Commands

```bash
# Validate directory structure
npm run validate:structure

# Preview cleanup (dry-run)
npm run cleanup:structure

# Apply cleanup
npm run cleanup:structure --apply
```

## Root Directory Rules

### ✅ Allowed in Root

**Config files only**:
- `package.json`, `tsconfig.json`, `vite.config.ts`
- `.env.example`, `.gitignore`, `.dockerignore`
- `Dockerfile`, `Caddyfile`, `docker-compose*.yml`

**Essential docs only** (max 3):
- `README.md` - Project overview
- `CLAUDE.md` - AI agent instructions
- `DIRECTORY_STRUCTURE_POLICY.md` - Structure policy

### ❌ Not Allowed in Root

- ❌ Feature documentation
- ❌ Bug fix reports
- ❌ Implementation guides
- ❌ Session reports
- ❌ Deployment checklists
- ❌ Integration documentation
- ❌ Utility scripts (→ `scripts/`)

**All of these → `docs/`**

## Quick Decision Tree

```
New file to add?
│
├─ Is it a config file? → Root
├─ Is it executable? → scripts/
├─ Is it a test? → tests/
├─ Is it React code? → app/
├─ Is it business logic? → lib/
└─ Is it documentation?
   │
   ├─ Guide/tutorial? → docs/guides/
   ├─ Integration? → docs/integrations/<service>/
   ├─ Architecture? → docs/architecture/
   ├─ Feature? → docs/features/
   ├─ Bug fix? → docs/historical/bug-fixes/
   ├─ Troubleshooting? → docs/troubleshooting/
   └─ Screenshot? → docs/attachments/screenshots/
```

## Common Mistakes

### ❌ Wrong
```
/STRIPE_SETUP.md              # Wrong location, wrong case
/docs/stripe-guide.md         # No subdirectory
/scripts/my_utility.py        # Wrong case
/app/MyComponent.tsx          # Wrong case
```

### ✅ Right
```
/docs/integrations/stripe/setup.md
/docs/integrations/stripe/guide.md
/scripts/my-utility.py
/app/my-component.tsx
```

## Tests Mirror Code Structure

```
lib/stripe/create-subscription.ts
  → tests/unit/lib/stripe/create-subscription.test.ts

app/routes/tenant/bookings/new.tsx
  → tests/integration/routes/tenant/bookings/new.test.ts
  → tests/e2e/workflow/booking-creation.spec.ts
```

## Need More Details?

- **Full policy**: See `DIRECTORY_STRUCTURE_POLICY.md`
- **Implementation**: See `DIRECTORY_CLEANUP_SUMMARY.md`
- **Documentation guide**: See `docs/README.md`

---

**Last Updated**: 2026-02-15
