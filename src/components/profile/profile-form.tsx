"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/password-input";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Better Auth's user table has a single `name` column, not separate
// first/last fields — split for the two inputs here, recombined on save.
function splitName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1).trim() };
}

interface ProfileFormProps {
  name: string;
  email: string;
  image: string | null;
}

export function ProfileForm({ name, email, image }: ProfileFormProps) {
  const router = useRouter();
  const initial = splitName(name);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [avatarUrl, setAvatarUrl] = useState(image);
  const [savingName, setSavingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google-only accounts have no credential (password) account to change —
  // hide the password card for them rather than showing a form that always fails.
  const [hasPasswordAccount, setHasPasswordAccount] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    authClient.listAccounts().then(({ data }) => {
      setHasPasswordAccount(!!data?.some((a) => a.providerId === "credential"));
    });
  }, []);

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error("First name is required.");
      return;
    }

    setSavingName(true);
    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
      const { error } = await authClient.updateUser({ name: fullName });
      if (error) {
        toast.error(error.message || "Could not update your name.");
        return;
      }
      toast.success("Name updated.");
      router.refresh();
    } finally {
      setSavingName(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error("Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be 2MB or smaller.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Could not upload image.");
        return;
      }

      const { error } = await authClient.updateUser({ image: body.url });
      if (error) {
        toast.error(error.message || "Uploaded, but could not save your profile picture.");
        return;
      }

      setAvatarUrl(body.url);
      toast.success("Profile picture updated.");
      router.refresh();
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match.");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        toast.error(error.message || "Could not change your password.");
        return;
      }
      toast.success("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="mt-10 flex flex-col gap-8">
      <div className="rounded-xl border border-border p-6 sm:p-8">
        <h2 className="text-lg font-semibold">Basic info</h2>

        <div className="mt-5 flex items-center gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- streamed from a private-storage proxy route, not an optimizable remote URL
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              <UserRound className="absolute inset-0 m-auto size-7 text-muted-foreground" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : null}
              {uploadingAvatar ? "Uploading…" : "Change picture"}
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">JPEG, PNG, or WebP. Max 2MB.</p>
          </div>
        </div>

        <form onSubmit={handleNameSubmit} noValidate className="mt-6 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="firstName" className="text-sm font-medium">
                First name
              </label>
              <Input
                id="firstName"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-10 px-3.5 py-2"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="lastName" className="text-sm font-medium">
                Last name
              </label>
              <Input
                id="lastName"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-10 px-3.5 py-2"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input id="email" value={email} disabled readOnly className="h-10 px-3.5 py-2" />
          </div>

          <Button type="submit" disabled={savingName} className="w-fit">
            {savingName ? <Loader2 className="size-4 animate-spin" /> : null}
            {savingName ? "Saving…" : "Save name"}
          </Button>
        </form>
      </div>

      {hasPasswordAccount && (
        <div className="rounded-xl border border-border p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Password</h2>
          <form onSubmit={handlePasswordSubmit} noValidate className="mt-5 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="currentPassword" className="text-sm font-medium">
                Current password
              </label>
              <PasswordInput
                id="currentPassword"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-10 px-3.5 py-2"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                New password
              </label>
              <PasswordInput
                id="newPassword"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 px-3.5 py-2"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm new password
              </label>
              <PasswordInput
                id="confirmPassword"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 px-3.5 py-2"
              />
            </div>
            <Button type="submit" disabled={changingPassword} className="w-fit">
              {changingPassword ? <Loader2 className="size-4 animate-spin" /> : null}
              {changingPassword ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>
      )}

      {hasPasswordAccount === false && (
        <div className="rounded-xl border border-border p-6 sm:p-8">
          <h2 className="text-lg font-semibold">Password</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You signed in with Google, so there&apos;s no password to manage here.
          </p>
        </div>
      )}
    </div>
  );
}
