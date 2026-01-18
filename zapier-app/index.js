/**
 * DiveStreams Zapier Integration
 *
 * Main app definition for Zapier Platform CLI
 */

const authentication = require('./authentication');
const newBookingTrigger = require('./triggers/new-booking');
const paymentReceivedTrigger = require('./triggers/payment-received');
const newCustomerTrigger = require('./triggers/new-customer');
const createBookingAction = require('./actions/create-booking');
const updateCustomerAction = require('./actions/update-customer');

module.exports = {
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  // Authentication configuration
  authentication: authentication,

  // Triggers
  triggers: {
    [newBookingTrigger.key]: newBookingTrigger,
    [paymentReceivedTrigger.key]: paymentReceivedTrigger,
    [newCustomerTrigger.key]: newCustomerTrigger,
  },

  // Actions
  creates: {
    [createBookingAction.key]: createBookingAction,
    [updateCustomerAction.key]: updateCustomerAction,
  },

  // Searches (can add later if needed)
  searches: {},

  // Before/after middleware
  beforeRequest: [],
  afterResponse: [],
};
