/**
 * Create Booking Action
 *
 * Allows creating a booking from Zapier
 */

const perform = async (z, bundle) => {
  const response = await z.request({
    url: 'https://divestreams.com/api/zapier/actions/create-booking',
    method: 'POST',
    body: {
      trip_id: bundle.inputData.trip_id,
      customer_email: bundle.inputData.customer_email,
      customer_first_name: bundle.inputData.customer_first_name,
      customer_last_name: bundle.inputData.customer_last_name,
      customer_phone: bundle.inputData.customer_phone,
      participants: bundle.inputData.participants,
      notes: bundle.inputData.notes,
    },
  });

  return response.data;
};

module.exports = {
  key: 'create_booking',
  noun: 'Booking',
  display: {
    label: 'Create Booking',
    description: 'Creates a new booking in DiveStreams.',
  },
  operation: {
    perform: perform,
    inputFields: [
      {
        key: 'trip_id',
        label: 'Trip ID',
        type: 'string',
        required: true,
        helpText: 'The ID of the trip to book',
      },
      {
        key: 'customer_email',
        label: 'Customer Email',
        type: 'string',
        required: true,
        helpText: 'Email address of the customer',
      },
      {
        key: 'customer_first_name',
        label: 'Customer First Name',
        type: 'string',
        required: false,
      },
      {
        key: 'customer_last_name',
        label: 'Customer Last Name',
        type: 'string',
        required: false,
      },
      {
        key: 'customer_phone',
        label: 'Customer Phone',
        type: 'string',
        required: false,
      },
      {
        key: 'participants',
        label: 'Number of Participants',
        type: 'integer',
        required: true,
        default: 1,
      },
      {
        key: 'notes',
        label: 'Booking Notes',
        type: 'text',
        required: false,
      },
    ],
    outputFields: [
      { key: 'id', label: 'Booking ID' },
      { key: 'booking_number', label: 'Booking Number' },
      { key: 'trip_id', label: 'Trip ID' },
      { key: 'customer_id', label: 'Customer ID' },
      { key: 'status', label: 'Status' },
      { key: 'participants', label: 'Participants', type: 'integer' },
      { key: 'created_at', label: 'Created At' },
    ],
    sample: {
      id: 'bk_abc123',
      booking_number: 'BK-2024-001',
      trip_id: 'trip_xyz',
      customer_id: 'cust_123',
      status: 'pending',
      participants: 2,
      created_at: '2024-01-18T12:00:00Z',
    },
  },
};
