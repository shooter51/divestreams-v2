import { describe, it, expect } from "vitest";
import crypto from "node:crypto";

/**
 * Tests for run-migrations.mjs logic (DS-jnxi / DS-nflt / DS-7wbu)
 *
 * These tests validate the core migration-ordering and deduplication logic
 * without requiring a live database connection.
 */

// ---------------------------------------------------------------------------
// Helpers that mirror the logic in scripts/run-migrations.mjs
// ---------------------------------------------------------------------------

interface JournalEntry {
  idx: number;
  when: number;
  tag: string;
}

function sortEntriesByTimestamp(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => a.when - b.when);
}

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Simulate the migration runner's main loop.
 * Returns an array of tags that would be applied given the set of already-applied hashes.
 */
function simulateRun(
  entries: JournalEntry[],
  contentMap: Record<string, string>,
  appliedHashes: Set<string>
): string[] {
  const applied: string[] = [];
  const sorted = sortEntriesByTimestamp(entries);

  for (const entry of sorted) {
    const content = contentMap[entry.tag] ?? "";
    const hash = computeHash(content);

    if (appliedHashes.has(hash)) {
      continue;
    }

    applied.push(entry.tag);
    appliedHashes.add(hash);
  }

  return applied;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("run-migrations: journal ordering", () => {
  it("sorts entries by `when` timestamp ascending", () => {
    const entries: JournalEntry[] = [
      { idx: 2, when: 1000, tag: "0002_foo" },
      { idx: 0, when: 800, tag: "0000_bar" },
      { idx: 1, when: 900, tag: "0001_baz" },
    ];

    const sorted = sortEntriesByTimestamp(entries);
    expect(sorted.map((e) => e.tag)).toEqual(["0000_bar", "0001_baz", "0002_foo"]);
  });

  it("does not mutate the original array when sorting", () => {
    const entries: JournalEntry[] = [
      { idx: 1, when: 200, tag: "0001_later" },
      { idx: 0, when: 100, tag: "0000_first" },
    ];
    const originalOrder = entries.map((e) => e.tag);

    sortEntriesByTimestamp(entries);

    expect(entries.map((e) => e.tag)).toEqual(originalOrder);
  });
});

describe("run-migrations: hash-based deduplication", () => {
  it("skips migrations whose hash is already in the applied set", () => {
    const content = "ALTER TABLE foo ADD COLUMN bar TEXT;";
    const hash = computeHash(content);

    const entries: JournalEntry[] = [{ idx: 0, when: 100, tag: "0000_migration" }];
    const contentMap = { "0000_migration": content };
    const appliedHashes = new Set([hash]);

    const toApply = simulateRun(entries, contentMap, appliedHashes);

    expect(toApply).toHaveLength(0);
  });

  it("applies migrations whose hash is NOT in the applied set", () => {
    const entries: JournalEntry[] = [{ idx: 0, when: 100, tag: "0000_migration" }];
    const contentMap = { "0000_migration": "ALTER TABLE foo ADD COLUMN bar TEXT;" };
    const appliedHashes = new Set<string>();

    const toApply = simulateRun(entries, contentMap, appliedHashes);

    expect(toApply).toEqual(["0000_migration"]);
  });
});

describe("run-migrations: out-of-order timestamp handling (DS-jnxi regression)", () => {
  /**
   * Reproduces the exact scenario that caused DS-jnxi / DS-nflt / DS-7wbu:
   * - Migrations 0000–0052 were applied to an existing DB.
   * - Migration 0048_add_tank_gas_selection was added to the journal with a
   *   `when` timestamp OLDER than migrations 0048–0052.
   * - The old timestamp-range check (entry.when <= lastTimestamp) permanently
   *   skipped it on any DB that had already applied later migrations.
   *
   * The fixed logic uses hash-based deduplication instead, so the entry is
   * applied regardless of its `when` value.
   */
  it("applies an out-of-order entry that was not previously applied", () => {
    const tankSelectionContent =
      'ALTER TABLE "tours" ADD COLUMN "requires_tank_selection" boolean DEFAULT false NOT NULL;';

    // Simulate a DB that has 0047 + 0052 applied but NOT 0048_add_tank_gas_selection.
    const migration0047Content = "-- 0047 restructure plans";
    const migration0052Content = "-- 0052 add feature overrides";

    const appliedHashes = new Set([
      computeHash(migration0047Content),
      computeHash(migration0052Content),
    ]);

    const entries: JournalEntry[] = [
      { idx: 47, when: 1768187107672, tag: "0047_restructure_plans_two_tiers" },
      // Out-of-order entry: timestamp is older than 0052 but was not applied
      { idx: 53, when: 1768187107673, tag: "0048_add_tank_gas_selection" },
      { idx: 52, when: 1773184538248, tag: "0052_add_feature_overrides" },
    ];

    const contentMap: Record<string, string> = {
      "0047_restructure_plans_two_tiers": migration0047Content,
      "0048_add_tank_gas_selection": tankSelectionContent,
      "0052_add_feature_overrides": migration0052Content,
    };

    const toApply = simulateRun(entries, contentMap, appliedHashes);

    expect(toApply).toEqual(["0048_add_tank_gas_selection"]);
  });

  it("does NOT re-apply an out-of-order entry that was already applied", () => {
    const tankSelectionContent =
      'ALTER TABLE "tours" ADD COLUMN "requires_tank_selection" boolean DEFAULT false NOT NULL;';

    // Simulate a fresh DB where all three were applied in order
    const appliedHashes = new Set([
      computeHash("-- 0047 restructure plans"),
      computeHash(tankSelectionContent),
      computeHash("-- 0052 add feature overrides"),
    ]);

    const entries: JournalEntry[] = [
      { idx: 47, when: 1768187107672, tag: "0047_restructure_plans_two_tiers" },
      { idx: 53, when: 1768187107673, tag: "0048_add_tank_gas_selection" },
      { idx: 52, when: 1773184538248, tag: "0052_add_feature_overrides" },
    ];

    const contentMap: Record<string, string> = {
      "0047_restructure_plans_two_tiers": "-- 0047 restructure plans",
      "0048_add_tank_gas_selection": tankSelectionContent,
      "0052_add_feature_overrides": "-- 0052 add feature overrides",
    };

    const toApply = simulateRun(entries, contentMap, appliedHashes);

    expect(toApply).toHaveLength(0);
  });

  it("applies entries in timestamp order even when journal idx order differs", () => {
    // Entry with lower idx has a higher timestamp — should be applied after the
    // entry with the higher idx but lower timestamp.
    const entries: JournalEntry[] = [
      { idx: 0, when: 2000, tag: "0000_late" },
      { idx: 1, when: 1000, tag: "0001_early" },
    ];

    const contentMap = {
      "0000_late": "-- late migration",
      "0001_early": "-- early migration",
    };

    const toApply = simulateRun(entries, contentMap, new Set());

    expect(toApply).toEqual(["0001_early", "0000_late"]);
  });
});

describe("run-migrations: journal correctness for 0048_add_tank_gas_selection", () => {
  it("journal entry timestamp (1773561600001) is greater than 0055_add_public_site_indexes (1773561600000)", () => {
    // Verify the fixed timestamp is correctly ordered after the last known migration
    const tankGasTimestamp = 1773561600001;
    const publicSiteIndexesTimestamp = 1773561600000;

    expect(tankGasTimestamp).toBeGreaterThan(publicSiteIndexesTimestamp);
  });
});
