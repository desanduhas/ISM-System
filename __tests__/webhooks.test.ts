import { createHmac } from "crypto";

describe("WhatsApp Webhook Verification & Security", () => {
  const VERIFY_TOKEN = "test_meta_webhook_token_12345";
  const APP_SECRET = "super_secret_meta_app_key";

  function verifyChallenge(mode: string | null, token: string | null, challenge: string | null) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return { status: 200, challenge };
    }
    return { status: 403, error: "Forbidden" };
  }

  function verifySignature(signature: string | null, rawBody: string, appSecret: string): boolean {
    if (!signature) return false;
    const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
    return signature === expected;
  }

  test("approves subscription challenge with matching token", () => {
    const res = verifyChallenge("subscribe", VERIFY_TOKEN, "1158201244");
    expect(res.status).toBe(200);
    expect(res.challenge).toBe("1158201244");
  });

  test("rejects subscription challenge with invalid token", () => {
    const res = verifyChallenge("subscribe", "wrong_token", "1158201244");
    expect(res.status).toBe(403);
  });

  test("rejects subscription challenge with incorrect mode", () => {
    const res = verifyChallenge("unsubscribe", VERIFY_TOKEN, "1158201244");
    expect(res.status).toBe(403);
  });

  test("validates genuine Meta HMAC SHA256 signature", () => {
    const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = "sha256=" + createHmac("sha256", APP_SECRET).update(payload).digest("hex");

    expect(verifySignature(signature, payload, APP_SECRET)).toBe(true);
  });

  test("rejects tampered or mismatched payload signature", () => {
    const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const tamperedPayload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "fake" }] });
    const signature = "sha256=" + createHmac("sha256", APP_SECRET).update(payload).digest("hex");

    expect(verifySignature(signature, tamperedPayload, APP_SECRET)).toBe(false);
  });

  test("rejects request without signature header", () => {
    expect(verifySignature(null, "{}", APP_SECRET)).toBe(false);
  });
});

describe("WhatsApp Webhook Event Parsing", () => {
  test("parses delivery and read status updates from Meta payload", () => {
    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_123",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "94771234567", phone_number_id: "PHONE_ID_123" },
                statuses: [
                  {
                    id: "wamid.HBgNNzcxMjM0NTY3FQIAERgSMTAyOEQ2OUQxODAy",
                    status: "delivered",
                    timestamp: "1731550000",
                    recipient_id: "94771234567",
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    const statusObj = metaPayload.entry[0].changes[0].value.statuses[0];
    expect(statusObj.id).toBe("wamid.HBgNNzcxMjM0NTY3FQIAERgSMTAyOEQ2OUQxODAy");
    expect(statusObj.status.toUpperCase()).toBe("DELIVERED");

    const isoDate = new Date(parseInt(statusObj.timestamp) * 1000).toISOString();
    expect(isoDate).toContain("2024-11-14");
  });
});
