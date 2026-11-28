const DEFAULT_GRAPH_API_VERSION = "v27.0";
const DEFAULT_TEMPLATE_LANGUAGE = "en_US";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export interface WhatsAppConfig {
  accessToken?: string;
  phoneNumberId?: string;
  wabaId?: string;
  verifyToken?: string;
  appSecret?: string;
  graphApiVersion: string;
  templateLanguage: string;
  appUrl: string;
  live: boolean;
}

export function getWhatsAppConfig(): WhatsAppConfig {
  const accessToken = readEnv("META_WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = readEnv("META_WHATSAPP_PHONE_NUMBER_ID");

  return {
    accessToken,
    phoneNumberId,
    wabaId: readEnv("META_WHATSAPP_WABA_ID"),
    verifyToken: readEnv("META_WHATSAPP_VERIFY_TOKEN"),
    appSecret: readEnv("META_WHATSAPP_APP_SECRET"),
    graphApiVersion: readEnv("META_GRAPH_API_VERSION") || DEFAULT_GRAPH_API_VERSION,
    templateLanguage: readEnv("META_WHATSAPP_TEMPLATE_LANGUAGE") || DEFAULT_TEMPLATE_LANGUAGE,
    appUrl: (readEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000").replace(/\/$/, ""),
    live: Boolean(accessToken && phoneNumberId),
  };
}

export function getWhatsAppConfigurationSummary() {
  const config = getWhatsAppConfig();
  const missing = [
    ["META_WHATSAPP_ACCESS_TOKEN", config.accessToken],
    ["META_WHATSAPP_PHONE_NUMBER_ID", config.phoneNumberId],
    ["META_WHATSAPP_WABA_ID", config.wabaId],
    ["META_WHATSAPP_VERIFY_TOKEN", config.verifyToken],
    ["META_WHATSAPP_APP_SECRET", config.appSecret],
  ].filter(([, value]) => !value).map(([name]) => name);

  return {
    mode: config.live ? "live" : "mock",
    graphApiVersion: config.graphApiVersion,
    templateLanguage: config.templateLanguage,
    webhookReady: Boolean(config.verifyToken && config.appSecret),
    missing,
  };
}

