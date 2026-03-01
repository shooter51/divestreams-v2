# DiveStreams v2 Documentation

Welcome to the DiveStreams v2 documentation. This directory contains all project documentation organized by category.

## Quick Links

- **[Development Setup](guides/development-setup.md)** - Get started with local development
- **[Deployment Guide](../CLAUDE.md#deployment)** - CI/CD pipeline and deployment process
- **[Testing Guide](guides/testing.md)** - Running tests and adding new tests
- **[Architecture Overview](architecture/README.md)** - System architecture and design decisions

## Documentation Structure

```
docs/
├── guides/              # How-to guides and tutorials
├── integrations/        # Third-party integration docs
├── architecture/        # Architecture decisions and designs
├── features/            # Feature documentation
├── troubleshooting/     # Problem resolution guides
├── historical/          # Archived documentation
└── attachments/         # Images, diagrams, screenshots
```

## Documentation Categories

### 📘 Guides
Step-by-step instructions for common tasks:
- Development setup and workflows
- Deployment procedures
- Testing strategies
- Infrastructure management

### 🔌 Integrations
Documentation for third-party services:
- **Stripe** - Payment processing
- **Pact** - Contract testing
- **Zapier** - Integration platform
- **B2 Storage** - Object storage
- **Email** - SMTP configuration

### 🏗️ Architecture
System design and technical decisions:
- Multi-tenant architecture
- Database schema design
- API design patterns
- Security architecture
- Background job processing

### ✨ Features
Detailed feature documentation:
- Training course import
- Point-of-sale system
- Booking management
- Subscription plans
- Dark mode theming

### 🔧 Troubleshooting
Common issues and solutions:
- E2E test failures
- Deployment problems
- Configuration issues

### 📦 Historical
Archived documentation for reference:
- Bug fix reports
- Code review archives
- Session handoff reports
- Investigation reports

## Contributing to Documentation

### Where to Add New Documentation

| Type | Location | Example |
|------|----------|---------|
| How-to guide | `guides/` | `guides/how-to-add-new-integration.md` |
| Integration setup | `integrations/<service>/` | `integrations/stripe/setup.md` |
| Architecture decision | `architecture/` | `architecture/authentication-design.md` |
| Feature documentation | `features/` | `features/multi-currency-support.md` |
| Bug fix report | `historical/bug-fixes/` | `historical/bug-fixes/dive-123-fix.md` |
| Troubleshooting | `troubleshooting/` | `troubleshooting/common-errors.md` |

### Naming Conventions

- **Use kebab-case**: `stripe-setup.md`, not `STRIPE_SETUP.md`
- **Be descriptive**: `how-to-add-oauth-provider.md`, not `oauth.md`
- **Include issue IDs**: `dive-031-completion.md` for issue-specific docs
- **Avoid dates**: Use git history instead of `report-2026-02-15.md`

### Documentation Style Guide

1. **Start with a clear heading** - Use `#` for title
2. **Add a table of contents** - For docs longer than 3 sections
3. **Use code blocks** - Always specify language for syntax highlighting
4. **Link to related docs** - Help readers discover related content
5. **Keep it current** - Update docs when code changes
6. **Be concise** - Respect the reader's time

### Example Documentation Structure

```markdown
# Feature Name

Brief one-sentence description.

## Overview

What this feature does and why it exists.

## Quick Start

Minimal steps to get started (for impatient developers).

## Configuration

Detailed configuration options.

## Usage Examples

Common use cases with code examples.

## Troubleshooting

Known issues and solutions.

## Related Documentation

- [Related Doc 1](../path/to/doc.md)
- [Related Doc 2](../path/to/doc.md)
```

## Maintaining Documentation

### Regular Cleanup

- **Quarterly**: Review and archive outdated documentation
- **After releases**: Update guides to reflect new features
- **When refactoring**: Update architecture docs

### Deprecation Process

1. Mark section/page with `⚠️ DEPRECATED` notice
2. Add deprecation date and alternative
3. After 2 releases, move to `historical/`

### Documentation Review Checklist

- [ ] Filename uses kebab-case
- [ ] Placed in correct directory
- [ ] Links work (no broken links)
- [ ] Code examples tested
- [ ] Screenshots up-to-date (if applicable)
- [ ] Grammar and spelling checked

## Tools

### Validate Directory Structure
```bash
npm run validate:structure
```

### Cleanup Directory Structure
```bash
# Dry run (see what would change)
npm run cleanup:structure

# Apply changes
npm run cleanup:structure --apply
```

## Getting Help

- **CLAUDE.md** - AI agent instructions and project overview
- **DIRECTORY_STRUCTURE_POLICY.md** - Directory structure rules
- **GitHub Issues** - Report documentation issues

---

**Last Updated**: 2026-02-15
**Maintainer**: Project Team
