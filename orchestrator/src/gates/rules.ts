export interface SeverityRule {
  pattern: RegExp;
  severity: "critical" | "non_critical";
  description: string;
}

// Default rules — tests matching "critical" patterns block the pipeline.
// Tests matching "non_critical" patterns create defect issues but continue.
// Unmatched tests default to critical (safer).
export const defaultRules: SeverityRule[] = [
  // Critical: auth, security, data integrity
  {
    pattern: /auth|login|session|permission|rbac|security/i,
    severity: "critical",
    description: "Authentication/authorization tests",
  },
  {
    pattern: /migration|schema|database|constraint/i,
    severity: "critical",
    description: "Database/migration tests",
  },
  {
    pattern: /payment|stripe|billing|subscription/i,
    severity: "critical",
    description: "Payment/billing tests",
  },
  {
    pattern: /csrf|xss|injection|sanitiz/i,
    severity: "critical",
    description: "Security tests",
  },
  {
    pattern: /booking\.create|booking\.cancel|reservation/i,
    severity: "critical",
    description: "Core booking flow tests",
  },
  {
    pattern: /tenant|multi-tenant|organization/i,
    severity: "critical",
    description: "Multi-tenancy isolation tests",
  },

  // Non-critical: UI, styling, cosmetic
  {
    pattern: /snapshot|visual|screenshot|appearance/i,
    severity: "non_critical",
    description: "Visual/snapshot tests",
  },
  {
    pattern: /tooltip|animation|hover|focus.*style/i,
    severity: "non_critical",
    description: "UI interaction tests",
  },
  {
    pattern: /accessibility|a11y|aria/i,
    severity: "non_critical",
    description: "Accessibility tests",
  },
  {
    pattern: /dark.?mode|theme|color.?scheme/i,
    severity: "non_critical",
    description: "Theme/styling tests",
  },
];

export function classifyTestFailure(
  testName: string,
  rules: SeverityRule[] = defaultRules
): "critical" | "non_critical" {
  // Check non-critical patterns first (explicit override)
  for (const rule of rules) {
    if (rule.severity === "non_critical" && rule.pattern.test(testName)) {
      return "non_critical";
    }
  }

  // Check critical patterns
  for (const rule of rules) {
    if (rule.severity === "critical" && rule.pattern.test(testName)) {
      return "critical";
    }
  }

  // Default to critical when uncertain
  return "critical";
}
