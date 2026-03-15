/**
 * Pact Consumer Contract Tests - Help API
 *
 * Defines the contract between the DiveStreams frontend (consumer) and the
 * Help API (provider) for the POST /api/help endpoint.
 */

import { describe, it, expect } from "vitest";
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
import path from "path";

const { like, eachLike } = MatchersV3;

const provider = new PactV3({
  consumer: "DiveStreamsFrontend",
  provider: "DiveStreamsAPI",
  dir: path.resolve(process.cwd(), "pacts/contracts"),
});

describe("Help API Contract", () => {
  describe("POST /api/help", () => {
    it("returns an answer and sources when the question matches articles", () => {
      return provider
        .given("user is authenticated and help articles exist")
        .uponReceiving("a POST request with a DiveStreams question")
        .withRequest({
          method: "POST",
          path: "/api/help",
          headers: { "Content-Type": "application/json" },
          body: { question: like("How do I create a booking?") },
        })
        .willRespondWith({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: {
            answer: like("Go to the Bookings page and click New Booking."),
            sources: eachLike({
              title: like("Managing Bookings"),
              path: like("docs/help/bookings.md"),
            }),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/help`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: "How do I create a booking?" }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(typeof data.answer).toBe("string");
          expect(data.answer.length).toBeGreaterThan(0);
          expect(Array.isArray(data.sources)).toBe(true);
        });
    });

    it("returns a canned response when no articles are relevant", () => {
      return provider
        .given("user is authenticated but question has no matching articles")
        .uponReceiving("a POST request with an off-topic question")
        .withRequest({
          method: "POST",
          path: "/api/help",
          headers: { "Content-Type": "application/json" },
          body: { question: like("xyzquux unrelated query") },
        })
        .willRespondWith({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: {
            answer: like("I can help with DiveStreams features"),
            sources: [],
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/help`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: "xyzquux unrelated query" }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(Array.isArray(data.sources)).toBe(true);
          expect(data.sources).toHaveLength(0);
        });
    });

    it("returns 429 when rate limit is exceeded", () => {
      return provider
        .given("user has exceeded their hourly question limit")
        .uponReceiving("a POST request that exceeds the rate limit")
        .withRequest({
          method: "POST",
          path: "/api/help",
          headers: { "Content-Type": "application/json" },
          body: { question: like("help") },
        })
        .willRespondWith({
          status: 429,
          headers: { "Content-Type": "application/json" },
          body: {
            error: like("Too many requests"),
            resetAt: like(1700000000000),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/help`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: "help" }),
          });

          expect(response.status).toBe(429);
          const data = await response.json();
          expect(data.error).toBeDefined();
          expect(data.resetAt).toBeDefined();
        });
    });

    it("returns 400 when question is missing", () => {
      return provider
        .given("user is authenticated")
        .uponReceiving("a POST request with missing question field")
        .withRequest({
          method: "POST",
          path: "/api/help",
          headers: { "Content-Type": "application/json" },
          body: {},
        })
        .willRespondWith({
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: {
            error: like("question is required"),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/help`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          });

          expect(response.status).toBe(400);
          const data = await response.json();
          expect(data.error).toBeDefined();
        });
    });
  });
});
