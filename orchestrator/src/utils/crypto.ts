import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const received = signature.slice("sha256=".length);

  if (expected.length !== received.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
