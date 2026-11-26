"use client";

import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import OperationDialog from "@/app/(dashboard)/_components/operation-dialog";
import PasswordInput from "@/components/ui/password-input";

interface ChangePasswordDialogProps {
  email: string;
  onDismiss: () => void;
}

/** Self-service password update dialog for the signed-in user. */
export default function ChangePasswordDialog({ email, onDismiss }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setError("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not update password.");
      }
      toast.success("Password updated successfully.");
      onDismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OperationDialog
      titleId="change-password-dialog"
      onDismiss={() => {
        if (!saving) onDismiss();
      }}
      className="w-full max-w-md"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          <h2 id="change-password-dialog" className="font-semibold text-slate-900">
            Change Password
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{email}</p>
        </div>
        <button
          type="button"
          aria-label="Close dialog"
          disabled={saving}
          onClick={onDismiss}
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label htmlFor="account-current-password" className="block text-sm font-medium text-slate-700 mb-1">
            Current Password *
          </label>
          <PasswordInput
            id="account-current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter current password"
            required
          />
        </div>

        <div>
          <label htmlFor="account-new-password" className="block text-sm font-medium text-slate-700 mb-1">
            New Password *
          </label>
          <PasswordInput
            id="account-new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </div>

        <div>
          <label htmlFor="account-confirm-password" className="block text-sm font-medium text-slate-700 mb-1">
            Confirm New Password *
          </label>
          <PasswordInput
            id="account-confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter new password"
            minLength={6}
            required
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <KeyRound size={15} />
                Update Password
              </>
            )}
          </button>
        </div>
      </form>
    </OperationDialog>
  );
}
