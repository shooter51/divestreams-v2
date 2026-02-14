/**
 * CSRF Constants - Shared between server and client code.
 *
 * This file contains only constants that are safe to use in browser bundles.
 * Server-only logic (HMAC generation, validation) stays in csrf.server.ts.
 */

/** Form field name for the CSRF token */
export const CSRF_FIELD_NAME = "_csrf";
