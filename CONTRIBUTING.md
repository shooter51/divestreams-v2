# Contributing to DiveStreams v2

Thank you for your interest in contributing to DiveStreams! This document outlines our development workflow and standards.

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Redis (optional, for rate limiting in production)
- pnpm or npm

### Setup
```bash
# Clone the repository
git clone https://github.com/shooter51/divestreams-v2.git
cd divestreams-v2

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npx drizzle-kit push

# Start development server
npm run dev
```

## Development Workflow

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code improvements
- `docs/description` - Documentation only

### Commit Messages
Use conventional commits with emoji prefixes:
- 🔒 Security fixes
- ⚡ Performance improvements
- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation
- 🔧 Configuration/tooling
- ♻️ Refactoring

Example: `🔒 Security: Add rate limiting to auth endpoints`

### Pull Request Process
1. Create a branch from `staging`
2. Make your changes
3. Run tests: `npm test`
4. Run linting: `npm run lint`
5. Push and create a PR to `staging`
6. Request review from a team member
7. After approval, squash and merge

### Code Review Checklist
- [ ] Tests pass
- [ ] No new ESLint warnings
- [ ] Multi-tenant isolation maintained (all queries filter by `organizationId`)
- [ ] No hardcoded colors (use semantic tokens)
- [ ] Sensitive data not logged

## Code Standards

### TypeScript
- Strict mode enabled
- Avoid `any` - use proper types or `unknown`
- Prefix unused variables with `_`
- Use Zod for runtime validation

### Database
- All business tables must have `organizationId` column
- Use Drizzle ORM for queries
- Add indexes for frequently queried columns
- Never bypass tenant isolation

### Security
- Rate limit all authentication endpoints
- Sanitize user input with DOMPurify
- Use parameterized queries (Drizzle handles this)
- Log security events server-side only
- Never expose internal error details to users

### Styling
- Use semantic color tokens (`var(--foreground)`, `var(--surface)`)
- No hardcoded hex/rgb colors
- Mobile-first responsive design
- Follow existing component patterns

## Testing

### Unit Tests
```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- path/to/test   # Specific test
```

### E2E Tests
```bash
npm run test:e2e           # Run Playwright tests
npm run test:e2e:ui        # Interactive mode
```

### Test Patterns
- Use Page Object pattern for E2E tests
- Mock external services in unit tests
- Test multi-tenant isolation explicitly

## Jira Integration

We use Jira for issue tracking at https://divestreams.atlassian.net/

- Reference tickets in commits: `KAN-123: Description`
- Update ticket status when starting work
- Link PRs to tickets

## Questions?

- Check existing issues and PRs
- Ask in the team Slack channel
- Review CLAUDE.md for AI-assisted development tips
