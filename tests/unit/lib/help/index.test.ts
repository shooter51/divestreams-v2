/**
 * Unit tests for lib/help/index.ts
 *
 * Tests the article loader, frontmatter parser, and keyword search.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock fs module ───────────────────────────────────────────────────────────
// vi.hoisted runs before imports and vi.mock factories — use it to define
// shared mock functions that the factory can safely reference.
const { mockReadFileSyncFn, mockReaddirSyncFn, mockStatSyncFn } = vi.hoisted(() => ({
  mockReadFileSyncFn: vi.fn(),
  mockReaddirSyncFn: vi.fn(),
  mockStatSyncFn: vi.fn(),
}));

// node:fs needs a `default` export in ESM vitest mocks.
vi.mock("node:fs", () => ({
  default: {
    readFileSync: mockReadFileSyncFn,
    readdirSync: mockReaddirSyncFn,
    statSync: mockStatSyncFn,
  },
  readFileSync: mockReadFileSyncFn,
  readdirSync: mockReaddirSyncFn,
  statSync: mockStatSyncFn,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import {
  loadHelpArticles,
  resetHelpArticleCache,
  searchRelevantArticles,
  type HelpArticle,
} from "../../../../lib/help/index";

const mockReadFileSync = mockReadFileSyncFn;
const mockReaddirSync = mockReaddirSyncFn;
const mockStatSync = mockStatSyncFn;

const CWD = process.cwd();
const HELP_DIR = `${CWD}/docs/help`;

function makeArticle(overrides: Partial<HelpArticle> = {}): HelpArticle {
  return {
    title: "Test Article",
    category: "General",
    tags: [],
    order: 0,
    content: "Some content about bookings",
    path: "docs/help/test.md",
    ...overrides,
  };
}

describe("loadHelpArticles", () => {
  beforeEach(() => {
    resetHelpArticleCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetHelpArticleCache();
  });

  it("returns empty array when docs/help directory does not exist", () => {
    const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    mockReaddirSync.mockImplementation(() => { throw err; });
    const articles = loadHelpArticles();
    expect(articles).toEqual([]);
  });

  it("returns empty array when docs/help directory is empty", () => {
    mockReaddirSync.mockReturnValue([] as never);
    const articles = loadHelpArticles();
    expect(articles).toEqual([]);
  });

  it("loads a single article with frontmatter", () => {
    const filePath = `${HELP_DIR}/bookings.md`;
    mockReaddirSync.mockImplementation((dir: unknown) => {
      if (dir === HELP_DIR) return ["bookings.md"] as never;
      return [] as never;
    });
    mockStatSync.mockImplementation((p: unknown) => {
      if (p === filePath) return { isDirectory: () => false } as never;
      throw new Error("ENOENT");
    });
    mockReadFileSync.mockImplementation((p: unknown) => {
      if (p === filePath) {
        return `---\ntitle: Managing Bookings\ncategory: Bookings\ntags: [bookings, reservations]\norder: 1\n---\nTo create a booking, navigate to the Bookings page.\n`;
      }
      throw new Error("ENOENT");
    });

    const articles = loadHelpArticles();
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Managing Bookings");
    expect(articles[0].category).toBe("Bookings");
    expect(articles[0].tags).toEqual(["bookings", "reservations"]);
    expect(articles[0].order).toBe(1);
    expect(articles[0].content).toContain("To create a booking");
    expect(articles[0].path).toContain("bookings.md");
  });

  it("uses filename as fallback title when frontmatter title is absent", () => {
    const filePath = `${HELP_DIR}/equipment-rentals.md`;
    mockReaddirSync.mockImplementation((dir: unknown) => {
      if (dir === HELP_DIR) return ["equipment-rentals.md"] as never;
      return [] as never;
    });
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockReturnValue("# Equipment Rentals\n\nContent here." as never);

    const articles = loadHelpArticles();
    expect(articles[0].title).toBe("equipment rentals");
  });

  it("recurses into subdirectories", () => {
    const subDir = `${HELP_DIR}/advanced`;
    const filePath = `${subDir}/reporting.md`;
    mockReaddirSync.mockImplementation((dir: unknown) => {
      if (dir === HELP_DIR) return ["advanced"] as never;
      if (dir === subDir) return ["reporting.md"] as never;
      return [] as never;
    });
    mockStatSync.mockImplementation((p: unknown) => {
      if (p === `${HELP_DIR}/advanced`) return { isDirectory: () => true } as never;
      if (p === filePath) return { isDirectory: () => false } as never;
      throw new Error("ENOENT");
    });
    mockReadFileSync.mockReturnValue(`---\ntitle: Reporting\ncategory: Reports\ntags: [reports]\norder: 1\n---\nReport content.\n` as never);

    const articles = loadHelpArticles();
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Reporting");
  });

  it("skips non-.md files", () => {
    const filePath = `${HELP_DIR}/article.md`;
    mockReaddirSync.mockImplementation((dir: unknown) => {
      if (dir === HELP_DIR) return ["image.png", "notes.txt", "article.md"] as never;
      return [] as never;
    });
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockImplementation((p: unknown) => {
      if (p === filePath) return "# Article\nContent." as never;
      throw new Error("ENOENT");
    });

    const articles = loadHelpArticles();
    expect(articles).toHaveLength(1);
  });

  it("returns cached result on second call", async () => {
    mockReaddirSync.mockReturnValue([] as never);

    loadHelpArticles();
    loadHelpArticles();

    expect(mockReaddirSync).toHaveBeenCalledTimes(1);
  });

  it("sorts articles by category then order", () => {
    mockReaddirSync.mockImplementation((dir: unknown) => {
      if (dir === HELP_DIR) return ["z-tours.md", "a-bookings.md", "a-bookings2.md"] as never;
      return [] as never;
    });
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.includes("z-tours")) return `---\ntitle: Tours Overview\ncategory: Tours\norder: 1\ntags: []\n---\nContent.` as never;
      if (path.includes("a-bookings.md")) return `---\ntitle: Booking Basics\ncategory: Bookings\norder: 2\ntags: []\n---\nContent.` as never;
      if (path.includes("a-bookings2")) return `---\ntitle: Advanced Bookings\ncategory: Bookings\norder: 1\ntags: []\n---\nContent.` as never;
      throw new Error("ENOENT");
    });

    const articles = loadHelpArticles();
    expect(articles[0].title).toBe("Advanced Bookings"); // Bookings, order 1
    expect(articles[1].title).toBe("Booking Basics");    // Bookings, order 2
    expect(articles[2].title).toBe("Tours Overview");    // Tours
  });

  it("gracefully skips unreadable files", () => {
    mockReaddirSync.mockImplementation((dir: unknown) => {
      if (dir === HELP_DIR) return ["good.md", "bad.md"] as never;
      return [] as never;
    });
    mockStatSync.mockReturnValue({ isDirectory: () => false } as never);
    mockReadFileSync.mockImplementation((p: unknown) => {
      const path = String(p);
      if (path.includes("good.md")) return `---\ntitle: Good\ncategory: General\ntags: []\norder: 0\n---\nOK.` as never;
      throw new Error("ENOENT: file not found");
    });

    const articles = loadHelpArticles();
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Good");
  });
});

describe("searchRelevantArticles", () => {
  const articles: HelpArticle[] = [
    makeArticle({
      title: "Creating Bookings",
      category: "Bookings",
      tags: ["bookings", "reservations"],
      content: "To create a booking go to the Bookings page and click New Booking.",
      path: "docs/help/bookings.md",
    }),
    makeArticle({
      title: "Managing Equipment",
      category: "Equipment",
      tags: ["equipment", "rentals", "gear"],
      content: "Equipment rentals can be managed from the Equipment section.",
      path: "docs/help/equipment.md",
    }),
    makeArticle({
      title: "Tour Setup",
      category: "Tours",
      tags: ["tours", "trips"],
      content: "Set up your dive tours from the Tours menu.",
      path: "docs/help/tours.md",
    }),
    makeArticle({
      title: "Customer Management",
      category: "Customers",
      tags: ["customers", "divers"],
      content: "Manage your customer list in the Customers section.",
      path: "docs/help/customers.md",
    }),
    makeArticle({
      title: "Settings Overview",
      category: "Settings",
      tags: ["settings", "configuration"],
      content: "Access settings from the gear icon in the top navigation.",
      path: "docs/help/settings.md",
    }),
  ];

  it("returns empty array when articles list is empty", () => {
    expect(searchRelevantArticles("booking", [])).toEqual([]);
  });

  it("returns empty array for empty query", () => {
    expect(searchRelevantArticles("", articles)).toEqual([]);
  });

  it("returns empty array for query with only stop words", () => {
    expect(searchRelevantArticles("how do i the", articles)).toEqual([]);
  });

  it("returns empty array when no articles match", () => {
    const result = searchRelevantArticles("xyzquux", articles);
    expect(result).toEqual([]);
  });

  it("returns relevant articles for a booking query", () => {
    const result = searchRelevantArticles("how do I create a booking", articles);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].title).toBe("Creating Bookings");
  });

  it("returns relevant articles for equipment query", () => {
    const result = searchRelevantArticles("equipment rentals", articles);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].title).toBe("Managing Equipment");
  });

  it("returns at most 5 articles", () => {
    const result = searchRelevantArticles("manage section", articles);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("scores title matches higher than content matches", () => {
    const result = searchRelevantArticles("tour", articles);
    expect(result[0].title).toBe("Tour Setup");
  });

  it("scores tag matches highly", () => {
    const result = searchRelevantArticles("reservations", articles);
    expect(result[0].title).toBe("Creating Bookings");
  });
});
