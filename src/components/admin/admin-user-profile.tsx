"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldBan, ShieldCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { AdminUserDetail } from "@/lib/admin-user-detail-queries";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function AdminUserProfile({ user, viewerIsSelf }: { user: AdminUserDetail; viewerIsSelf: boolean }) {
  const router = useRouter();
  const [banReason, setBanReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirmBan() {
    setPending(true);
    const { error } = await authClient.admin.banUser({
      userId: user.id,
      banReason: banReason.trim() || undefined,
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Couldn't ban this user.");
      return;
    }
    setDialogOpen(false);
    setBanReason("");
    toast.success("User banned.");
    router.refresh();
  }

  async function unban() {
    setPending(true);
    const { error } = await authClient.admin.unbanUser({ userId: user.id });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Couldn't unban this user.");
      return;
    }
    toast.success("User unbanned.");
    router.refresh();
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-14 rounded-full object-cover" />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-full bg-muted text-lg font-medium text-muted-foreground">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-lg font-medium text-foreground">{user.name ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role ?? "user"}</Badge>
        <Badge variant={user.emailVerified ? "secondary" : "outline"}>
          {user.emailVerified ? "Email verified" : "Email unverified"}
        </Badge>
        {user.banned && <Badge variant="destructive">Banned</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Joined</p>
          <p className="mt-0.5 text-foreground">{formatDate(user.createdAt)}</p>
        </div>
        {user.banned && (
          <div>
            <p className="text-muted-foreground">Ban expires</p>
            <p className="mt-0.5 text-foreground">{user.banExpires ? formatDate(user.banExpires) : "Never"}</p>
          </div>
        )}
      </div>

      {user.banned && user.banReason && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="text-muted-foreground">Ban reason</p>
          <p className="mt-0.5 text-foreground">{user.banReason}</p>
        </div>
      )}

      <div className="border-t border-border pt-6">
        {viewerIsSelf ? (
          <p className="text-sm text-muted-foreground">You can&apos;t ban your own account.</p>
        ) : user.banned ? (
          <Button variant="outline" onClick={unban} disabled={pending}>
            <ShieldCheck /> Unban user
          </Button>
        ) : (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button variant="destructive" onClick={() => setDialogOpen(true)}>
              <ShieldBan /> Ban user
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ban {user.name ?? user.email}?</DialogTitle>
                <DialogDescription>
                  They&apos;ll be signed out and unable to sign in again until unbanned.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Reason (optional, shown to admins only)"
                rows={3}
              />
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button variant="destructive" onClick={confirmBan} disabled={pending}>
                  Ban user
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
