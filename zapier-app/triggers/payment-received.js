/**
 * Payment Received Trigger
 *
 * Fires when a payment is received
 */

const subscribeHook = async (z, bundle) => {
  const response = await z.request({
    url: 'https://divestreams.com/api/zapier/subscribe',
    method: 'POST',
    body: {
      event_type: 'payment.received',
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
      event_type: 'payment.received',
      target_url: bundle.targetUrl,
    },
  });
  return {};
};

const parsePayload = (z, bundle) => {
  return [bundle.cleanedRequest.data];
};

module.exports = {
  key: 'payment_received',
  noun: 'Payment',
  display: {
    label: 'Payment Received',
    description: 'Triggers when a payment is successfully received.',
    important: true,
  },
  operation: {
    type: 'hook',
    performSubscribe: subscribeHook,
    performUnsubscribe: unsubscribeHook,
    perform: parsePayload,
    inputFields: [],
    outputFields: [
      { key: 'paymentId', label: 'Payment ID' },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'currency', label: 'Currency' },
      { key: 'status', label: 'Status' },
      { key: 'bookingNumber', label: 'Booking Number' },
      { key: 'customerEmail', label: 'Customer Email' },
      { key: 'paymentMethod', label: 'Payment Method' },
    ],
    sample: {
      paymentId: 'pay_def456',
      amount: 150.0,
      currency: 'USD',
      status: 'succeeded',
      bookingNumber: 'BK-2024-001',
      customerEmail: 'john@example.com',
      paymentMethod: 'card',
    },
  },
};
