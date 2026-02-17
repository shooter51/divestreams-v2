import { describe, it, expect } from "vitest";
import { parseVitestResults, parsePlaywrightResults } from "./github-check.js";

describe("parseVitestResults", () => {
  it("parses passing results", () => {
    const json = {
      numTotalTests: 10,
      numPassedTests: 10,
      numFailedTests: 0,
      testResults: [],
    };

    const result = parseVitestResults(json);
    expect(result.totalTests).toBe(10);
    expect(result.passedTests).toBe(10);
    expect(result.failedTests).toBe(0);
    expect(result.failedTestNames).toEqual([]);
  });

  it("parses failing results with test names", () => {
    const json = {
      numTotalTests: 5,
      numPassedTests: 3,
      numFailedTests: 2,
      testResults: [
        {
          assertionResults: [
            { status: "passed", fullName: "auth > should login", title: "should login" },
            { status: "failed", fullName: "auth > should validate token", title: "should validate token" },
            { status: "failed", fullName: "booking > should create", title: "should create" },
          ],
        },
      ],
    };

    const result = parseVitestResults(json);
    expect(result.failedTests).toBe(2);
    expect(result.failedTestNames).toEqual([
      "auth > should validate token",
      "booking > should create",
    ]);
  });

  it("handles empty results", () => {
    const result = parseVitestResults({});
    expect(result.totalTests).toBe(0);
    expect(result.failedTestNames).toEqual([]);
  });
});

describe("parsePlaywrightResults", () => {
  it("parses passing results", () => {
    const json = {
      stats: { expected: 15, unexpected: 0, flaky: 0, skipped: 2 },
      suites: [],
    };

    const result = parsePlaywrightResults(json);
    expect(result.totalTests).toBe(15);
    expect(result.passedTests).toBe(15);
    expect(result.failedTests).toBe(0);
  });

  it("parses failures from nested suites", () => {
    const json = {
      stats: { expected: 3, unexpected: 1, flaky: 0, skipped: 0 },
      suites: [
        {
          title: "Booking",
          suites: [
            {
              title: "Create",
              specs: [
                {
                  title: "should save booking",
                  tests: [{ results: [{ status: "expected" }] }],
                },
                {
                  title: "should validate form",
                  tests: [{ results: [{ status: "unexpected" }] }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parsePlaywrightResults(json);
    expect(result.failedTests).toBe(1);
    expect(result.failedTestNames).toEqual(["Booking > Create > should validate form"]);
  });

  it("handles empty results", () => {
    const result = parsePlaywrightResults({});
    expect(result.totalTests).toBe(0);
    expect(result.failedTestNames).toEqual([]);
  });
});
