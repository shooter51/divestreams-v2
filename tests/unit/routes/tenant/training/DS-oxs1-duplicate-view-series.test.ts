/**
 * DS-oxs1: Two "View Series" buttons on training dashboard page
 *
 * The training dashboard had duplicate "View Series" links in the header nav
 * and duplicate "New Series" / "Create Series" links in Quick Actions.
 * This test verifies that each link to /tenant/training/series appears
 * exactly once in the appropriate section.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const sourceFile = resolve(
  __dirname,
  "../../../../../app/routes/tenant/training/index.tsx"
);

describe("DS-oxs1: no duplicate View Series button on training page", () => {
  const source = readFileSync(sourceFile, "utf-8");

  it("should have exactly one link to /tenant/training/series in the header nav buttons", () => {
    // Count how many <Link to="/tenant/training/series"> appear (exact route, not /series/new)
    const seriesLinkPattern = /to="\/tenant\/training\/series"/g;
    const seriesNewPattern = /to="\/tenant\/training\/series\/new"/g;

    const allSeriesLinks = source.match(seriesLinkPattern) || [];
    const newSeriesLinks = source.match(seriesNewPattern) || [];

    // Total links to /tenant/training/series (not /new) = all matches minus /new matches
    // But since the regex is exact, /series" won't match /series/new"
    // So allSeriesLinks counts only exact /series links
    // We expect: 1 in header nav + 1 in StatCard linkTo prop = 2 max
    // The StatCard uses linkTo="/tenant/training/series" as a prop, not <Link to=
    const headerNavLinks = allSeriesLinks.length;

    // There should be at most 2: one Link in nav, one linkTo in StatCard
    // But specifically, the nav section should have exactly 1 Link to /series
    expect(headerNavLinks).toBeLessThanOrEqual(2);
    // And the direct <Link to="/tenant/training/series"> should appear exactly once
    // (the StatCard linkTo is a prop, not a <Link to= pattern)
    const directLinks = (source.match(/<Link[\s\S]*?to="\/tenant\/training\/series"[\s\S]*?>/g) || []);
    expect(directLinks.length).toBe(1);
  });

  it("should have exactly one quick action link to /tenant/training/series/new", () => {
    const newSeriesLinks = (source.match(/<Link[\s\S]*?to="\/tenant\/training\/series\/new"[\s\S]*?>/g) || []);
    expect(newSeriesLinks.length).toBe(1);
  });
});
