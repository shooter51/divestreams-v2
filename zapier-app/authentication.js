/**
 * Authentication configuration for DiveStreams Zapier integration
 *
 * Uses API Key authentication
 */

const testAuth = async (z, bundle) => {
  // Test the API key by calling the test endpoint
  const response = await z.request({
    url: 'https://divestreams.com/api/zapier/test',
    method: 'GET',
  });

  // If the request succeeds, return the organization info
  return response.data;
};

module.exports = {
  type: 'custom',

  // Fields to show in the authentication form
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      required: true,
      type: 'string',
      helpText: 'Get your API key from DiveStreams Settings > Integrations > Zapier',
    },
  ],

  // Test function to verify authentication
  test: testAuth,

  // Connection label to show in Zapier UI
  connectionLabel: '{{organization.name}} ({{organization.subdomain}})',
};

// Add API key to all requests
const addApiKeyToHeader = (request, z, bundle) => {
  if (bundle.authData.apiKey) {
    request.headers['X-API-Key'] = bundle.authData.apiKey;
  }
  return request;
};

module.exports.beforeRequest = [addApiKeyToHeader];
