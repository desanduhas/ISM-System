import { createHmac } from "crypto";
import { getWhatsAppConfig } from "./config";
import {
  buildTemplateRegistrationPayload,
  TEMPLATE_DOCS,
  type WhatsAppTemplateName,
} from "./templates";

export interface MetaTemplateSummary {
  name: string;
  language: string;
  status: string;
  category: string;
  id?: string;
}

export interface TemplateSetupResult {
  name: WhatsAppTemplateName;
  outcome: "created" | "existing" | "failed";
  status?: string;
  id?: string;
  error?: string;
}

function getTemplateManagerConfig() {
  const config = getWhatsAppConfig();
  if (!config.accessToken || !config.wabaId) {
    throw new Error("WhatsApp template management configuration is incomplete");
  }
  return { ...config, accessToken: config.accessToken, wabaId: config.wabaId };
}

function getAppSecretProof(accessToken: string, appSecret?: string) {
  return appSecret
    ? createHmac("sha256", appSecret).update(accessToken).digest("hex")
    : undefined;
}

async function readMetaJson<T>(response: Response): Promise<T> {
  const result = await response.json() as T & {
    error?: { message?: string; code?: number; error_user_msg?: string };
  };
  if (!response.ok || result.error) {
    const message = result.error?.error_user_msg || result.error?.message || `Meta API returned HTTP ${response.status}`;
    const code = result.error?.code ? ` (code ${result.error.code})` : "";
    throw new Error(`${message}${code}`);
  }
  return result;
}

export async function listWhatsAppTemplates(): Promise<MetaTemplateSummary[]> {
  const config = getTemplateManagerConfig();
  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${config.wabaId}/message_templates`);
  url.searchParams.set("fields", "id,name,language,status,category");
  url.searchParams.set("limit", "100");
  const proof = getAppSecretProof(config.accessToken, config.appSecret);
  if (proof) url.searchParams.set("appsecret_proof", proof);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const result = await readMetaJson<{ data?: MetaTemplateSummary[] }>(response);
  return result.data || [];
}

export async function createMissingWhatsAppTemplates(): Promise<TemplateSetupResult[]> {
  const config = getTemplateManagerConfig();
  const existing = await listWhatsAppTemplates();
  const templateNames = Object.keys(TEMPLATE_DOCS) as WhatsAppTemplateName[];
  const results: TemplateSetupResult[] = [];

  for (const name of templateNames) {
    const match = existing.find(
      template => template.name === name && template.language === config.templateLanguage
    );
    if (match) {
      results.push({ name, outcome: "existing", status: match.status, id: match.id });
      continue;
    }

    const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${config.wabaId}/message_templates`);
    const proof = getAppSecretProof(config.accessToken, config.appSecret);
    if (proof) url.searchParams.set("appsecret_proof", proof);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildTemplateRegistrationPayload(name, config.templateLanguage)),
        signal: AbortSignal.timeout(15_000),
      });
      const result = await readMetaJson<{ id?: string; status?: string }>(response);
      results.push({ name, outcome: "created", status: result.status || "PENDING", id: result.id });
    } catch (error) {
      results.push({
        name,
        outcome: "failed",
        error: error instanceof Error ? error.message : "Template creation failed",
      });
    }
  }

  return results;
}
