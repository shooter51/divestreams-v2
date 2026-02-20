/**
 * Page Content Server Functions
 *
 * CRUD operations for managing page content in the CMS.
 * Handles page creation, updates, publishing, and version history.
 */

import { eq, and, desc } from "drizzle-orm";
import { db } from "./index";
import {
  pageContent,
  pageContentHistory,
  type PageContentRow,
  type NewPageContent,
  type PageContent,
} from "./schema/page-content";

// ============================================================================
// Types
// ============================================================================

export interface CreatePageContentInput {
  organizationId: string;
  pageId: string;
  pageName: string;
  content: PageContent;
  metaTitle?: string;
  metaDescription?: string;
  userId: string;
}

export interface UpdatePageContentInput {
  content?: PageContent;
  metaTitle?: string;
  metaDescription?: string;
  status?: "draft" | "published" | "archived";
  changeDescription?: string;
  userId: string;
}

// ============================================================================
// Page Content Functions
// ============================================================================

/**
 * Get page content by page ID
 */
export async function getPageContent(
  organizationId: string,
  pageId: string
): Promise<PageContentRow | null> {
  const [page] = await db
    .select()
    .from(pageContent)
    .where(
      and(
        eq(pageContent.organizationId, organizationId),
        eq(pageContent.pageId, pageId)
      )
    )
    .limit(1);

  return page || null;
}

/**
 * Get published page content
 */
export async function getPublishedPageContent(
  organizationId: string,
  pageId: string
): Promise<PageContentRow | null> {
  const [page] = await db
    .select()
    .from(pageContent)
    .where(
      and(
        eq(pageContent.organizationId, organizationId),
        eq(pageContent.pageId, pageId),
        eq(pageContent.status, "published")
      )
    )
    .limit(1);

  return page || null;
}

/**
 * List all pages for an organization
 */
export async function listPageContent(
  organizationId: string,
  options: { status?: "draft" | "published" | "archived" } = {}
): Promise<PageContentRow[]> {
  const conditions = [eq(pageContent.organizationId, organizationId)];

  if (options.status) {
    conditions.push(eq(pageContent.status, options.status));
  }

  const pages = await db
    .select()
    .from(pageContent)
    .where(and(...conditions))
    .orderBy(pageContent.pageId);

  return pages;
}

/**
 * Create new page content
 */
export async function createPageContent(
  input: CreatePageContentInput
): Promise<PageContentRow> {
  const [page] = await db
    .insert(pageContent)
    .values({
      organizationId: input.organizationId,
      pageId: input.pageId,
      pageName: input.pageName,
      content: input.content,
      metaTitle: input.metaTitle,
      metaDescription: input.metaDescription,
      status: "draft",
      version: 1,
      createdBy: input.userId,
      updatedBy: input.userId,
    })
    .returning();

  // Create initial history entry
  await createPageContentHistory(page.id, page.organizationId, {
    version: 1,
    content: input.content,
    changeDescription: "Initial version",
    userId: input.userId,
  });

  return page;
}

/**
 * Update page content
 */
export async function updatePageContent(
  organizationId: string,
  pageId: string,
  input: UpdatePageContentInput
): Promise<PageContentRow | null> {
  // Get existing page
  const existing = await getPageContent(organizationId, pageId);
  if (!existing) {
    return null;
  }

  // Prepare update data
  const updateData: Partial<NewPageContent> = {
    updatedAt: new Date(),
    updatedBy: input.userId,
  };

  if (input.content !== undefined) {
    updateData.content = input.content;
    updateData.version = existing.version + 1;
  }

  if (input.metaTitle !== undefined) {
    updateData.metaTitle = input.metaTitle;
  }

  if (input.metaDescription !== undefined) {
    updateData.metaDescription = input.metaDescription;
  }

  if (input.status !== undefined) {
    updateData.status = input.status;
    if (input.status === "published") {
      updateData.publishedAt = new Date();
      updateData.publishedBy = input.userId;
    }
  }

  // Update page
  const [updated] = await db
    .update(pageContent)
    .set(updateData)
    .where(
      and(
        eq(pageContent.organizationId, organizationId),
        eq(pageContent.pageId, pageId)
      )
    )
    .returning();

  // Create history entry if content was updated
  if (input.content !== undefined && updated) {
    await createPageContentHistory(updated.id, organizationId, {
      version: updated.version,
      content: input.content,
      changeDescription: input.changeDescription || "Content updated",
      userId: input.userId,
    });
  }

  return updated || null;
}

/**
 * Publish page content
 */
export async function publishPageContent(
  organizationId: string,
  pageId: string,
  userId: string
): Promise<PageContentRow | null> {
  return updatePageContent(organizationId, pageId, {
    status: "published",
    userId,
  });
}

/**
 * Unpublish page content (revert to draft)
 */
export async function unpublishPageContent(
  organizationId: string,
  pageId: string,
  userId: string
): Promise<PageContentRow | null> {
  return updatePageContent(organizationId, pageId, {
    status: "draft",
    userId,
  });
}

/**
 * Delete page content
 */
export async function deletePageContent(
  organizationId: string,
  pageId: string
): Promise<boolean> {
  const result = await db
    .delete(pageContent)
    .where(
      and(
        eq(pageContent.organizationId, organizationId),
        eq(pageContent.pageId, pageId)
      )
    )
    .returning();

  return result.length > 0;
}

// ============================================================================
// Page Content History Functions
// ============================================================================

interface CreateHistoryInput {
  version: number;
  content: PageContent;
  changeDescription: string;
  userId: string;
}

/**
 * Create page content history entry
 */
async function createPageContentHistory(
  pageContentId: string,
  organizationId: string,
  input: CreateHistoryInput
): Promise<void> {
  await db.insert(pageContentHistory).values({
    pageContentId,
    organizationId,
    version: input.version,
    content: input.content,
    changeDescription: input.changeDescription,
    createdBy: input.userId,
  });
}

/**
 * Get page content history
 */
export async function getPageContentHistory(
  organizationId: string,
  pageId: string
): Promise<Array<{
  id: string;
  version: number;
  content: PageContent;
  changeDescription: string | null;
  createdAt: Date;
  createdBy: string;
}>> {
  // First get the page
  const page = await getPageContent(organizationId, pageId);
  if (!page) {
    return [];
  }

  const history = await db
    .select({
      id: pageContentHistory.id,
      version: pageContentHistory.version,
      content: pageContentHistory.content,
      changeDescription: pageContentHistory.changeDescription,
      createdAt: pageContentHistory.createdAt,
      createdBy: pageContentHistory.createdBy,
    })
    .from(pageContentHistory)
    .where(eq(pageContentHistory.pageContentId, page.id))
    .orderBy(desc(pageContentHistory.version));

  return history;
}

/**
 * Restore page content to a previous version
 */
export async function restorePageContentVersion(
  organizationId: string,
  pageId: string,
  version: number,
  userId: string
): Promise<PageContentRow | null> {
  // Get the historical version
  const page = await getPageContent(organizationId, pageId);
  if (!page) {
    return null;
  }

  const [historyEntry] = await db
    .select()
    .from(pageContentHistory)
    .where(
      and(
        eq(pageContentHistory.pageContentId, page.id),
        eq(pageContentHistory.version, version)
      )
    )
    .limit(1);

  if (!historyEntry) {
    return null;
  }

  // Update page with historical content
  return updatePageContent(organizationId, pageId, {
    content: historyEntry.content,
    changeDescription: `Restored to version ${version}`,
    userId,
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Initialize default pages for a new organization
 */
export async function initializeDefaultPages(
  organizationId: string,
  organizationName: string,
  userId: string
): Promise<void> {
  const defaultPages: Array<{
    pageId: string;
    pageName: string;
    content: PageContent;
    metaTitle: string;
    metaDescription: string;
  }> = [
    {
      pageId: "about",
      pageName: "About Us",
      metaTitle: `About ${organizationName}`,
      metaDescription: `Learn more about ${organizationName} and our passion for diving.`,
      content: {
        blocks: [
          {
            id: "heading-1",
            type: "heading",
            content: "Our Story",
            level: 2,
          },
          {
            id: "para-1",
            type: "paragraph",
            content: `<p>Welcome to ${organizationName}! We are passionate about sharing the wonders of the underwater world with divers of all experience levels.</p>`,
          },
          {
            id: "para-2",
            type: "paragraph",
            content: `<p>Our team of experienced instructors and dive professionals is dedicated to providing safe, educational, and exciting diving experiences. Whether you're taking your first breath underwater or exploring advanced technical diving, we're here to guide you every step of the way.</p>`,
          },
          {
            id: "values-1",
            type: "values-grid",
            title: "Our Values",
            columns: 2,
            values: [
              {
                id: "value-1",
                title: "Safety First",
                description:
                  "Your safety is our top priority. We maintain the highest standards in equipment, training, and dive practices.",
              },
              {
                id: "value-2",
                title: "Environmental Care",
                description:
                  "We're committed to protecting marine ecosystems through sustainable diving practices and conservation efforts.",
              },
              {
                id: "value-3",
                title: "Quality Education",
                description:
                  "We provide thorough, personalized instruction to ensure every diver develops proper skills and confidence.",
              },
              {
                id: "value-4",
                title: "Community",
                description:
                  "Join our diving family! We foster a welcoming community of ocean enthusiasts who share their passion for diving.",
              },
            ],
          },
        ],
      },
    },
    {
      pageId: "home",
      pageName: "Home Page",
      metaTitle: organizationName,
      metaDescription: `Professional diving services and unforgettable underwater experiences with ${organizationName}.`,
      content: {
        blocks: [
          {
            id: "heading-1",
            type: "heading",
            content: `Welcome to ${organizationName}`,
            level: 1,
          },
          {
            id: "para-1",
            type: "paragraph",
            content:
              "<p>Discover the underwater world with our professional diving services and unforgettable experiences.</p>",
          },
        ],
      },
    },
  ];

  for (const page of defaultPages) {
    try {
      await createPageContent({
        organizationId,
        pageId: page.pageId,
        pageName: page.pageName,
        content: page.content,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        userId,
      });
    } catch (error) {
      // Skip if page already exists
      console.error(`Error creating default page ${page.pageId}:`, error);
    }
  }
}

/**
 * Get page content for public display (published only)
 */
export async function getPublicPageContent(
  organizationId: string,
  pageId: string
): Promise<{
  content: PageContent;
  metaTitle: string | null;
  metaDescription: string | null;
} | null> {
  const page = await getPublishedPageContent(organizationId, pageId);
  if (!page) {
    return null;
  }

  return {
    content: page.content,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
  };
}
