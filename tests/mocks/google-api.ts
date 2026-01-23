/**
 * Google API Mocks
 *
 * Mock utilities for testing Google Calendar integration.
 */

import { vi } from 'vitest';
import {
  mockGoogleTokenResponse,
  mockGoogleUserInfo,
  mockGoogleCalendarEvent,
  mockGoogleCalendarList,
} from '../setup/fixtures/integrations';

/**
 * Create a mock fetch function for Google API calls
 */
export function createGoogleApiMock(options: {
  tokenExchange?: 'success' | 'error';
  userInfo?: 'success' | 'error';
  calendarCreate?: 'success' | 'error';
  calendarUpdate?: 'success' | 'error';
  calendarDelete?: 'success' | 'error';
  calendarList?: 'success' | 'error';
} = {}) {
  const defaultOptions = {
    tokenExchange: 'success',
    userInfo: 'success',
    calendarCreate: 'success',
    calendarUpdate: 'success',
    calendarDelete: 'success',
    calendarList: 'success',
    ...options,
  };

  return vi.fn(async (url: string, init?: RequestInit) => {
    const urlStr = url.toString();

    // Token exchange endpoint
    if (urlStr.includes('oauth2/v4/token') || urlStr.includes('oauth2/v3/token')) {
      if (defaultOptions.tokenExchange === 'error') {
        return createErrorResponse(400, 'invalid_grant', 'Token exchange failed');
      }
      return createJsonResponse(mockGoogleTokenResponse);
    }

    // User info endpoint
    if (urlStr.includes('userinfo') || urlStr.includes('oauth2/v2/userinfo')) {
      if (defaultOptions.userInfo === 'error') {
        return createErrorResponse(401, 'unauthorized', 'Invalid access token');
      }
      return createJsonResponse(mockGoogleUserInfo);
    }

    // Calendar events endpoints
    if (urlStr.includes('calendar/v3/calendars')) {
      const method = init?.method?.toUpperCase() || 'GET';

      // Create event
      if (method === 'POST') {
        if (defaultOptions.calendarCreate === 'error') {
          return createErrorResponse(403, 'forbidden', 'Calendar access denied');
        }
        return createJsonResponse(mockGoogleCalendarEvent);
      }

      // Update event
      if (method === 'PUT' || method === 'PATCH') {
        if (defaultOptions.calendarUpdate === 'error') {
          return createErrorResponse(404, 'not_found', 'Event not found');
        }
        return createJsonResponse(mockGoogleCalendarEvent);
      }

      // Delete event
      if (method === 'DELETE') {
        if (defaultOptions.calendarDelete === 'error') {
          return createErrorResponse(404, 'not_found', 'Event not found');
        }
        return createJsonResponse({});
      }

      // List events
      if (method === 'GET') {
        if (defaultOptions.calendarList === 'error') {
          return createErrorResponse(403, 'forbidden', 'Calendar access denied');
        }
        return createJsonResponse(mockGoogleCalendarList);
      }
    }

    // Default: return 404 for unknown endpoints
    return createErrorResponse(404, 'not_found', `Unknown endpoint: ${urlStr}`);
  });
}

/**
 * Create a successful JSON response
 */
function createJsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create an error response
 */
function createErrorResponse(status: number, error: string, message: string): Response {
  return new Response(JSON.stringify({ error, error_description: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Setup global fetch mock for Google API
 */
export function setupGoogleApiMock(options?: Parameters<typeof createGoogleApiMock>[0]): void {
  global.fetch = createGoogleApiMock(options);
}

/**
 * Restore original fetch
 */
export function restoreGoogleApiMock(): void {
  vi.restoreAllMocks();
}

/**
 * Verify that a specific Google API endpoint was called
 */
export function expectGoogleApiCalled(
  mockFetch: ReturnType<typeof vi.fn>,
  endpoint: string,
  method?: string
): void {
  const calls = mockFetch.mock.calls;
  const matchingCall = calls.find(([url, init]) => {
    const urlMatch = url.toString().includes(endpoint);
    if (!method) return urlMatch;
    const actualMethod = (init?.method || 'GET').toUpperCase();
    return urlMatch && actualMethod === method.toUpperCase();
  });

  if (!matchingCall) {
    throw new Error(
      `Expected Google API call to ${endpoint}${method ? ` with method ${method}` : ''} but it was not made.\n` +
      `Actual calls: ${calls.map(([url]) => url).join(', ')}`
    );
  }
}
