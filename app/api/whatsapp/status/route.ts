import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { requireAuth } from "@/lib/auth/get-user";
import { getWhatsAppConfig, getWhatsAppConfigurationSummary } from "@/lib/whatsapp/config";

export async function GET() {
  try {
    const profile = await requireAuth();
    if (profile.role !== "MANAGEMENT") {
      return NextResponse.json({ error: "Only management can view WhatsApp integration status" }, { status: 403 });
    }

    const config = getWhatsAppConfig();
    const summary = getWhatsAppConfigurationSummary();
    if (!config.live || !config.accessToken || !config.phoneNumberId) {
      return NextResponse.json({ ...summary, connected: false });
    }

    const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}`);
    url.searchParams.set("fields", "display_phone_number,verified_name,quality_rating,code_verification_status");
    if (config.appSecret) {
      url.searchParams.set("appsecret_proof", createHmac("sha256", config.appSecret).update(config.accessToken).digest("hex"));
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const result = await response.json() as {
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      code_verification_status?: string;
      error?: { message?: string; code?: number };
    };

    if (!response.ok || result.error) {
      return NextResponse.json({
        ...summary,
        connected: false,
        error: result.error?.message || `Meta API returned HTTP ${response.status}`,
        errorCode: result.error?.code,
      }, { status: 502 });
    }

    return NextResponse.json({
      ...summary,
      connected: true,
      phoneNumber: result.display_phone_number,
      verifiedName: result.verified_name,
      qualityRating: result.quality_rating,
      verificationStatus: result.code_verification_status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not check WhatsApp integration";
    const status = message === "UNAUTHORIZED" || message === "ACCOUNT_DISABLED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

