export interface TestResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failedTestNames: string[];
  coveragePercent?: number;
}

// Parse Vitest JSON reporter output
export function parseVitestResults(json: unknown): TestResults {
  const data = json as {
    numTotalTests?: number;
    numPassedTests?: number;
    numFailedTests?: number;
    testResults?: Array<{
      assertionResults?: Array<{
        status: string;
        fullName: string;
        ancestorTitles?: string[];
        title: string;
      }>;
    }>;
  };

  const failedTestNames: string[] = [];

  if (data.testResults) {
    for (const suite of data.testResults) {
      if (suite.assertionResults) {
        for (const test of suite.assertionResults) {
          if (test.status === "failed") {
            failedTestNames.push(test.fullName || test.title);
          }
        }
      }
    }
  }

  return {
    totalTests: data.numTotalTests ?? 0,
    passedTests: data.numPassedTests ?? 0,
    failedTests: data.numFailedTests ?? 0,
    failedTestNames,
  };
}

// Parse Playwright JSON reporter output
export function parsePlaywrightResults(json: unknown): TestResults {
  const data = json as {
    stats?: {
      expected: number;
      unexpected: number;
      flaky: number;
      skipped: number;
    };
    suites?: Array<PlaywrightSuite>;
  };

  const failedTestNames: string[] = [];

  function walkSuite(suite: PlaywrightSuite, path: string[] = []) {
    const suitePath = suite.title ? [...path, suite.title] : path;

    if (suite.specs) {
      for (const spec of suite.specs) {
        const hasFailure = spec.tests?.some((t) =>
          t.results?.some((r) => r.status === "unexpected" || r.status === "failed")
        );
        if (hasFailure) {
          failedTestNames.push([...suitePath, spec.title].join(" > "));
        }
      }
    }

    if (suite.suites) {
      for (const child of suite.suites) {
        walkSuite(child, suitePath);
      }
    }
  }

  if (data.suites) {
    for (const suite of data.suites) {
      walkSuite(suite);
    }
  }

  const stats = data.stats ?? { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  const total = stats.expected + stats.unexpected + stats.flaky;

  return {
    totalTests: total,
    passedTests: stats.expected,
    failedTests: stats.unexpected,
    failedTestNames,
  };
}

interface PlaywrightSuite {
  title?: string;
  suites?: PlaywrightSuite[];
  specs?: Array<{
    title: string;
    tests?: Array<{
      results?: Array<{ status: string }>;
    }>;
  }>;
}
