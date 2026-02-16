#!/usr/bin/env tsx
/**
 * Test Scaffolding Generator
 *
 * Automatically generates test files for new features:
 * - Unit tests for utility functions and components
 * - Integration tests for routes and services
 * - E2E tests for user workflows
 * - Pact tests for API contracts
 *
 * Usage:
 *   npm run test:scaffold -- --file=app/routes/tenant/boats.tsx
 *   npm run test:scaffold -- --file=lib/utils/validation.ts
 *   npm run test:scaffold -- --api=app/routes/api/bookings.tsx
 *   npm run test:scaffold -- --feature=trip-scheduling
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ScaffoldOptions {
  file?: string;
  feature?: string;
  api?: boolean;
  force?: boolean;
}

class TestScaffoldGenerator {
  private options: ScaffoldOptions = {};

  constructor() {
    this.parseArgs();
  }

  private parseArgs() {
    const args = process.argv.slice(2);

    for (const arg of args) {
      if (arg.startsWith('--file=')) {
        this.options.file = arg.split('=')[1];
      } else if (arg.startsWith('--feature=')) {
        this.options.feature = arg.split('=')[1];
      } else if (arg === '--api') {
        this.options.api = true;
      } else if (arg === '--force') {
        this.options.force = true;
      }
    }
  }

  async run() {
    if (!this.options.file && !this.options.feature) {
      console.error('❌ Error: Must specify --file or --feature');
      console.log('\nUsage:');
      console.log('  npm run test:scaffold -- --file=app/routes/tenant/boats.tsx');
      console.log('  npm run test:scaffold -- --feature=trip-scheduling');
      process.exit(1);
    }

    if (this.options.file) {
      await this.generateTestsForFile(this.options.file);
    } else if (this.options.feature) {
      await this.generateTestsForFeature(this.options.feature);
    }
  }

  private async generateTestsForFile(filePath: string) {
    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`🔧 Generating tests for: ${filePath}\n`);

    // Determine file type and generate appropriate tests
    if (filePath.startsWith('app/routes/api/')) {
      await this.generateApiTests(filePath);
    } else if (filePath.startsWith('app/routes/')) {
      await this.generateRouteTests(filePath);
    } else if (filePath.startsWith('lib/')) {
      await this.generateLibTests(filePath);
    } else if (filePath.startsWith('app/components/')) {
      await this.generateComponentTests(filePath);
    } else {
      console.error('❌ Unknown file type. Cannot generate tests.');
      process.exit(1);
    }
  }

  private async generateApiTests(filePath: string) {
    console.log('📝 Generating API tests (Pact + Integration)...');

    // Extract route information
    const routeName = path.basename(filePath, path.extname(filePath));
    const routeDir = path.dirname(filePath).replace('app/routes/api/', '');
    const apiPath = routeDir ? `${routeDir}/${routeName}` : routeName;

    // Generate Pact consumer test
    const pactConsumerPath = `tests/pact/consumer/${apiPath}.pact.test.ts`;
    await this.ensureDirectory(path.dirname(pactConsumerPath));

    if (!fs.existsSync(pactConsumerPath) || this.options.force) {
      const pactConsumerContent = this.generatePactConsumerTemplate(apiPath, filePath);
      fs.writeFileSync(pactConsumerPath, pactConsumerContent);
      console.log(`  ✅ Created: ${pactConsumerPath}`);
    } else {
      console.log(`  ⏭️  Skipped: ${pactConsumerPath} (already exists)`);
    }

    // Generate integration test
    const integrationTestPath = `tests/integration/routes/api/${apiPath}.test.ts`;
    await this.ensureDirectory(path.dirname(integrationTestPath));

    if (!fs.existsSync(integrationTestPath) || this.options.force) {
      const integrationContent = this.generateApiIntegrationTemplate(apiPath, filePath);
      fs.writeFileSync(integrationTestPath, integrationContent);
      console.log(`  ✅ Created: ${integrationTestPath}`);
    } else {
      console.log(`  ⏭️  Skipped: ${integrationTestPath} (already exists)`);
    }

    // Update Pact provider test to include new route
    console.log('  ℹ️  Reminder: Update tests/pact/provider/api-provider.pact.test.ts');
  }

  private async generateRouteTests(filePath: string) {
    console.log('📝 Generating route tests (Integration + E2E)...');

    const routePath = filePath.replace('app/routes/', '').replace('.tsx', '');

    // Generate integration test
    const integrationTestPath = `tests/integration/routes/${routePath}.test.ts`;
    await this.ensureDirectory(path.dirname(integrationTestPath));

    if (!fs.existsSync(integrationTestPath) || this.options.force) {
      const integrationContent = this.generateRouteIntegrationTemplate(routePath, filePath);
      fs.writeFileSync(integrationTestPath, integrationContent);
      console.log(`  ✅ Created: ${integrationTestPath}`);
    } else {
      console.log(`  ⏭️  Skipped: ${integrationTestPath} (already exists)`);
    }

    // Generate E2E test
    const e2eTestPath = `tests/e2e/workflow/${routePath.split('/')[0]}.spec.ts`;
    console.log(`  ℹ️  E2E test should be added to: ${e2eTestPath}`);
  }

  private async generateLibTests(filePath: string) {
    console.log('📝 Generating unit tests...');

    const libPath = filePath.replace('lib/', '').replace(/\.tsx?$/, '');
    const unitTestPath = `tests/unit/lib/${libPath}.test.ts`;

    await this.ensureDirectory(path.dirname(unitTestPath));

    if (!fs.existsSync(unitTestPath) || this.options.force) {
      const unitContent = this.generateUnitTestTemplate(libPath, filePath);
      fs.writeFileSync(unitTestPath, unitContent);
      console.log(`  ✅ Created: ${unitTestPath}`);
    } else {
      console.log(`  ⏭️  Skipped: ${unitTestPath} (already exists)`);
    }
  }

  private async generateComponentTests(filePath: string) {
    console.log('📝 Generating component tests...');

    const componentPath = filePath.replace('app/components/', '').replace('.tsx', '');
    const unitTestPath = `tests/unit/app/components/${componentPath}.test.tsx`;

    await this.ensureDirectory(path.dirname(unitTestPath));

    if (!fs.existsSync(unitTestPath) || this.options.force) {
      const unitContent = this.generateComponentTestTemplate(componentPath, filePath);
      fs.writeFileSync(unitTestPath, unitContent);
      console.log(`  ✅ Created: ${unitTestPath}`);
    } else {
      console.log(`  ⏭️  Skipped: ${unitTestPath} (already exists)`);
    }
  }

  private async generateTestsForFeature(featureName: string) {
    console.log(`🔧 Generating complete test suite for feature: ${featureName}\n`);

    // Generate E2E workflow test
    const e2eTestPath = `tests/e2e/workflow/${featureName}.spec.ts`;
    await this.ensureDirectory(path.dirname(e2eTestPath));

    if (!fs.existsSync(e2eTestPath) || this.options.force) {
      const e2eContent = this.generateE2EWorkflowTemplate(featureName);
      fs.writeFileSync(e2eTestPath, e2eContent);
      console.log(`  ✅ Created: ${e2eTestPath}`);
    } else {
      console.log(`  ⏭️  Skipped: ${e2eTestPath} (already exists)`);
    }

    console.log('\n📋 Next steps:');
    console.log('  1. Identify all files modified for this feature');
    console.log('  2. Run test:scaffold for each file');
    console.log('  3. Fill in test implementation details');
    console.log('  4. Run npm run coverage:enforce to verify');
  }

  // Template generators

  private generatePactConsumerTemplate(apiPath: string, sourceFile: string): string {
    const routeName = apiPath.split('/').pop() || apiPath;

    return `import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const { eachLike, like } = MatchersV3;

describe('Pact Consumer: ${routeName}', () => {
  const provider = new PactV3({
    consumer: 'DiveStreamsFrontend',
    provider: 'DiveStreamsAPI',
    dir: './pacts',
  });

  describe('GET /${apiPath}', () => {
    it('returns ${routeName} successfully', async () => {
      await provider
        .given('${routeName} exist')
        .uponReceiving('a request to get ${routeName}')
        .withRequest({
          method: 'GET',
          path: '/api/${apiPath}',
          headers: {
            Accept: 'application/json',
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
          body: eachLike({
            id: like(1),
            // TODO: Add response fields from ${sourceFile}
          }),
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(\`\${mockServer.url}/api/${apiPath}\`, {
            headers: {
              Accept: 'application/json',
            },
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(Array.isArray(data)).toBe(true);
          // TODO: Add assertions
        });
    });
  });

  describe('POST /${apiPath}', () => {
    it('creates ${routeName} successfully', async () => {
      await provider
        .given('valid ${routeName} data')
        .uponReceiving('a request to create ${routeName}')
        .withRequest({
          method: 'POST',
          path: '/api/${apiPath}',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: {
            // TODO: Add request fields
          },
        })
        .willRespondWith({
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
          body: {
            id: like(1),
            // TODO: Add response fields
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(\`\${mockServer.url}/api/${apiPath}\`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              // TODO: Add test data
            }),
          });

          expect(response.status).toBe(201);
          // TODO: Add assertions
        });
    });
  });

  // TODO: Add more HTTP methods (PUT, DELETE) as needed
});
`;
  }

  private generateApiIntegrationTemplate(apiPath: string, sourceFile: string): string {
    const routeName = apiPath.split('/').pop() || apiPath;

    return `import { describe, it, expect, beforeEach } from 'vitest';
import { createRequestContext } from '~/tests/setup/test-utils';
import { getTenantDb } from '~/lib/db/tenant.server';

describe('API Integration: /${apiPath}', () => {
  let db: ReturnType<typeof getTenantDb>;
  let organizationId: number;

  beforeEach(async () => {
    const context = await createRequestContext();
    db = context.db;
    organizationId = context.organizationId;
  });

  describe('GET /${apiPath}', () => {
    it('returns all ${routeName} for tenant', async () => {
      // TODO: Seed test data
      // TODO: Make request
      // TODO: Assert response
    });

    it('filters by organization_id (multi-tenant isolation)', async () => {
      // TODO: Test tenant isolation
    });

    it('returns 401 when not authenticated', async () => {
      // TODO: Test auth requirement
    });
  });

  describe('POST /${apiPath}', () => {
    it('creates new ${routeName}', async () => {
      // TODO: Create request
      // TODO: Assert database state
      // TODO: Assert response
    });

    it('validates required fields', async () => {
      // TODO: Test validation
    });

    it('enforces tenant isolation on create', async () => {
      // TODO: Test tenant isolation
    });
  });

  // TODO: Add PUT, DELETE tests as needed
});
`;
  }

  private generateRouteIntegrationTemplate(routePath: string, sourceFile: string): string {
    const routeName = routePath.split('/').pop() || routePath;

    return `import { describe, it, expect, beforeEach } from 'vitest';
import { createRequestContext } from '~/tests/setup/test-utils';

describe('Route Integration: /${routePath}', () => {
  let context: Awaited<ReturnType<typeof createRequestContext>>;

  beforeEach(async () => {
    context = await createRequestContext();
  });

  describe('loader', () => {
    it('loads ${routeName} data for authenticated user', async () => {
      // TODO: Import loader from ${sourceFile}
      // TODO: Create request
      // TODO: Assert loader data
    });

    it('redirects unauthenticated users to login', async () => {
      // TODO: Test auth requirement
    });

    it('filters data by organization_id', async () => {
      // TODO: Test multi-tenant isolation
    });
  });

  describe('action', () => {
    it('handles form submission successfully', async () => {
      // TODO: Import action from ${sourceFile}
      // TODO: Create form request
      // TODO: Assert action response
      // TODO: Assert database state
    });

    it('validates form data', async () => {
      // TODO: Test validation
    });

    it('enforces tenant isolation on mutations', async () => {
      // TODO: Test tenant isolation
    });
  });
});
`;
  }

  private generateUnitTestTemplate(libPath: string, sourceFile: string): string {
    const moduleName = libPath.split('/').pop() || libPath;

    return `import { describe, it, expect } from 'vitest';
// TODO: Import functions from ${sourceFile}

describe('${moduleName}', () => {
  describe('functionName', () => {
    it('handles valid input', () => {
      // TODO: Test happy path
    });

    it('handles edge cases', () => {
      // TODO: Test edge cases
    });

    it('throws on invalid input', () => {
      // TODO: Test error handling
    });
  });

  // TODO: Add more test suites for each exported function
});
`;
  }

  private generateComponentTestTemplate(componentPath: string, sourceFile: string): string {
    const componentName = componentPath.split('/').pop() || componentPath;

    return `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// TODO: Import ${componentName} from ${sourceFile}

describe('${componentName}', () => {
  it('renders without crashing', () => {
    // TODO: Render component
    // TODO: Assert basic rendering
  });

  it('displays correct content', () => {
    // TODO: Render with props
    // TODO: Assert content
  });

  it('handles user interactions', async () => {
    const user = userEvent.setup();
    // TODO: Render component
    // TODO: Simulate interactions
    // TODO: Assert behavior
  });

  it('calls callbacks when expected', async () => {
    // TODO: Test callback props
  });

  // TODO: Add more tests for component behavior
});
`;
  }

  private generateE2EWorkflowTemplate(featureName: string): string {
    const displayName = featureName.split('-').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');

    return `import { test, expect } from '@playwright/test';
import { createTestTenant, loginAsTestUser } from '../fixtures/test-fixtures';

test.describe('${displayName} Workflow', () => {
  test.beforeEach(async ({ page }) => {
    const tenant = await createTestTenant();
    await loginAsTestUser(page, tenant);
  });

  test('complete ${featureName} workflow', async ({ page }) => {
    // TODO: Navigate to feature
    await page.goto('/tenant/dashboard');

    // TODO: Complete user workflow
    // Example:
    // await page.click('[data-testid="create-${featureName}"]');
    // await page.fill('[name="title"]', 'Test ${displayName}');
    // await page.click('[type="submit"]');

    // TODO: Assert final state
    // await expect(page.locator('.success-message')).toBeVisible();
  });

  test('handles validation errors', async ({ page }) => {
    // TODO: Test error states
  });

  test('supports editing existing ${featureName}', async ({ page }) => {
    // TODO: Test edit workflow
  });

  test('supports deleting ${featureName}', async ({ page }) => {
    // TODO: Test delete workflow
  });

  // TODO: Add more workflow tests
});
`;
  }

  private async ensureDirectory(dirPath: string) {
    const fullPath = path.join(process.cwd(), dirPath);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }
}

// Run generator
const generator = new TestScaffoldGenerator();
generator.run();
