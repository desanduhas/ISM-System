import { requireAuth } from "@/lib/auth/get-user";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/layout/workspace-shell";
import "./modules.css";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  return <WorkspaceShell profile={profile}>{children}</WorkspaceShell>;
}
