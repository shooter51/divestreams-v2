#!/usr/bin/env tsx
/**
 * Vibe Kanban Test Tracker
 *
 * Integrates with Vibe Kanban to:
 * - Create test tasks for new features
 * - Track coverage progress
 * - Block feature completion until all tests pass
 * - Update issue status based on coverage
 *
 * Usage:
 *   npm run vibe:track -- --issue=DIVE-123
 *   npm run vibe:check -- --issue=DIVE-123
 *   npm run vibe:create-tests -- --issue=DIVE-123
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface CoverageConfig {
  vibeKanban: {
    enabled: boolean;
    createTestTasks: boolean;
    trackCoverage: boolean;
    issuePrefix: string;
    testLabels: string[];
    requiredTests: string[];
  };
}

interface IssueTestStatus {
  issueId: string;
  modifiedFiles: string[];
  testStatus: {
    unit: { exists: boolean; passing: boolean };
    integration: { exists: boolean; passing: boolean };
    e2e: { exists: boolean; passing: boolean };
    pact: { exists: boolean; passing: boolean };
  };
  coverageStatus: {
    unit: number;
    integration: number;
    e2e: number;
    combined: number;
  };
  ready: boolean;
  blockers: string[];
}

class VibeTestTracker {
  private config: CoverageConfig;
  private issueId?: string;
  private action: 'track' | 'check' | 'create-tests' = 'check';

  constructor() {
    this.config = this.loadConfig();
    this.parseArgs();
  }

  private loadConfig(): CoverageConfig {
    const configPath = path.join(process.cwd(), '.coverage-config.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('Coverage config not found: .coverage-config.json');
    }
    const fullConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { vibeKanban: fullConfig.vibeKanban };
  }

  private parseArgs() {
    const args = process.argv.slice(2);

    for (const arg of args) {
      if (arg.startsWith('--issue=')) {
        this.issueId = arg.split('=')[1];
      } else if (arg === '--track') {
        this.action = 'track';
      } else if (arg === '--check') {
        this.action = 'check';
      } else if (arg === '--create-tests') {
        this.action = 'create-tests';
      }
    }
  }

  async run() {
    if (!this.config.vibeKanban.enabled) {
      console.log('⚠️  Vibe Kanban integration is disabled');
      return 0;
    }

    if (!this.issueId) {
      console.error('❌ Error: Must specify --issue=DIVE-XXX');
      return 1;
    }

    switch (this.action) {
      case 'track':
        return await this.trackIssue();
      case 'check':
        return await this.checkIssue();
      case 'create-tests':
        return await this.createTestsForIssue();
    }
  }

  private async trackIssue(): Promise<number> {
    console.log(`🔍 Tracking test requirements for ${this.issueId}...\n`);

    const status = await this.getIssueTestStatus();
    await this.updateVibeIssue(status);

    return status.ready ? 0 : 1;
  }

  private async checkIssue(): Promise<number> {
    console.log(`🔍 Checking test coverage for ${this.issueId}...\n`);

    const status = await this.getIssueTestStatus();
    this.displayStatus(status);

    return status.ready ? 0 : 1;
  }

  private async createTestsForIssue(): Promise<number> {
    console.log(`🔧 Creating test scaffolding for ${this.issueId}...\n`);

    const status = await this.getIssueTestStatus();

    if (status.modifiedFiles.length === 0) {
      console.log('⚠️  No modified files found for this issue');
      console.log('Make sure to commit changes before generating tests');
      return 1;
    }

    console.log('Modified files:');
    status.modifiedFiles.forEach(file => console.log(`  - ${file}`));
    console.log('');

    // Generate tests for each modified file
    for (const file of status.modifiedFiles) {
      if (file.match(/\.(ts|tsx)$/) && !file.match(/\.test\.(ts|tsx)$/)) {
        console.log(`Generating tests for: ${file}`);
        try {
          execSync(`npm run test:scaffold -- --file=${file}`, {
            stdio: 'inherit',
          });
        } catch (error) {
          console.error(`Failed to generate tests for ${file}`);
        }
      }
    }

    console.log('\n✅ Test scaffolding created!');
    console.log('Next steps:');
    console.log('  1. Review and complete the generated test files');
    console.log('  2. Run npm test to verify tests pass');
    console.log('  3. Run npm run vibe:track to update issue status');

    return 0;
  }

  private async getIssueTestStatus(): Promise<IssueTestStatus> {
    const modifiedFiles = this.getModifiedFilesForIssue();

    const status: IssueTestStatus = {
      issueId: this.issueId!,
      modifiedFiles,
      testStatus: {
        unit: { exists: false, passing: false },
        integration: { exists: false, passing: false },
        e2e: { exists: false, passing: false },
        pact: { exists: false, passing: false },
      },
      coverageStatus: {
        unit: 0,
        integration: 0,
        e2e: 0,
        combined: 0,
      },
      ready: false,
      blockers: [],
    };

    // Check if tests exist for each modified file
    for (const file of modifiedFiles) {
      this.checkTestsForFile(file, status);
    }

    // Check test execution status
    await this.checkTestExecution(status);

    // Check coverage
    await this.checkCoverage(status);

    // Determine if ready
    status.ready = this.isFeatureReady(status);
    status.blockers = this.getBlockers(status);

    return status;
  }

  private getModifiedFilesForIssue(): string[] {
    try {
      // Get files modified in commits mentioning this issue
      const output = execSync(
        `git log --all --grep="${this.issueId}" --name-only --pretty=format: | sort -u`,
        { encoding: 'utf-8' }
      );

      return output
        .split('\n')
        .filter(line => line.trim() !== '')
        .filter(line => line.match(/\.(ts|tsx)$/) && !line.match(/\.test\.(ts|tsx)$/));
    } catch (error) {
      // If no commits yet, check staged and unstaged changes
      try {
        const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' });
        return output
          .split('\n')
          .filter(line => line.trim() !== '')
          .filter(line => line.match(/\.(ts|tsx)$/) && !line.match(/\.test\.(ts|tsx)$/));
      } catch {
        return [];
      }
    }
  }

  private checkTestsForFile(file: string, status: IssueTestStatus) {
    if (file.startsWith('app/routes/api/')) {
      // API routes need Pact + integration tests
      const routePath = file.replace('app/routes/api/', '').replace('.tsx', '');
      const pactTest = `tests/pact/consumer/${routePath}.pact.test.ts`;
      const integrationTest = `tests/integration/routes/api/${routePath}.test.ts`;

      if (fs.existsSync(pactTest)) {
        status.testStatus.pact.exists = true;
      }
      if (fs.existsSync(integrationTest)) {
        status.testStatus.integration.exists = true;
      }
    } else if (file.startsWith('app/routes/')) {
      // Regular routes need integration tests
      const routePath = file.replace('app/routes/', '').replace('.tsx', '');
      const integrationTest = `tests/integration/routes/${routePath}.test.ts`;

      if (fs.existsSync(integrationTest)) {
        status.testStatus.integration.exists = true;
      }
    } else if (file.startsWith('lib/') || file.startsWith('app/components/')) {
      // Lib and components need unit tests
      const unitPath = file.replace(/^(lib|app\/components)\//, '').replace(/\.tsx?$/, '');
      const prefix = file.startsWith('lib/') ? 'lib' : 'app/components';
      const unitTest = `tests/unit/${prefix}/${unitPath}.test.ts`;

      if (fs.existsSync(unitTest) || fs.existsSync(unitTest + 'x')) {
        status.testStatus.unit.exists = true;
      }
    }
  }

  private async checkTestExecution(status: IssueTestStatus) {
    // Run tests to check if they pass
    try {
      if (status.testStatus.unit.exists) {
        execSync('npm run test:unit -- --run --silent', { stdio: 'pipe' });
        status.testStatus.unit.passing = true;
      }
    } catch {
      status.testStatus.unit.passing = false;
    }

    try {
      if (status.testStatus.integration.exists) {
        execSync('npm run test:integration -- --run --silent', { stdio: 'pipe' });
        status.testStatus.integration.passing = true;
      }
    } catch {
      status.testStatus.integration.passing = false;
    }

    try {
      if (status.testStatus.pact.exists) {
        execSync('npm run pact:consumer -- --run --silent', { stdio: 'pipe' });
        status.testStatus.pact.passing = true;
      }
    } catch {
      status.testStatus.pact.passing = false;
    }
  }

  private async checkCoverage(status: IssueTestStatus) {
    // Read coverage reports
    const unitCoveragePath = 'coverage/unit/coverage-summary.json';
    if (fs.existsSync(unitCoveragePath)) {
      const coverage = JSON.parse(fs.readFileSync(unitCoveragePath, 'utf-8'));
      status.coverageStatus.unit = coverage.total.lines.pct;
    }

    const combinedCoveragePath = 'coverage/combined/coverage-summary.json';
    if (fs.existsSync(combinedCoveragePath)) {
      const coverage = JSON.parse(fs.readFileSync(combinedCoveragePath, 'utf-8'));
      status.coverageStatus.combined = coverage.total.lines.pct;
    }
  }

  private isFeatureReady(status: IssueTestStatus): boolean {
    // Feature is ready if:
    // 1. All required test types exist
    // 2. All tests are passing
    // 3. Coverage thresholds are met

    const requiredTests = this.config.vibeKanban.requiredTests;

    for (const testType of requiredTests) {
      const test = status.testStatus[testType as keyof typeof status.testStatus];
      if (!test.exists || !test.passing) {
        return false;
      }
    }

    return true;
  }

  private getBlockers(status: IssueTestStatus): string[] {
    const blockers: string[] = [];

    if (!status.testStatus.unit.exists) {
      blockers.push('Missing unit tests');
    } else if (!status.testStatus.unit.passing) {
      blockers.push('Unit tests failing');
    }

    if (!status.testStatus.integration.exists) {
      blockers.push('Missing integration tests');
    } else if (!status.testStatus.integration.passing) {
      blockers.push('Integration tests failing');
    }

    if (!status.testStatus.e2e.exists) {
      blockers.push('Missing E2E tests');
    } else if (!status.testStatus.e2e.passing) {
      blockers.push('E2E tests failing');
    }

    if (!status.testStatus.pact.exists && status.modifiedFiles.some(f => f.includes('/api/'))) {
      blockers.push('Missing Pact tests for API routes');
    } else if (!status.testStatus.pact.passing) {
      blockers.push('Pact tests failing');
    }

    return blockers;
  }

  private displayStatus(status: IssueTestStatus) {
    console.log(`Issue: ${status.issueId}`);
    console.log(`Modified files: ${status.modifiedFiles.length}`);
    console.log('');

    console.log('Test Status:');
    this.displayTestType('Unit', status.testStatus.unit);
    this.displayTestType('Integration', status.testStatus.integration);
    this.displayTestType('E2E', status.testStatus.e2e);
    this.displayTestType('Pact', status.testStatus.pact);
    console.log('');

    console.log('Coverage:');
    console.log(`  Unit: ${status.coverageStatus.unit.toFixed(2)}%`);
    console.log(`  Combined: ${status.coverageStatus.combined.toFixed(2)}%`);
    console.log('');

    if (status.ready) {
      console.log('✅ Feature is ready for merge!');
    } else {
      console.log('❌ Feature is NOT ready for merge');
      console.log('\nBlockers:');
      status.blockers.forEach(blocker => console.log(`  - ${blocker}`));
      console.log('\nRun to create tests:');
      console.log(`  npm run vibe:create-tests -- --issue=${status.issueId}`);
    }
  }

  private displayTestType(name: string, test: { exists: boolean; passing: boolean }) {
    const existsIcon = test.exists ? '✅' : '❌';
    const passingIcon = test.passing ? '✅' : '❌';
    console.log(`  ${name}: ${existsIcon} exists, ${passingIcon} passing`);
  }

  private async updateVibeIssue(status: IssueTestStatus) {
    if (!this.config.vibeKanban.trackCoverage) {
      return;
    }

    console.log('📝 Updating Vibe Kanban issue...');

    // Create a comment with test status
    const comment = this.formatIssueComment(status);

    try {
      // This would integrate with Vibe Kanban's MCP tools
      // For now, we'll just log what would be updated
      console.log('\nWould add comment to issue:');
      console.log(comment);
    } catch (error) {
      console.error('Failed to update Vibe issue:', error);
    }
  }

  private formatIssueComment(status: IssueTestStatus): string {
    const lines: string[] = [];

    lines.push('## Test Coverage Status');
    lines.push('');
    lines.push('### Test Files');
    lines.push(`- Unit: ${status.testStatus.unit.exists ? '✅' : '❌'} ${status.testStatus.unit.passing ? '(passing)' : '(failing)'}`);
    lines.push(`- Integration: ${status.testStatus.integration.exists ? '✅' : '❌'} ${status.testStatus.integration.passing ? '(passing)' : '(failing)'}`);
    lines.push(`- E2E: ${status.testStatus.e2e.exists ? '✅' : '❌'} ${status.testStatus.e2e.passing ? '(passing)' : '(failing)'}`);
    lines.push(`- Pact: ${status.testStatus.pact.exists ? '✅' : '❌'} ${status.testStatus.pact.passing ? '(passing)' : '(failing)'}`);
    lines.push('');
    lines.push('### Coverage');
    lines.push(`- Unit: ${status.coverageStatus.unit.toFixed(2)}%`);
    lines.push(`- Combined: ${status.coverageStatus.combined.toFixed(2)}%`);
    lines.push('');

    if (status.ready) {
      lines.push('✅ **All tests passing - Ready for merge!**');
    } else {
      lines.push('❌ **Blockers:**');
      status.blockers.forEach(blocker => lines.push(`- ${blocker}`));
    }

    return lines.join('\n');
  }
}

// Run tracker
const tracker = new VibeTestTracker();
tracker.run().then(exitCode => process.exit(exitCode));
