import { parentPort, workerData } from "worker_threads";
import { chromium, type Browser, type Page } from "playwright";
import type {
  StepMetric,
  MetricEvent,
  OrchestratorMessage,
  WorkerMessage,
} from "./types.js";

interface WorkerData {
  workerId: number;
  sessionTimeout: number;
  baseDomain: string;
  enableRegister: boolean;
}

const { workerId, sessionTimeout, baseDomain, enableRegister } =
  workerData as WorkerData;

function send(msg: WorkerMessage) {
  parentPort!.postMessage(msg);
}

function randomThinkTime(): Promise<void> {
  const ms = 500 + Math.random() * 1500;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStep(
  page: Page,
  stepName: string,
  fn: () => Promise<{ url: string; httpStatus: number | null }>
): Promise<StepMetric> {
  const startTime = Date.now();
  try {
    const result = await fn();
    return {
      step: stepName,
      url: result.url,
      startTime,
      durationMs: Date.now() - startTime,
      httpStatus: result.httpStatus,
    };
  } catch (err) {
    return {
      step: stepName,
      url: page.url(),
      startTime,
      durationMs: Date.now() - startTime,
      httpStatus: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function navigateTo(
  page: Page,
  url: string,
  waitFn?: () => Promise<void>
): Promise<{ url: string; httpStatus: number | null }> {
  let httpStatus: number | null = null;

  const responseHandler = (response: { url: () => string; status: () => number }) => {
    if (response.url() === url || response.url().startsWith(url.split("?")[0])) {
      httpStatus = response.status();
    }
  };

  page.on("response", responseHandler);
  try {
    const response = await page.goto(url, {
      timeout: sessionTimeout,
      waitUntil: "domcontentloaded",
    });
    if (response && httpStatus === null) {
      httpStatus = response.status();
    }
    if (waitFn) {
      await waitFn();
    }
    return { url: page.url(), httpStatus };
  } finally {
    page.off("response", responseHandler);
  }
}

async function runSession(browser: Browser, slug: string): Promise<MetricEvent> {
  const sessionStart = Date.now();
  const steps: StepMetric[] = [];
  const baseUrl = `https://${slug}.${baseDomain}`;

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Abort image requests to save bandwidth
  await page.route("**/*", (route) => {
    if (route.request().resourceType() === "image") {
      route.abort();
    } else {
      route.continue();
    }
  });

  try {
    // Step 1: Homepage
    const step1 = await runStep(page, "homepage", async () => {
      const result = await navigateTo(page, `${baseUrl}/site`, async () => {
        await page.waitForSelector("h1", { timeout: sessionTimeout, state: "visible" });
      });
      return result;
    });
    steps.push(step1);
    await randomThinkTime();

    // Step 2: Trips listing
    const step2 = await runStep(page, "trips_list", async () => {
      const result = await navigateTo(page, `${baseUrl}/site/trips`, async () => {
        try {
          await page.waitForSelector('a[href*="/site/trips/"]', {
            timeout: sessionTimeout,
            state: "attached",
          });
        } catch {
          // Fallback: just wait for any content
          await page.waitForLoadState("networkidle", { timeout: sessionTimeout });
        }
      });
      return result;
    });
    steps.push(step2);
    await randomThinkTime();

    // Step 3: First trip detail (skip if no trip links)
    const step3 = await runStep(page, "trip_detail", async () => {
      const tripLink = page.locator('a[href*="/site/trips/"]').first();
      const count = await tripLink.count();
      if (count === 0) {
        return { url: page.url(), httpStatus: null };
      }
      await tripLink.click({ timeout: sessionTimeout });
      await page.waitForLoadState("domcontentloaded", { timeout: sessionTimeout });
      return { url: page.url(), httpStatus: null };
    });
    steps.push(step3);
    await randomThinkTime();

    // Step 4: Go back
    const step4 = await runStep(page, "trips_back", async () => {
      await page.goBack({ timeout: sessionTimeout, waitUntil: "domcontentloaded" });
      return { url: page.url(), httpStatus: null };
    });
    steps.push(step4);
    await randomThinkTime();

    // Step 5: Courses listing
    const step5 = await runStep(page, "courses_list", async () => {
      const result = await navigateTo(page, `${baseUrl}/site/courses`, async () => {
        await page.waitForLoadState("networkidle", { timeout: sessionTimeout });
      });
      return result;
    });
    steps.push(step5);
    await randomThinkTime();

    // Step 6: First course detail (skip if no course links)
    const step6 = await runStep(page, "course_detail", async () => {
      const courseLink = page.locator('a[href*="/site/courses/"]').first();
      const count = await courseLink.count();
      if (count === 0) {
        return { url: page.url(), httpStatus: null };
      }
      await courseLink.click({ timeout: sessionTimeout });
      await page.waitForLoadState("domcontentloaded", { timeout: sessionTimeout });
      return { url: page.url(), httpStatus: null };
    });
    steps.push(step6);
    await randomThinkTime();

    // Step 7: Equipment
    const step7 = await runStep(page, "equipment", async () => {
      const result = await navigateTo(page, `${baseUrl}/site/equipment`, async () => {
        await page.waitForLoadState("domcontentloaded", { timeout: sessionTimeout });
      });
      return result;
    });
    steps.push(step7);
    await randomThinkTime();

    // Step 8: Gallery
    const step8 = await runStep(page, "gallery", async () => {
      const result = await navigateTo(page, `${baseUrl}/site/gallery`, async () => {
        await page.waitForLoadState("domcontentloaded", { timeout: sessionTimeout });
      });
      return result;
    });
    steps.push(step8);
    await randomThinkTime();

    // Step 9: Contact
    const step9 = await runStep(page, "contact", async () => {
      const result = await navigateTo(page, `${baseUrl}/site/contact`, async () => {
        await page.waitForLoadState("domcontentloaded", { timeout: sessionTimeout });
      });
      return result;
    });
    steps.push(step9);
    await randomThinkTime();

    // Step 10: Register (optional)
    if (enableRegister) {
      const step10 = await runStep(page, "register", async () => {
        const result = await navigateTo(page, `${baseUrl}/site/register`, async () => {
          await page.waitForLoadState("domcontentloaded", { timeout: sessionTimeout });
        });

        const ts = Date.now();
        const email = `loadtest+${workerId}_${ts}@example.com`;

        // Fill form fields — try common field names
        const fields: Array<[string, string]> = [
          ['input[name="firstName"], input[name="first_name"]', "Load"],
          ['input[name="lastName"], input[name="last_name"]', "Tester"],
          [`input[name="email"], input[type="email"]`, email],
          ['input[name="password"], input[type="password"]', "LoadTest123!"],
          ['input[name="confirmPassword"], input[name="confirm_password"]', "LoadTest123!"],
        ];

        for (const [selector, value] of fields) {
          const el = page.locator(selector).first();
          const visible = await el.isVisible().catch(() => false);
          if (visible) {
            await el.fill(value, { timeout: 5000 }).catch(() => {});
          }
        }

        // Submit
        const submitBtn = page
          .locator('button[type="submit"], input[type="submit"]')
          .first();
        const btnVisible = await submitBtn.isVisible().catch(() => false);
        if (btnVisible) {
          await submitBtn.click({ timeout: 5000 }).catch(() => {});
          await page.waitForLoadState("domcontentloaded", { timeout: sessionTimeout }).catch(() => {});
        }

        return { url: page.url(), httpStatus: result.httpStatus };
      });
      steps.push(step10);
    }
  } finally {
    await page.close().catch(() => {});
  }

  const sessionEnd = Date.now();
  const sessionErrorCount = steps.filter((s) => s.error !== undefined).length;

  return {
    workerId,
    tenantSlug: slug,
    sessionStart,
    sessionEnd,
    steps,
    sessionErrorCount,
  };
}

async function main() {
  const browser: Browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  send({ type: "ready" });

  parentPort!.on("message", async (msg: OrchestratorMessage) => {
    if (msg.type === "shutdown") {
      await browser.close().catch(() => {});
      process.exit(0);
    }

    if (msg.type === "tenant") {
      const event = await runSession(browser, msg.slug);
      send({ type: "metric", event });
      send({ type: "next" });
    }
  });
}

main().catch((err) => {
  console.error(`[worker ${workerId}] Fatal error:`, err);
  process.exit(1);
});
