import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { createChildLogger } from "../utils/logger.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const log = createChildLogger("db");

let db: ReturnType<typeof drizzle<typeof schema>>;

export function initDb(databasePath: string) {
  mkdirSync(dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  db = drizzle(sqlite, { schema });

  // Run inline migrations (create tables if not exist)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id TEXT PRIMARY KEY,
      pr_number INTEGER NOT NULL,
      branch TEXT NOT NULL,
      target_branch TEXT NOT NULL,
      commit_sha TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'CREATED',
      previous_state TEXT,
      vk_issue_id TEXT,
      fix_cycle_count INTEGER NOT NULL DEFAULT 0,
      max_fix_cycles INTEGER NOT NULL DEFAULT 3,
      error_message TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS state_transitions (
      id TEXT PRIMARY KEY,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
      from_state TEXT NOT NULL,
      to_state TEXT NOT NULL,
      trigger TEXT NOT NULL,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gate_results (
      id TEXT PRIMARY KEY,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
      gate_name TEXT NOT NULL,
      outcome TEXT NOT NULL,
      workflow_run_id INTEGER,
      total_tests INTEGER,
      passed_tests INTEGER,
      failed_tests INTEGER,
      failed_test_names TEXT,
      coverage_percent INTEGER,
      severity TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
      agent_type TEXT NOT NULL,
      vk_workspace_id TEXT,
      cycle_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'launched',
      trigger_gate TEXT,
      fix_commit_sha TEXT,
      launched_at TEXT NOT NULL,
      completed_at TEXT,
      timeout_at TEXT
    );

    CREATE TABLE IF NOT EXISTS defect_issues (
      id TEXT PRIMARY KEY,
      pipeline_run_id TEXT NOT NULL REFERENCES pipeline_runs(id),
      vk_issue_id TEXT NOT NULL,
      gate_name TEXT NOT NULL,
      failed_tests TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_pr ON pipeline_runs(pr_number);
    CREATE INDEX IF NOT EXISTS idx_pipeline_runs_state ON pipeline_runs(state);
    CREATE INDEX IF NOT EXISTS idx_state_transitions_run ON state_transitions(pipeline_run_id);
    CREATE INDEX IF NOT EXISTS idx_gate_results_run ON gate_results(pipeline_run_id);
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_run ON agent_sessions(pipeline_run_id);
    CREATE INDEX IF NOT EXISTS idx_defect_issues_run ON defect_issues(pipeline_run_id);
  `);

  log.info({ path: databasePath }, "Database initialized");
  return db;
}

export function getDb() {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}
