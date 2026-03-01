#!/usr/bin/env tsx
/**
 * Coverage Enforcer Script
 *
 * Enforces code coverage requirements across all test types:
 * - Unit tests (Vitest)
 * - Integration tests (Vitest)
 * - E2E tests (Playwright)
 * - Pact tests (consumer & provider)
 *
 * Usage:
 *   npm run coverage:enforce              # Check all coverage
 *   npm run coverage:enforce --type=unit  # Check specific type
 *   npm run coverage:enforce --strict     # Fail on any threshold miss
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface CoverageConfig {
  enforcement: {
    enabled: boolean;
    blockDeployment: boolean;
    blockCommit: boolean;
    blockPR: boolean;
  };
  thresholds: {
    unit: CoverageThresholds;
    integration: CoverageThresholds;
    e2e: CoverageThresholds;
    pact: PactThresholds;
    combined: CoverageThresholds;
  };
}

interface CoverageThresholds {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

interface PactThresholds {
  contracts: number;
  verifications: number;
}

interface CoverageSummary {
  total: {
    lines: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
    statements: { pct: number };
  };
}

class CoverageEnforcer {
  private config: CoverageConfig;
  private strict: boolean = false;
  private typeFilter?: string;
  private failures: string[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.parseArgs();
  }

  private loadConfig(): CoverageConfig {
    const configPath = path.join(process.cwd(), '.coverage-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('Coverage config not found: .coverage-config.json');
    }
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  private parseArgs() {
    const args = process.argv.slice(2);
    this.strict = args.includes('--strict');
    const typeArg = args.find(arg => arg.startsWith('--type='));
    if (typeArg) {
      this.typeFilter = typeArg.split('=')[1];
    }
  }

  async run() {
    if (!this.config.enforcement.enabled) {
      console.log('⚠️  Coverage enforcement is disabled');
      return 0;
    }

    console.log('🔍 Enforcing code coverage requirements...\n');

    if (!this.typeFilter || this.typeFilter === 'unit') {
      await this.checkUnitCoverage();
    }

    if (!this.typeFilter || this.typeFilter === 'integration') {
      await this.checkIntegrationCoverage();
    }

    if (!this.typeFilter || this.typeFilter === 'e2e') {
      await this.checkE2ECoverage();
    }

    if (!this.typeFilter || this.typeFilter === 'pact') {
      await this.checkPactCoverage();
    }

    if (!this.typeFilter) {
      await this.checkCombinedCoverage();
    }

    return this.reportResults();
  }

  private async checkUnitCoverage() {
    console.log('📊 Checking unit test coverage...');

    const coveragePath = path.join(process.cwd(), 'coverage/unit/coverage-summary.json');
    if (!fs.existsSync(coveragePath)) {
      this.failures.push('❌ Unit coverage report not found. Run: npm run test:coverage:unit');
      return;
    }

    const summary: CoverageSummary = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
    const thresholds = this.config.thresholds.unit;

    this.checkThresholds('Unit', summary.total, thresholds);
  }

  private async checkIntegrationCoverage() {
    console.log('📊 Checking integration test coverage...');

    // Integration tests use same Vitest setup, but we can run them separately
    const coveragePath = path.join(process.cwd(), 'coverage/integration/coverage-summary.json');

    if (!fs.existsSync(coveragePath)) {
      console.log('⚠️  Integration coverage report not found (running with unit tests)');
      return;
    }

    const summary: CoverageSummary = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
    const thresholds = this.config.thresholds.integration;

    this.checkThresholds('Integration', summary.total, thresholds);
  }

  private async checkE2ECoverage() {
    console.log('📊 Checking E2E test coverage...');

    const coveragePath = path.join(process.cwd(), 'coverage/e2e/coverage-summary.json');
    if (!fs.existsSync(coveragePath)) {
      console.log('⚠️  E2E coverage report not found (requires E2E_COVERAGE=true)');
      return;
    }

    const summary: CoverageSummary = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
    const thresholds = this.config.thresholds.e2e;

    this.checkThresholds('E2E', summary.total, thresholds);
  }

  private async checkPactCoverage() {
    console.log('📊 Checking Pact test coverage...');

    // Check if all API routes have Pact tests
    const apiRoutes = this.getApiRoutes();
    const pactConsumerTests = this.getPactConsumerTests();

    const uncoveredRoutes = apiRoutes.filter(route =>
      !pactConsumerTests.some(test => test.includes(route))
    );

    if (uncoveredRoutes.length > 0) {
      this.failures.push(
        `❌ Pact: ${uncoveredRoutes.length} API routes without consumer tests:\n` +
        uncoveredRoutes.map(r => `   - ${r}`).join('\n')
      );
    } else {
      console.log('  ✅ All API routes have Pact consumer tests');
    }

    // Check provider tests exist
    const providerTestPath = path.join(process.cwd(), 'tests/pact/provider');
    if (!fs.existsSync(providerTestPath)) {
      this.failures.push('❌ Pact provider tests directory not found');
    } else {
      console.log('  ✅ Pact provider tests exist');
    }
  }

  private async checkCombinedCoverage() {
    console.log('📊 Checking combined coverage...');

    const coveragePath = path.join(process.cwd(), 'coverage/combined/coverage-summary.json');
    if (!fs.existsSync(coveragePath)) {
      console.log('⚠️  Combined coverage report not found. Run: npm run coverage:merge');
      return;
    }

    const summary: CoverageSummary = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
    const thresholds = this.config.thresholds.combined;

    this.checkThresholds('Combined', summary.total, thresholds);
  }

  private checkThresholds(
    type: string,
    actual: CoverageSummary['total'],
    thresholds: CoverageThresholds
  ) {
    const checks = [
      { name: 'Lines', actual: actual.lines.pct, threshold: thresholds.lines },
      { name: 'Functions', actual: actual.functions.pct, threshold: thresholds.functions },
      { name: 'Branches', actual: actual.branches.pct, threshold: thresholds.branches },
      { name: 'Statements', actual: actual.statements.pct, threshold: thresholds.statements },
    ];

    let failed = false;
    for (const check of checks) {
      const pass = check.actual >= check.threshold;
      const icon = pass ? '✅' : '❌';
      const color = pass ? '' : '\x1b[31m'; // Red
      const reset = '\x1b[0m';

      console.log(
        `  ${icon} ${check.name}: ${color}${check.actual.toFixed(2)}%${reset} ` +
        `(threshold: ${check.threshold}%)`
      );

      if (!pass) {
        failed = true;
      }
    }

    if (failed) {
      this.failures.push(`❌ ${type} coverage below thresholds`);
    }
  }

  private getApiRoutes(): string[] {
    const apiDir = path.join(process.cwd(), 'app/routes/api');
    if (!fs.existsSync(apiDir)) return [];

    const routes: string[] = [];
    const walk = (dir: string, prefix = '') => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          walk(filePath, prefix + file + '/');
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
          const routeName = prefix + file.replace(/\.tsx?$/, '');
          routes.push(routeName);
        }
      }
    };

    walk(apiDir);
    return routes;
  }

  private getPactConsumerTests(): string[] {
    const pactDir = path.join(process.cwd(), 'tests/pact/consumer');
    if (!fs.existsSync(pactDir)) return [];

    return fs.readdirSync(pactDir)
      .filter(f => f.endsWith('.pact.test.ts'))
      .map(f => f.replace('.pact.test.ts', ''));
  }

  private reportResults(): number {
    console.log('\n' + '='.repeat(60));

    if (this.failures.length === 0) {
      console.log('✅ All coverage requirements met!');
      return 0;
    }

    console.log('❌ Coverage enforcement failed:\n');
    this.failures.forEach(failure => console.log(failure));
    console.log('\n' + '='.repeat(60));

    if (this.config.enforcement.blockDeployment || this.strict) {
      console.log('\n🚫 DEPLOYMENT BLOCKED - Fix coverage issues before deploying');
      return 1;
    }

    console.log('\n⚠️  Coverage issues detected but not blocking');
    return 0;
  }
}

// Run enforcer
const enforcer = new CoverageEnforcer();
enforcer.run().then(exitCode => process.exit(exitCode));
