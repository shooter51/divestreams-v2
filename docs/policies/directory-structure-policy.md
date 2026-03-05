# DiveStreams v2 - Directory Structure Policy

**Version**: 1.1
**Last Updated**: 2026-03-05
**Status**: ENFORCED (pre-commit hook + CI gate)

## Overview

This document defines the canonical directory structure for the DiveStreams v2 repository. All contributors (human and AI) must follow this policy when creating, moving, or organizing files.

## Core Principles

1. **Separation of Concerns**: Code, tests, docs, config, and infrastructure files must live in designated directories
2. **Minimize Root Clutter**: Root directory should only contain essential config files and documentation
3. **Consistent Naming**: Use kebab-case for directories and files (exceptions for standard files like README.md)
4. **Hierarchical Organization**: Related files should be grouped logically
5. **Discoverability**: Developers should be able to find files intuitively

## Root Directory (`/`)

### Allowed Files Only

**Configuration Files** (alphabetically):
- `.dockerignore` - Docker build exclusions
- `.env.example` - Environment variable template
- `.env.pact-broker.example` - Pact broker config template
- `.gitattributes` - Git file attributes
- `.gitignore` - Git exclusions
- `.mcp.json.example` - MCP configuration template
- `.nycrc.json` - Code coverage config
- `.pactrc` - Pact testing config
- `.prettierrc` - Code formatting config
- `docker-compose*.yml` - Docker compose files (all variants)
- `drizzle.config.ts` - Database migration config
- `eslint.config.js` - Linting configuration
- `package.json` - NPM dependencies
- `package-lock.json` - NPM lock file
- `playwright.config.ts` - E2E testing config
- `react-router.config.ts` - React Router config
- `tsconfig.json` - TypeScript config
- `vite.config.ts` - Vite build config
- `vitest.config.ts` - Unit test config

**Caddy Configuration**:
- `Caddyfile` - Production reverse proxy config
- `Caddyfile.dev` - Dev VPS config
- `Caddyfile.test` - Test VPS config
- `Caddyfile.pact` - Pact broker config

**Docker Files**:
- `Dockerfile` - Main application image
- `Dockerfile.caddy` - Caddy proxy image

**Essential Documentation** (Max 2 files):
- `README.md` - Project overview and quick start
- `CLAUDE.md` - AI agent instructions

### Prohibited in Root

❌ Feature documentation
❌ Bug fix reports
❌ Implementation guides
❌ Session reports
❌ Deployment checklists
❌ Testing summaries
❌ Infrastructure guides
❌ Integration documentation

**All of these belong in `docs/`**

## Directory Structure

```
divestreams-v2/
├── .beads/                    # Beads issue tracking (tool-managed)
├── .claude/                   # Claude Code configuration
│   ├── memory/               # AI memory files
│   └── skills/               # Custom skills
├── .github/                   # GitHub configuration
│   └── workflows/            # CI/CD pipelines
├── app/                       # React Router application code
│   ├── components/           # React components
│   │   ├── ui/              # Generic UI components
│   │   ├── settings/        # Settings-specific components
│   │   ├── integrations/    # Integration components
│   │   └── pos/             # Point-of-sale components
│   ├── routes/              # React Router routes (file-based routing)
│   │   ├── admin/           # Platform admin routes
│   │   ├── api/             # API endpoints
│   │   ├── auth/            # Authentication routes
│   │   ├── embed/           # Embeddable widgets
│   │   ├── marketing/       # Public marketing pages
│   │   ├── site/            # Public site routes
│   │   └── tenant/          # Tenant portal routes
│   └── welcome/             # Onboarding/welcome screens
├── docs/                      # All documentation (see below for structure)
├── drizzle/                   # Database migrations (Drizzle-generated)
│   └── meta/                 # Migration metadata
├── lib/                       # Server-side business logic
│   ├── auth/                 # Authentication utilities
│   ├── cache/                # Redis caching layer
│   ├── data/                 # Static data and catalogs
│   │   ├── agency-templates/ # Dive agency templates
│   │   ├── catalogs/         # Product catalogs
│   │   └── schemas/          # Data validation schemas
│   ├── db/                   # Database access layer
│   │   ├── queries/          # Reusable query functions
│   │   └── schema/           # Drizzle ORM schema definitions
│   ├── email/                # Email sending
│   │   └── templates/        # Email templates
│   ├── integrations/         # Third-party integrations
│   ├── jobs/                 # Background job processors
│   ├── middleware/           # Request middleware
│   ├── security/             # Security utilities
│   ├── storage/              # File/object storage (B2)
│   ├── stripe/               # Stripe payment integration
│   ├── stubs/                # Testing stubs/mocks
│   ├── themes/               # Theme utilities
│   ├── training/             # Training course logic
│   ├── trips/                # Trip management logic
│   ├── utils/                # General utilities
│   └── validation/           # Input validation
├── node_modules/              # NPM dependencies (gitignored)
├── pacts/                     # Pact contract testing
│   └── contracts/            # Generated contract files
├── playwright-report/         # E2E test reports (gitignored)
├── public/                    # Static assets
│   └── templates/            # PDF templates, etc.
├── scripts/                   # Utility scripts
│   └── migrations/           # Manual migration scripts
├── tests/                     # All tests (see below for structure)
└── zapier-app/                # Zapier integration app
    ├── actions/              # Zapier action definitions
    └── triggers/             # Zapier trigger definitions
```

## Documentation Structure (`docs/`)

The `docs/` directory must be well-organized to remain useful. **Current state has 100+ files - needs cleanup.**

### Required Structure

```
docs/
├── README.md                       # Documentation index
├── guides/                         # How-to guides and tutorials
│   ├── deployment.md              # Deployment guide
│   ├── development.md             # Local development setup
│   ├── testing.md                 # Testing guide
│   ├── infrastructure.md          # Infrastructure overview
│   └── contributing.md            # Contribution guidelines
├── integrations/                   # Integration documentation
│   ├── stripe/                    # Stripe integration
│   │   ├── setup.md
│   │   ├── permissions.md
│   │   └── sync-guide.md
│   ├── pact/                      # Pact contract testing
│   │   ├── setup.md
│   │   ├── broker-deployment.md
│   │   └── deployment-safety.md
│   ├── zapier/                    # Zapier integration
│   │   ├── quick-start.md
│   │   ├── deployment.md
│   │   └── examples.md
│   ├── b2-storage.md              # Backblaze B2 setup
│   └── email.md                   # Email configuration
├── architecture/                   # Architecture decisions and designs
│   ├── multi-tenancy.md           # Multi-tenant architecture
│   ├── database-schema.md         # Database design
│   ├── api-design.md              # API patterns
│   ├── security.md                # Security architecture
│   └── background-jobs.md         # Job queue design
├── features/                       # Feature documentation
│   ├── training-import.md         # Training course import
│   ├── pos-system.md              # Point-of-sale
│   ├── booking-system.md          # Booking management
│   ├── subscription-plans.md      # Subscription features
│   └── dark-mode.md               # Dark mode theming
├── troubleshooting/               # Problem resolution
│   ├── common-errors.md           # FAQ and common issues
│   ├── e2e-test-failures.md       # E2E debugging
│   └── deployment-issues.md       # Deployment troubleshooting
├── historical/                    # Archived documentation
│   ├── bug-fixes/                # Historical bug fix reports
│   ├── peer-reviews/             # Code review archives
│   ├── session-reports/          # Session handoff reports
│   └── explorations/             # Investigation reports
└── attachments/                   # Images, diagrams, screenshots
    ├── screenshots/
    ├── diagrams/
    └── jira/                     # JIRA ticket attachments
```

### Documentation Naming Rules

1. **File Names**: Use kebab-case (e.g., `stripe-setup.md`, not `STRIPE_SETUP.md`)
2. **Date Suffixes**: Avoid date suffixes in filenames (use git history instead)
3. **Issue References**: Prefix with issue ID if specific (e.g., `dive-031-completion.md`)
4. **No Acronyms in ALL CAPS**: Use `pact-setup.md` not `PACT_SETUP.md`

### Documentation Cleanup Required

**Current violations** (must be moved/consolidated):
- 18+ markdown files in root → Move to `docs/`
- 100+ files in `docs/` → Organize into subdirectories
- Multiple peer review files → Consolidate or archive in `docs/historical/peer-reviews/`
- Duplicate guides → Merge into canonical versions

## Test Structure (`tests/`)

```
tests/
├── e2e/                           # End-to-end tests (Playwright)
│   ├── workflow/                 # Full workflow tests
│   ├── bugs/                     # Bug reproduction tests
│   ├── coverage/                 # Coverage-specific tests
│   ├── fixtures/                 # Test fixtures
│   ├── helpers/                  # Test helpers
│   └── page-objects/             # Page object models
├── integration/                   # Integration tests (Vitest)
│   ├── routes/                   # Route handler tests
│   │   ├── admin/
│   │   ├── api/
│   │   ├── auth/
│   │   ├── tenant/
│   │   └── bugs/                # Bug-specific integration tests
│   ├── lib/                      # Library integration tests
│   │   ├── db/
│   │   ├── integrations/
│   │   └── training/
│   └── scripts/                  # Script tests
├── unit/                          # Unit tests (Vitest)
│   ├── app/                      # App code unit tests
│   │   ├── components/
│   │   └── routes/
│   ├── lib/                      # Library unit tests
│   │   ├── auth/
│   │   ├── db/
│   │   ├── email/
│   │   ├── integrations/
│   │   ├── jobs/
│   │   ├── middleware/
│   │   ├── security/
│   │   ├── storage/
│   │   ├── stripe/
│   │   ├── themes/
│   │   ├── trips/
│   │   ├── utils/
│   │   └── validation/
│   └── scripts/                  # Script unit tests
├── pact/                          # Contract tests
│   ├── consumer/                 # Consumer contracts
│   └── provider/                 # Provider verification
├── fixtures/                      # Shared test fixtures
├── helpers/                       # Shared test helpers
├── mocks/                         # Shared mocks
├── setup/                         # Test setup and configuration
│   └── fixtures/
└── utils/                         # Test utilities
```

### Test Naming Rules

1. **Test files**: Match the file they test with `.test.ts` or `.spec.ts` suffix
2. **Test directories**: Mirror the structure of the code they test
3. **Bug tests**: Place in `bugs/` subdirectory with issue reference (e.g., `dive-123.test.ts`)

## Enforcement

### Automated Checks

The validator script (`scripts/validate-directory-structure.ts`) enforces:
1. No prohibited files in root directory
2. Consistent file naming (kebab-case) across `docs/` and `scripts/`
3. Documentation files in `docs/` subdirectories, not root
4. `docs/historical/` file count below threshold

### Pre-Commit Hook

The pre-commit hook runs `npm run validate:structure` before every commit. Violations block the commit.

### CI Gate

`ci-pr.yml` runs `npm run validate:structure` as a blocking step on every PR to `develop`.

### Strict Mode

`npm run validate:structure -- --strict` treats warnings as errors. Used in CI to catch naming issues.

## Exceptions

The following exceptions are allowed:
1. **Tool-managed directories**: `.beads/`, `node_modules/`, `drizzle/` (managed by external tools)
2. **Standard config files**: `README.md`, `CLAUDE.md` (conventional naming)
3. **Generated files**: `playwright-report/`, `coverage-summary.json` (gitignored)
4. **Build artifacts**: `build/`, `.cache/` (gitignored, not committed)

## References

This policy aligns with:
- [React Router v7 conventions](https://reactrouter.com/en/main/file-routes/route-module)
- [Vitest best practices](https://vitest.dev/guide/)
- [Playwright project structure](https://playwright.dev/docs/test-configuration)
- [Common Node.js project structure](https://github.com/goldbergyoni/nodebestpractices)

## Revision History

- **v1.1** (2026-03-05): Automated enforcement (pre-commit + CI gate), cleaned up 140+ files, removed tools/ dir
- **v1.0** (2026-02-15): Initial policy created
