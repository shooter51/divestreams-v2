/**
 * New Customer Trigger
 *
 * Fires when a new customer is added
 */

const subscribeHook = async (z, bundle) => {
  const response = await z.request({
    url: 'https://divestreams.com/api/zapier/subscribe',
    method: 'POST',
    body: {
      event_type: 'customer.created',
      target_url: bundle.targetUrl,
    },
  });
  return response.data;
};

const unsubscribeHook = async (z, bundle) => {
  await z.request({
    url: 'https://divestreams.com/api/zapier/subscribe',
    method: 'DELETE',
    body: {
      event_type: 'customer.created',
      target_url: bundle.targetUrl,
    },
  });
  return {};
};

const parsePayload = (z, bundle) => {
  return [bundle.cleanedRequest.data];
};

module.exports = {
  key: 'new_customer',
  noun: 'Customer',
  display: {
    label: 'New Customer',
    description: 'Triggers when a new customer is added.',
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: parsePayload,
    inputFields: [],
    outputFields: [
      { key: 'customerId', label: 'Customer ID' },
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'totalBookings', label: 'Total Bookings', type: 'integer' },
      { key: 'lifetimeValue', label: 'Lifetime Value', type: 'number' },
    ],
    sample: {
      customerId: 'cust_xyz789',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      totalBookings: 0,
      lifetimeValue: 0,
    },
  },
};
