import {
  buildTemplateComponents,
  buildTemplateRegistrationPayload,
  TEMPLATE_DOCS,
} from "@/lib/whatsapp/templates";
import { formatSriLankanPhone, generateIdempotencyKey } from "@/lib/utils";

describe("WhatsApp Template Utilities", () => {
  test("buildTemplateComponents returns body components", () => {
    const components = buildTemplateComponents("job_assigned", {
      job_number: "ISM-2026-0001",
      client_name: "Test Client",
      job_title: "Test Job",
      scheduled_date: "2026-11-15",
      job_url: "https://example.com/jobs/123",
    });
    expect(components).toHaveLength(1);
    expect(components[0].type).toBe("body");
    const params = components[0].parameters as Array<{ type: string; text: string }>;
    expect(params).toHaveLength(5);
    expect(params[0].text).toBe("ISM-2026-0001");
  });

  test("all templates have matching docs", () => {
    const templates = Object.keys(TEMPLATE_DOCS);
    expect(templates.length).toBeGreaterThan(0);
    templates.forEach(t => {
      expect(TEMPLATE_DOCS[t as keyof typeof TEMPLATE_DOCS].body).toBeTruthy();
      expect(TEMPLATE_DOCS[t as keyof typeof TEMPLATE_DOCS].params.length).toBeGreaterThan(0);
      expect(TEMPLATE_DOCS[t as keyof typeof TEMPLATE_DOCS].examples).toHaveLength(
        TEMPLATE_DOCS[t as keyof typeof TEMPLATE_DOCS].params.length
      );
    });
  });

  test("registration payloads include Meta review examples for every variable", () => {
    for (const name of Object.keys(TEMPLATE_DOCS) as Array<keyof typeof TEMPLATE_DOCS>) {
      const payload = buildTemplateRegistrationPayload(name);
      expect(payload.name).toBe(name);
      expect(payload.language).toBe("en_US");
      expect(payload.category).toBe("UTILITY");
      expect(payload.parameter_format).toBe("POSITIONAL");
      expect(payload.components[0].example.body_text[0]).toEqual(TEMPLATE_DOCS[name].examples);
    }
  });
});

describe("Phone number formatting", () => {
  test("formats local Sri Lankan number to E.164", () => {
    expect(formatSriLankanPhone("0771234567")).toBe("+94771234567");
  });

  test("handles number with country code 94", () => {
    expect(formatSriLankanPhone("94771234567")).toBe("+94771234567");
  });

  test("handles already formatted E.164 number", () => {
    expect(formatSriLankanPhone("+94771234567")).toBe("+94771234567");
  });

  test("handles 9-digit number", () => {
    expect(formatSriLankanPhone("771234567")).toBe("+94771234567");
  });
});

describe("Idempotency key generation", () => {
  test("generates consistent keys for same inputs", () => {
    const key1 = generateIdempotencyKey("notify", "job-123", "APPROVED");
    const key2 = generateIdempotencyKey("notify", "job-123", "APPROVED");
    expect(key1).toBe(key2);
  });

  test("generates different keys for different inputs", () => {
    const key1 = generateIdempotencyKey("notify", "job-123", "APPROVED");
    const key2 = generateIdempotencyKey("notify", "job-456", "APPROVED");
    expect(key1).not.toBe(key2);
  });
});

describe("Duplicate notification prevention", () => {
  test("idempotency key includes all identifying parts", () => {
    const key = generateIdempotencyKey("whatsapp", "job-123", "work_approved", "+94771234567");
    expect(key).toBe("whatsapp:job-123:work_approved:+94771234567");
  });
});
