/**
 * New Booking Trigger
 *
 * Fires when a new booking is created in DiveStreams
 * Uses REST Hooks pattern for instant triggers
 */

// Subscribe to webhook
const subscribeHook = async (z, bundle) => {
  const response = await z.request({
    url: 'https://divestreams.com/api/zapier/subscribe',
    method: 'POST',
    body: {
      event_type: 'booking.created',
      target_url: bundle.targetUrl,
    },
  });

  return response.data;
};

// Unsubscribe from webhook
const unsubscribeHook = async (z, bundle) => {
  await z.request({
    url: 'https://divestreams.com/api/zapier/subscribe',
    method: 'DELETE',
    body: {
      event_type: 'booking.created',
      target_url: bundle.targetUrl,
    },
  });

  return {};
};

// Get sample data for testing
const getSample = async (z, bundle) => {
  return {
    bookingId: 'bk_abc123',
    bookingNumber: 'BK-2024-001',
    status: 'confirmed',
    tripName: 'Morning Dive Trip',
    tripDate: '2024-03-15',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    participants: 2,
    totalAmount: 150.0,
    currency: 'USD',
  };
};

// Process incoming webhook
const parsePayload = (z, bundle) => {
  // Zapier will pass the webhook payload in bundle.cleanedRequest
  return [bundle.cleanedRequest.data];
};

module.exports = {
  key: 'new_booking',
  noun: 'Booking',
  display: {
    label: 'New Booking',
    description: 'Triggers when a new booking is created.',
    important: true,
  },

  operation: {
    type: 'hook',

    // Subscribe to the webhook
    performSubscribe: subscribeHook,

    // Unsubscribe from the webhook
    performUnsubscribe: unsubscribeHook,

    // Process the webhook payload
    perform: parsePayload,

    // Provide sample data for testing
    performList: getSample,

    // Input fields (none needed for this trigger)
    inputFields: [],

    // Output fields definition
    outputFields: [
      { key: 'bookingId', label: 'Booking ID' },
      { key: 'bookingNumber', label: 'Booking Number' },
      { key: 'status', label: 'Status' },
      { key: 'tripName', label: 'Trip Name' },
      { key: 'tripDate', label: 'Trip Date' },
      { key: 'customerName', label: 'Customer Name' },
      { key: 'customerEmail', label: 'Customer Email' },
      { key: 'participants', label: 'Number of Participants', type: 'integer' },
      { key: 'totalAmount', label: 'Total Amount', type: 'number' },
      { key: 'currency', label: 'Currency' },
    ],

    // Sample data
    sample: {
      bookingId: 'bk_abc123',
      bookingNumber: 'BK-2024-001',
      status: 'confirmed',
      tripName: 'Morning Dive Trip',
      tripDate: '2024-03-15',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      participants: 2,
      totalAmount: 150.0,
      currency: 'USD',
    },
  },
};
