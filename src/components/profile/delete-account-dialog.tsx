"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DeleteAccountDialogProps {
  email: string;
}

export function DeleteAccountDialog({ email }: DeleteAccountDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText.trim().toLowerCase() === email.toLowerCase();

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/profile/delete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Could not delete your account.");
        return;
      }
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <DialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
        Delete account
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This permanently deletes your account, chat history, bookmarks, and profile picture. This action
            cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="confirmEmail" className="text-sm font-medium">
            To confirm, type your email <span className="font-semibold">{email}</span>
          </label>
          <Input
            id="confirmEmail"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="h-10 px-3.5 py-2"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={!canDelete || deleting} onClick={handleDelete}>
            {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
            {deleting ? "Deleting…" : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
