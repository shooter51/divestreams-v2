import { describe, it, expect } from "vitest";
import { resolveLocale } from "../../../../app/i18n/resolve-locale";
import { createRequest } from "../../../setup/test-utils";

function makeRequest(opts: { cookies?: string; acceptLanguage?: string } = {}): Request {
  const req = createRequest("http://localhost", { cookies: opts.cookies });
  if (opts.acceptLanguage) {
    req.headers.set("Accept-Language", opts.acceptLanguage);
  }
  return req;
}

describe("resolveLocale", () => {
  it("returns locale from ds_locale cookie", () => {
    const req = makeRequest({ cookies: "ds_locale=es; other=val" });
    expect(resolveLocale(req)).toBe("es");
  });

  it("ignores invalid cookie locale", () => {
    const req = makeRequest({ cookies: "ds_locale=zz" });
    expect(resolveLocale(req)).toBe("en");
  });

  it("parses Accept-Language with quality values (highest quality wins)", () => {
    const req = makeRequest({
      acceptLanguage: "fr-FR;q=0.9, es-MX;q=1.0, en-US;q=0.8",
    });
    expect(resolveLocale(req)).toBe("es");
  });

  it("falls back to DEFAULT_LOCALE when no match", () => {
    const req = makeRequest({
      acceptLanguage: "fr-FR, de-DE;q=0.9",
    });
    expect(resolveLocale(req)).toBe("en");
  });

  it("handles malformed Accept-Language header gracefully", () => {
    const req = makeRequest({
      acceptLanguage: ";;;,,not-a-lang",
    });
    expect(resolveLocale(req)).toBe("en");
  });

  it("handles empty headers", () => {
    const req = makeRequest();
    expect(resolveLocale(req)).toBe("en");
  });
});
