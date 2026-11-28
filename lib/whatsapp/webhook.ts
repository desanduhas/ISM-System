import { createHmac, timingSafeEqual } from "crypto";

export function verifyMetaWebhookSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!signature?.startsWith("sha256=")) return false;

  const expected = Buffer.from(
    "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex"),
    "utf8"
  );
  const received = Buffer.from(signature, "utf8");

  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function webhookErrorMessage(status: { errors?: Array<{ title?: string; message?: string; code?: number }> }): string | null {
  const errors = status.errors || [];
  if (!errors.length) return null;
  return errors.map((error) => error.title || error.message || (error.code ? `Meta error ${error.code}` : "Meta delivery error")).join("; ");
}

