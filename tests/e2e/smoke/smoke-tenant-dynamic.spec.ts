import { test, expect, type Page } from "@playwright/test";
import { getTenantUrl } from "../helpers/urls";
import { loginToTenant } from "../fixtures/test-fixtures";

/**
 * Smoke tests for tenant dynamic :id routes.
 * Extracts real entity IDs from list pages, then visits detail/edit pages.
 * Runs serially since later tests depend on extracted IDs.
 */
test.describe("Smoke: Tenant dynamic pages", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await loginToTenant(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // Helper: extract first entity link href from a list page
  async function getFirstEntityId(
    listPath: string,
    linkPattern: RegExp
  ): Promise<string | null> {
    await page.goto(getTenantUrl(process.env.SMOKE_TENANT || "demo", listPath), {
      waitUntil: "domcontentloaded",
    });
    const links = page.locator("a").filter({ has: page.locator(`[href]`) });
    const allLinks = await links.evaluateAll((els) =>
      els.map((el) => el.getAttribute("href")).filter(Boolean)
    );
    const match = allLinks.find((href) => href && linkPattern.test(href));
    if (!match) return null;
    const idMatch = match.match(linkPattern);
    return idMatch?.[1] || null;
  }

  // Helper: visit a route and assert no errors
  async function assertRouteOk(path: string, name: string, expect200 = false) {
    const response = await page.goto(getTenantUrl(process.env.SMOKE_TENANT || "demo", path), {
      waitUntil: "domcontentloaded",
    });
    if (expect200) {
      expect(response?.status(), `${name} should return 200`).toBe(200);
    } else {
      expect(
        response?.status(),
        `${name} should not return 5xx`
      ).toBeLessThan(500);
    }

    const errorBoundary = await page
      .locator('text="Unexpected Application Error"')
      .count();
    expect(errorBoundary, `${name} should not show error boundary`).toBe(0);
  }

  // Entity groups with list path and link pattern
  const entityGroups = [
    {
      name: "Boats",
      listPath: "/tenant/boats",
      linkPattern: /\/tenant\/boats\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/boats/${id}`,
      editPath: (id: string) => `/tenant/boats/${id}/edit`,
    },
    {
      name: "Tours",
      listPath: "/tenant/tours",
      linkPattern: /\/tenant\/tours\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/tours/${id}`,
      editPath: (id: string) => `/tenant/tours/${id}/edit`,
    },
    {
      name: "Trips",
      listPath: "/tenant/trips",
      linkPattern: /\/tenant\/trips\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/trips/${id}`,
      editPath: (id: string) => `/tenant/trips/${id}/edit`,
    },
    {
      name: "Dive Sites",
      listPath: "/tenant/dive-sites",
      linkPattern: /\/tenant\/dive-sites\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/dive-sites/${id}`,
      editPath: (id: string) => `/tenant/dive-sites/${id}/edit`,
    },
    {
      name: "Customers",
      listPath: "/tenant/customers",
      linkPattern: /\/tenant\/customers\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/customers/${id}`,
      editPath: (id: string) => `/tenant/customers/${id}/edit`,
    },
    {
      name: "Equipment",
      listPath: "/tenant/equipment",
      linkPattern: /\/tenant\/equipment\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/equipment/${id}`,
      editPath: (id: string) => `/tenant/equipment/${id}/edit`,
    },
    {
      name: "Bookings",
      listPath: "/tenant/bookings",
      linkPattern: /\/tenant\/bookings\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/bookings/${id}`,
      editPath: (id: string) => `/tenant/bookings/${id}/edit`,
    },
    {
      name: "POS Products",
      listPath: "/tenant/pos/products",
      linkPattern: /\/tenant\/pos\/products\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/pos/products/${id}`,
      editPath: (id: string) => `/tenant/pos/products/${id}/edit`,
    },
    {
      name: "Gallery Albums",
      listPath: "/tenant/gallery",
      linkPattern: /\/tenant\/gallery\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/gallery/${id}`,
    },
    {
      name: "Training Courses",
      listPath: "/tenant/training/courses",
      linkPattern: /\/tenant\/training\/courses\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/training/courses/${id}`,
      editPath: (id: string) => `/tenant/training/courses/${id}/edit`,
    },
    {
      name: "Training Series",
      listPath: "/tenant/training/series",
      linkPattern: /\/tenant\/training\/series\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/training/series/${id}`,
    },
    {
      name: "Training Sessions",
      listPath: "/tenant/training/sessions",
      linkPattern: /\/tenant\/training\/sessions\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/training/sessions/${id}`,
    },
    {
      name: "Training Enrollments",
      listPath: "/tenant/training/enrollments",
      linkPattern: /\/tenant\/training\/enrollments\/([a-f0-9-]+)$/,
      detailPath: (id: string) => `/tenant/training/enrollments/${id}`,
    },
  ];

  for (const group of entityGroups) {
    test(`${group.name} detail page renders`, async () => {
      const id = await getFirstEntityId(group.listPath, group.linkPattern);
      if (!id) {
        // No entities — skip gracefully
        test.skip();
        return;
      }
      await assertRouteOk(group.detailPath(id), `${group.name} detail`);
    });

    if ("editPath" in group && group.editPath) {
      test(`${group.name} edit page renders`, async () => {
        const id = await getFirstEntityId(group.listPath, group.linkPattern);
        if (!id) {
          test.skip();
          return;
        }
        await assertRouteOk(group.editPath(id), `${group.name} edit`);
      });
    }
  }

  // Tour duplicate page
  test("Tour duplicate page renders", async () => {
    const id = await getFirstEntityId(
      "/tenant/tours",
      /\/tenant\/tours\/([a-f0-9-]+)$/
    );
    if (!id) {
      test.skip();
      return;
    }
    await assertRouteOk(`/tenant/tours/${id}/duplicate`, "Tour duplicate");
  });
});
