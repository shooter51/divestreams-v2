import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const pipelineRuns = sqliteTable("pipeline_runs", {
  id: text("id").primaryKey(), // nanoid
  prNumber: integer("pr_number").notNull(),
  branch: text("branch").notNull(),
  targetBranch: text("target_branch").notNull(),
  commitSha: text("commit_sha").notNull(),
  state: text("state").notNull().default("CREATED"),
  previousState: text("previous_state"),
  vkIssueId: text("vk_issue_id"),
  fixCycleCount: integer("fix_cycle_count").notNull().default(0),
  maxFixCycles: integer("max_fix_cycles").notNull().default(3),
  errorMessage: text("error_message"),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const stateTransitions = sqliteTable("state_transitions", {
  id: text("id").primaryKey(), // nanoid
  pipelineRunId: text("pipeline_run_id")
    .notNull()
    .references(() => pipelineRuns.id),
  fromState: text("from_state").notNull(),
  toState: text("to_state").notNull(),
  trigger: text("trigger").notNull(),
  metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const gateResults = sqliteTable("gate_results", {
  id: text("id").primaryKey(), // nanoid
  pipelineRunId: text("pipeline_run_id")
    .notNull()
    .references(() => pipelineRuns.id),
  gateName: text("gate_name").notNull(),
  outcome: text("outcome").notNull(), // pass | non_critical_fail | critical_fail
  workflowRunId: integer("workflow_run_id"),
  totalTests: integer("total_tests"),
  passedTests: integer("passed_tests"),
  failedTests: integer("failed_tests"),
  failedTestNames: text("failed_test_names", { mode: "json" }).$type<
    string[]
  >(),
  coveragePercent: integer("coverage_percent"),
  severity: text("severity"), // critical | non_critical
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const agentSessions = sqliteTable("agent_sessions", {
  id: text("id").primaryKey(), // nanoid
  pipelineRunId: text("pipeline_run_id")
    .notNull()
    .references(() => pipelineRuns.id),
  agentType: text("agent_type").notNull(), // fix | judge
  vkWorkspaceId: text("vk_workspace_id"),
  cycleNumber: integer("cycle_number").notNull(),
  status: text("status").notNull().default("launched"), // launched | working | completed | failed | timeout
  triggerGate: text("trigger_gate"),
  fixCommitSha: text("fix_commit_sha"),
  launchedAt: text("launched_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  completedAt: text("completed_at"),
  timeoutAt: text("timeout_at"),
});

export const defectIssues = sqliteTable("defect_issues", {
  id: text("id").primaryKey(), // nanoid
  pipelineRunId: text("pipeline_run_id")
    .notNull()
    .references(() => pipelineRuns.id),
  vkIssueId: text("vk_issue_id").notNull(),
  gateName: text("gate_name").notNull(),
  failedTests: text("failed_tests", { mode: "json" }).$type<string[]>(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Type exports
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type NewPipelineRun = typeof pipelineRuns.$inferInsert;
export type StateTransition = typeof stateTransitions.$inferSelect;
export type GateResult = typeof gateResults.$inferSelect;
export type AgentSession = typeof agentSessions.$inferSelect;
export type DefectIssue = typeof defectIssues.$inferSelect;
