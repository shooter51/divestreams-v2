/**
 * Integration Test Fixtures
 *
 * Pre-defined test data for integration tests.
 */

export const testOrganization = {
  id: 'test-org-123',
  name: 'Test Dive Shop',
  slug: 'test-dive-shop',
};

export const testUser = {
  id: 'test-user-456',
  email: 'test@example.com',
  name: 'Test User',
};

export const testGoogleCalendarIntegration = {
  id: 'integration-google-1',
  organizationId: testOrganization.id,
  provider: 'google-calendar',
  isActive: true,
  accessToken: 'test-access-token-xyz',
  refreshToken: 'test-refresh-token-abc',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  accountId: 'google-user-789',
  accountName: 'Test Google User',
  accountEmail: 'testgoogle@example.com',
};

export const testExpiredGoogleCalendarIntegration = {
  ...testGoogleCalendarIntegration,
  id: 'integration-google-expired',
  expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
};

export const testTrips = [
  {
    id: 'trip-1',
    organizationId: testOrganization.id,
    name: 'Morning Reef Dive',
    startDate: '2026-02-01',
    endDate: '2026-02-01',
    location: 'Coral Bay',
  },
  {
    id: 'trip-2',
    organizationId: testOrganization.id,
    name: 'Night Manta Dive',
    startDate: '2026-02-02',
    endDate: '2026-02-02',
    location: 'Manta Point',
  },
  {
    id: 'trip-3',
    organizationId: testOrganization.id,
    name: 'Weekend Wreck Expedition',
    startDate: '2026-02-08',
    endDate: '2026-02-09',
    location: 'Shipwreck Alley',
  },
];

/**
 * Mock Google API responses
 */
export const mockGoogleTokenResponse = {
  access_token: 'new-access-token-123',
  refresh_token: 'new-refresh-token-456',
  expires_in: 3600,
  token_type: 'Bearer',
  scope: 'https://www.googleapis.com/auth/calendar',
};

export const mockGoogleUserInfo = {
  id: 'google-user-789',
  email: 'testgoogle@example.com',
  name: 'Test Google User',
  picture: 'https://example.com/avatar.jpg',
};

export const mockGoogleCalendarEvent = {
  id: 'calendar-event-123',
  status: 'confirmed',
  htmlLink: 'https://calendar.google.com/event?eid=abc123',
  created: '2026-01-23T10:00:00Z',
  updated: '2026-01-23T10:00:00Z',
  summary: 'Morning Reef Dive',
  description: 'Diving trip at Coral Bay',
  location: 'Coral Bay',
  start: {
    date: '2026-02-01',
  },
  end: {
    date: '2026-02-01',
  },
};

export const mockGoogleCalendarList = {
  kind: 'calendar#events',
  items: [mockGoogleCalendarEvent],
  nextPageToken: null,
};
