/**
 * Pact Consumer Contract Tests - Stripe Webhooks
 *
 * Tests the contract between Stripe (consumer) and DiveStreams API (provider)
 * for webhook event handling.
 */

import { describe, it, expect } from "vitest";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
import path from "path";

const { like, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: "Stripe",
  provider: "DiveStreamsAPI",
  dir: path.resolve(process.cwd(), "pacts/contracts"),
});

describe("Stripe Webhook Contract", () => {
  describe("POST /api/webhooks/stripe", () => {
    it("handles customer.subscription.created event", () => {
      return provider
        .given("valid Stripe signature")
        .uponReceiving("a subscription created webhook")
        .withRequest({
          method: "POST",
          path: "/api/webhooks/stripe",
          headers: {
            "stripe-signature": like("t=1234567890,v1=signature"),
            "Content-Type": "application/json",
          },
          body: {
            id: like("evt_1234567890"),
            type: like("customer.subscription.created"),
            data: {
              object: {
                id: like("sub_1234567890"),
                customer: like("cus_1234567890"),
                status: like("active"),
                items: {
                  data: eachLike({
                    price: {
                      id: like("price_1234567890"),
                    },
                  }),
                },
              },
            },
            created: like(1234567890),
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            received: like(true),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/webhooks/stripe`, {
            method: "POST",
            headers: {
              "stripe-signature": "t=1234567890,v1=signature",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: "evt_1234567890",
              type: "customer.subscription.created",
              data: {
                object: {
                  id: "sub_1234567890",
                  customer: "cus_1234567890",
                  status: "active",
                  items: {
                    data: [
                      {
                        price: {
                          id: "price_1234567890",
                        },
                      },
                    ],
                  },
                },
              },
              created: 1234567890,
            }),
          });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.received).toBe(true);
        });
    });

    it("handles customer.subscription.updated event", () => {
      return provider
        .given("valid Stripe signature")
        .uponReceiving("a subscription updated webhook")
        .withRequest({
          method: "POST",
          path: "/api/webhooks/stripe",
          headers: {
            "stripe-signature": like("t=1234567890,v1=signature"),
            "Content-Type": "application/json",
          },
          body: {
            id: like("evt_9876543210"),
            type: like("customer.subscription.updated"),
            data: {
              object: {
                id: like("sub_1234567890"),
                customer: like("cus_1234567890"),
                status: like("active"),
                cancel_at_period_end: like(false),
              },
            },
            created: like(1234567890),
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            received: like(true),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/webhooks/stripe`, {
            method: "POST",
            headers: {
              "stripe-signature": "t=1234567890,v1=signature",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: "evt_9876543210",
              type: "customer.subscription.updated",
              data: {
                object: {
                  id: "sub_1234567890",
                  customer: "cus_1234567890",
                  status: "active",
                  cancel_at_period_end: false,
                },
              },
              created: 1234567890,
            }),
          });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.received).toBe(true);
        });
    });

    it("handles customer.subscription.deleted event", () => {
      return provider
        .given("valid Stripe signature")
        .uponReceiving("a subscription deleted webhook")
        .withRequest({
          method: "POST",
          path: "/api/webhooks/stripe",
          headers: {
            "stripe-signature": like("t=1234567890,v1=signature"),
            "Content-Type": "application/json",
          },
          body: {
            id: like("evt_deleted123"),
            type: like("customer.subscription.deleted"),
            data: {
              object: {
                id: like("sub_1234567890"),
                customer: like("cus_1234567890"),
                status: like("canceled"),
              },
            },
            created: like(1234567890),
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            received: like(true),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/webhooks/stripe`, {
            method: "POST",
            headers: {
              "stripe-signature": "t=1234567890,v1=signature",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: "evt_deleted123",
              type: "customer.subscription.deleted",
              data: {
                object: {
                  id: "sub_1234567890",
                  customer: "cus_1234567890",
                  status: "canceled",
                },
              },
              created: 1234567890,
            }),
          });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.received).toBe(true);
        });
    });

    it("returns 400 when signature is invalid", () => {
      return provider
        .given("invalid Stripe signature")
        .uponReceiving("a webhook with invalid signature")
        .withRequest({
          method: "POST",
          path: "/api/webhooks/stripe",
          headers: {
            "stripe-signature": "t=1234567890,v1=invalid_signature",
            "Content-Type": "application/json",
          },
          body: {
            id: like("evt_1234567890"),
            type: like("customer.subscription.created"),
          },
        })
        .willRespondWith({
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            error: like("Invalid signature"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/webhooks/stripe`, {
            method: "POST",
            headers: {
              "stripe-signature": "t=1234567890,v1=invalid_signature",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: "evt_1234567890",
              type: "customer.subscription.created",
            }),
          });
          const data = await response.json();

          expect(response.status).toBe(400);
          expect(data.error).toBe("Invalid signature");
        });
    });

    it("handles invoice.payment_succeeded event", () => {
      return provider
        .given("valid Stripe signature")
        .uponReceiving("an invoice payment succeeded webhook")
        .withRequest({
          method: "POST",
          path: "/api/webhooks/stripe",
          headers: {
            "stripe-signature": like("t=1234567890,v1=signature"),
            "Content-Type": "application/json",
          },
          body: {
            id: like("evt_invoice_paid"),
            type: like("invoice.payment_succeeded"),
            data: {
              object: {
                id: like("in_1234567890"),
                customer: like("cus_1234567890"),
                subscription: like("sub_1234567890"),
                amount_paid: like(2999),
                status: like("paid"),
              },
            },
            created: like(1234567890),
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            received: like(true),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/webhooks/stripe`, {
            method: "POST",
            headers: {
              "stripe-signature": "t=1234567890,v1=signature",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: "evt_invoice_paid",
              type: "invoice.payment_succeeded",
              data: {
                object: {
                  id: "in_1234567890",
                  customer: "cus_1234567890",
                  subscription: "sub_1234567890",
                  amount_paid: 2999,
                  status: "paid",
                },
              },
              created: 1234567890,
            }),
          });
          const data = await response.json();

          expect(response.status).toBe(200);
          expect(data.received).toBe(true);
        });
    });
  });
});
