/**
 * Update Customer Action
 *
 * Allows updating customer information from Zapier
 */

const perform = async (z, bundle) => {
  const response = await z.request({
    url: 'https://divestreams.com/api/zapier/actions/update-customer',
    method: 'POST',
    body: {
      email: bundle.inputData.email,
      first_name: bundle.inputData.first_name,
      last_name: bundle.inputData.last_name,
      phone: bundle.inputData.phone,
      emergency_contact: bundle.inputData.emergency_contact,
      emergency_phone: bundle.inputData.emergency_phone,
      certification_level: bundle.inputData.certification_level,
      notes: bundle.inputData.notes,
    },
  });

  return response.data;
};

module.exports = {
  key: 'update_customer',
  noun: 'Customer',
  display: {
    label: 'Update Customer',
    description: 'Updates an existing customer in DiveStreams.',
  },
  operation: {
    perform: perform,
    inputFields: [
      {
        key: 'email',
        label: 'Customer Email',
        type: 'string',
        required: true,
        helpText: 'Email address to identify the customer',
      },
      {
        key: 'first_name',
        label: 'First Name',
        type: 'string',
        required: false,
      },
      {
        key: 'last_name',
        label: 'Last Name',
        type: 'string',
        required: false,
      },
      {
        key: 'phone',
        label: 'Phone',
        type: 'string',
        required: false,
      },
      {
        key: 'emergency_contact',
        label: 'Emergency Contact Name',
        type: 'string',
        required: false,
      },
      {
        key: 'emergency_phone',
        label: 'Emergency Contact Phone',
        type: 'string',
        required: false,
      },
      {
        key: 'certification_level',
        label: 'Certification Level',
        type: 'string',
        required: false,
        helpText: 'E.g., Open Water, Advanced, Rescue',
      },
      {
        key: 'notes',
        label: 'Notes',
        type: 'text',
        required: false,
      },
    ],
    outputFields: [
      { key: 'id', label: 'Customer ID' },
      { key: 'email', label: 'Email' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'phone', label: 'Phone' },
      { key: 'updated_at', label: 'Updated At' },
    ],
    sample: {
      id: 'cust_xyz789',
      email: 'john@example.com',
      first_name: 'John',
      last_name: 'Doe',
      phone: '+1234567890',
      updated_at: '2024-01-18T12:00:00Z',
    },
  },
};
