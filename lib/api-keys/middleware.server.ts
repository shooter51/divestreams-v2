/**
 * API Key Authentication Middleware
 *
 * Provides middleware functions for validating API keys in request headers.
 * Use this for public API routes that accept API key authentication.
 */

import { validateApiKey, type ApiKeyPermissions } from "./index.server";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context returned when API key is valid
 */
export interface ApiKeyContext {
  orgId: string;
  orgName: string;
  orgSlug: string;
  keyId: string;
  keyName: string;
  permissions: ApiKeyPermissions | null;
}

/**
 * Result of API key validation
 */
export type ApiKeyValidationResult =
  | { success: true; context: ApiKeyContext }
  | { success: false; error: string; status: number };

// ============================================================================
// HEADER PARSING
// ============================================================================

/**
 * Extract API key from request headers
 *
 * Supports two formats:
 * - Authorization: Bearer dk_live_xxx
 * - X-API-Key: dk_live_xxx
 *
 * @param request - The incoming request
 * @returns The API key or null if not found
 */
export function extractApiKey(request: Request): string | null {
  // Try Authorization header first (preferred)
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }

  // Fall back to X-API-Key header
  const apiKeyHeader = request.headers.get("X-API-Key");
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validate API key from request and return organization context
 *
 * Use this in API route loaders/actions to authenticate requests.
 *
 * @example
 * ```ts
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const result = await validateApiKeyFromRequest(request);
 *   if (!result.success) {
 *     return json({ error: result.error }, { status: result.status });
 *   }
 *
 *   // Use result.context.orgId for database queries
 *   const data = await getDataForOrg(result.context.orgId);
 *   return json(data);
 * }
 * ```
 *
 * @param request - The incoming request
 * @returns Validation result with context or error
 */
export async function validateApiKeyFromRequest(
  request: Request
): Promise<ApiKeyValidationResult> {
  const apiKey = extractApiKey(request);

  if (!apiKey) {
    return {
      success: false,
      error: "Missing API key. Include in Authorization header as 'Bearer dk_live_xxx' or use X-API-Key header.",
      status: 401,
    };
  }

  // Validate key format
  if (!apiKey.startsWith("dk_live_") && !apiKey.startsWith("dk_test_")) {
    return {
      success: false,
      error: "Invalid API key format. Keys should start with 'dk_live_' or 'dk_test_'.",
      status: 401,
    };
  }

  const context = await validateApiKey(apiKey);

  if (!context) {
    return {
      success: false,
      error: "Invalid or expired API key.",
      status: 401,
    };
  }

  return {
    success: true,
    context,
  };
}

/**
 * Require API key authentication or throw a Response
 *
 * Use this for simpler cases where you want to throw directly.
 *
 * @example
 * ```ts
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const context = await requireApiKey(request);
 *   // context is guaranteed to be valid here
 *   const data = await getDataForOrg(context.orgId);
 *   return json(data);
 * }
 * ```
 *
 * @param request - The incoming request
 * @throws Response with 401 status if key is invalid
 * @returns The API key context
 */
export async function requireApiKey(request: Request): Promise<ApiKeyContext> {
  const result = await validateApiKeyFromRequest(request);

  if (!result.success) {
    throw new Response(JSON.stringify({ error: result.error }), {
      status: result.status,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  return result.context;
}

/**
 * Check if the API key has a specific permission
 *
 * @param context - The API key context
 * @param permission - The permission to check
 * @returns True if the permission is granted
 */
export function hasPermission(
  context: ApiKeyContext,
  permission: "read" | "write" | "delete"
): boolean {
  if (!context.permissions) {
    return true; // No permissions set = full access
  }
  return context.permissions[permission] === true;
}

/**
 * Check if the API key has a specific scope
 *
 * @param context - The API key context
 * @param scope - The scope to check (e.g., "bookings:read")
 * @returns True if the scope is granted
 */
export function hasScope(context: ApiKeyContext, scope: string): boolean {
  if (!context.permissions?.scopes) {
    return true; // No scopes set = full access
  }
  return context.permissions.scopes.includes(scope);
}

/**
 * Require a specific permission or throw
 *
 * @param context - The API key context
 * @param permission - The required permission
 * @throws Response with 403 status if permission is denied
 */
export function requirePermission(
  context: ApiKeyContext,
  permission: "read" | "write" | "delete"
): void {
  if (!hasPermission(context, permission)) {
    throw new Response(
      JSON.stringify({
        error: `API key does not have '${permission}' permission.`,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

/**
 * Require a specific scope or throw
 *
 * @param context - The API key context
 * @param scope - The required scope
 * @throws Response with 403 status if scope is denied
 */
export function requireScope(context: ApiKeyContext, scope: string): void {
  if (!hasScope(context, scope)) {
    throw new Response(
      JSON.stringify({
        error: `API key does not have '${scope}' scope.`,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
