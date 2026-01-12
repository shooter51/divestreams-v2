import { vi } from "vitest";

export const mockStripePaymentIntent = {
  id: "pi_test_123456",
  object: "payment_intent",
  amount: 10000,
  currency: "usd",
  status: "succeeded",
  client_secret: "pi_test_123456_secret_test",
  created: Date.now(),
  metadata: {},
};

export const mockStripeRefund = {
  id: "re_test_123456",
  object: "refund",
  amount: 5000,
  status: "succeeded",
  payment_intent: "pi_test_123456",
  created: Date.now(),
};

export const mockStripeCustomer = {
  id: "cus_test_123456",
  object: "customer",
  email: "test@example.com",
  name: "Test Customer",
  created: Date.now(),
};

export const createMockStripe = () => ({
  paymentIntents: {
    create: vi.fn().mockResolvedValue(mockStripePaymentIntent),
    retrieve: vi.fn().mockResolvedValue(mockStripePaymentIntent),
    confirm: vi.fn().mockResolvedValue({ ...mockStripePaymentIntent, status: "succeeded" }),
    cancel: vi.fn().mockResolvedValue({ ...mockStripePaymentIntent, status: "canceled" }),
  },
  refunds: {
    create: vi.fn().mockResolvedValue(mockStripeRefund),
    retrieve: vi.fn().mockResolvedValue(mockStripeRefund),
  },
  customers: {
    create: vi.fn().mockResolvedValue(mockStripeCustomer),
    retrieve: vi.fn().mockResolvedValue(mockStripeCustomer),
    update: vi.fn().mockResolvedValue(mockStripeCustomer),
  },
  webhooks: {
    constructEvent: vi.fn().mockImplementation((payload, sig, secret) => {
      return JSON.parse(payload);
    }),
  },
});

export const mockStripe = createMockStripe();

// Helper to reset all mocks
export const resetStripeMocks = () => {
  Object.values(mockStripe.paymentIntents).forEach((fn) => fn.mockClear());
  Object.values(mockStripe.refunds).forEach((fn) => fn.mockClear());
  Object.values(mockStripe.customers).forEach((fn) => fn.mockClear());
  mockStripe.webhooks.constructEvent.mockClear();
};
