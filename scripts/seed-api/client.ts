const UUID_PATTERN =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export class SeedClient {
  baseUrl: string;
  private cookies: Map<string, string> = new Map();
  private csrfToken: string | null = null;
  private csrfTokenExpiry: number = 0;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private storeCookies(response: Response): void {
    // Use getSetCookie() to get all Set-Cookie headers (Node 18+)
    const setCookieHeaders: string[] =
      typeof (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : [response.headers.get("set-cookie")].filter(Boolean) as string[];

    for (const header of setCookieHeaders) {
      // Parse "name=value; Path=/; HttpOnly; ..." — take only the first segment
      const firstSegment = header.split(";")[0].trim();
      const eqIndex = firstSegment.indexOf("=");
      if (eqIndex === -1) continue;
      const name = firstSegment.substring(0, eqIndex).trim();
      const value = firstSegment.substring(eqIndex + 1).trim();
      if (name) {
        this.cookies.set(name, value);
      }
    }
  }

  async getHtml(path: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Cookie: this.buildCookieHeader(),
      },
    });
    this.storeCookies(res);
    return res.text();
  }

  async post(
    path: string,
    formData: FormData
  ): Promise<{ ok: boolean; status: number; location: string | null; html: string }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      body: formData,
      redirect: "manual",
      headers: {
        Cookie: this.buildCookieHeader(),
      },
    });
    this.storeCookies(res);
    const html = await res.text();
    return {
      ok: res.ok || res.status === 302 || res.status === 303,
      status: res.status,
      location: res.headers.get("location"),
      html,
    };
  }

  async postJson(
    path: string,
    body: unknown
  ): Promise<{ ok: boolean; status: number; body: unknown }> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        Cookie: this.buildCookieHeader(),
      },
    });
    this.storeCookies(res);
    let responseBody: unknown;
    try {
      responseBody = await res.json();
    } catch {
      responseBody = await res.text();
    }
    return {
      ok: res.ok,
      status: res.status,
      body: responseBody,
    };
  }

  async getCsrfToken(): Promise<string> {
    const now = Date.now();
    if (this.csrfToken && now < this.csrfTokenExpiry) {
      return this.csrfToken;
    }

    const html = await this.getHtml("/tenant/tours/new");
    const token = parseCsrfFromHtml(html);
    if (!token) {
      throw new Error("Failed to scrape CSRF token from /tenant/tours/new");
    }

    this.csrfToken = token;
    // Cache for 3.5 hours (token TTL is 4 hours)
    this.csrfTokenExpiry = now + 3.5 * 60 * 60 * 1000;
    return token;
  }

  // Invalidate the cached CSRF token so it is re-scraped on next call
  invalidateCsrfToken(): void {
    this.csrfToken = null;
    this.csrfTokenExpiry = 0;
  }

  extractId(location: string, prefix: string): string | null {
    if (!location.startsWith(prefix)) return null;
    const id = location.slice(prefix.length).split("?")[0].split("/")[0];
    return id || null;
  }

  parseTripIds(html: string): string[] {
    return parseHrefIds(html, "/tenant/trips/");
  }

  parseCourseIds(html: string): string[] {
    return parseHrefIds(html, "/tenant/training/courses/");
  }

  parseAlbumIds(html: string): string[] {
    return parseHrefIds(html, "/tenant/gallery/");
  }
}

function parseCsrfFromHtml(html: string): string | null {
  // Try both attribute orderings
  const re1 = /name="_csrf"[^>]*value="([^"]+)"/;
  const re2 = /value="([^"]+)"[^>]*name="_csrf"/;
  const m = html.match(re1) || html.match(re2);
  return m ? m[1] : null;
}

function parseHrefIds(html: string, prefix: string): string[] {
  const escaped = prefix.replace(/\//g, "\\/");
  const re = new RegExp(`href="${escaped}(${UUID_PATTERN})"`, "g");
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (!ids.includes(m[1])) {
      ids.push(m[1]);
    }
  }
  return ids;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
