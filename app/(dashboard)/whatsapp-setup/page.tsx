import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/get-user";
import WhatsAppSetupClient from "./whatsapp-setup-client";

export const metadata = {
  title: "WhatsApp Setup | ISM Flow",
  description: "Manage the approved WhatsApp templates used by ISM Flow workflows",
};

export default async function WhatsAppSetupPage() {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  if (profile.role !== "MANAGEMENT") redirect("/");

  return <WhatsAppSetupClient />;
}
