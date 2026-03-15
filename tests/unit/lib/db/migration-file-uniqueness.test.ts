/**
 * TDD: Verify migration file names have unique numeric prefixes
 *
 * Duplicate migration prefixes (e.g. two files starting with 0037_)
 * cause ambiguity in the migration runner and must not exist.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const drizzleDir = path.resolve(process.cwd(), "drizzle");
const journalPath = path.resolve(drizzleDir, "meta", "_journal.json");

describe("Migration file uniqueness", () => {
  it("should have no duplicate numeric prefixes among .sql files", () => {
    const files = fs
      .readdirSync(drizzleDir)
      .filter((f) => f.endsWith(".sql"));

    // Extract the leading numeric prefix (e.g. "0037" from "0037_add_something.sql")
    const prefixes = files.map((f) => f.match(/^(\d+)_/)?.[1]).filter(Boolean) as string[];

    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const prefix of prefixes) {
      if (seen.has(prefix)) {
        duplicates.push(prefix);
      } else {
        seen.add(prefix);
      }
    }

    expect(duplicates, `Duplicate migration prefixes found: ${duplicates.join(", ")}`).toHaveLength(0);
  });

  it("should have all journal tags referencing existing migration files", () => {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

    const missingFiles: string[] = [];
    for (const entry of journal.entries) {
      const filePath = path.join(drizzleDir, `${entry.tag}.sql`);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(entry.tag);
      }
    }

    expect(
      missingFiles,
      `Journal references missing migration files: ${missingFiles.join(", ")}`
    ).toHaveLength(0);
  });

  it("should have no duplicate tags in the journal", () => {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

    const tags = journal.entries.map((e: { tag: string }) => e.tag);
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const tag of tags) {
      if (seen.has(tag)) {
        duplicates.push(tag);
      } else {
        seen.add(tag);
      }
    }

    expect(duplicates, `Duplicate journal tags: ${duplicates.join(", ")}`).toHaveLength(0);
  });

  it("should have no .sql files with the same numeric prefix as a journal-referenced file", () => {
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
    const journalTags = new Set(journal.entries.map((e: { tag: string }) => e.tag));

    const allSqlFiles = fs
      .readdirSync(drizzleDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""));

    // For each .sql file NOT in the journal, check if its numeric prefix
    // conflicts with a file that IS in the journal
    const orphanedWithConflict: string[] = [];
    for (const fileTag of allSqlFiles) {
      if (journalTags.has(fileTag)) continue; // in journal, fine

      const prefix = fileTag.match(/^(\d+)_/)?.[1];
      if (!prefix) continue;

      // Check if any journal tag starts with the same prefix
      for (const journalTag of journalTags) {
        if ((journalTag as string).startsWith(`${prefix}_`)) {
          orphanedWithConflict.push(`${fileTag} conflicts with journal entry ${journalTag}`);
          break;
        }
      }
    }

    expect(
      orphanedWithConflict,
      `Orphaned migration files with duplicate prefixes: ${orphanedWithConflict.join("; ")}`
    ).toHaveLength(0);
  });
});
