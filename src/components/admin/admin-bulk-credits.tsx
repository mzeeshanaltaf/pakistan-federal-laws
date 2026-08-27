"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Mode = "set" | "add";

export function AdminBulkCredits({ nonAdminUserCount }: { nonAdminUserCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("add");
  const [amountInput, setAmountInput] = useState("10");
  const [pending, setPending] = useState(false);

  const amount = Number(amountInput);
  const valid = amountInput.trim() !== "" && Number.isInteger(amount) && (mode === "add" || amount >= 0);

  function summary(): string {
    if (!valid) return "";
    if (mode === "set") return `Set every non-admin user's messages remaining to exactly ${amount}.`;
    return amount >= 0
      ? `Add ${amount} messages to every non-admin user's remaining balance.`
      : `Remove ${Math.abs(amount)} messages from every non-admin user's remaining balance (floored at 0).`;
  }

  async function apply() {
    if (!valid) return;
    setPending(true);
    const res = await fetch("/api/admin/users/credits", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, amount }),
    });
    setPending(false);
    if (!res.ok) {
      toast.error("Couldn't update message credits.");
      return;
    }
    const data = (await res.json()) as { updated: number };
    setOpen(false);
    toast.success(`Updated message credits for ${data.updated} user${data.updated === 1 ? "" : "s"}.`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Users className="size-4" />
        Update credits for all users
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update message credits for all users</DialogTitle>
          <DialogDescription>
            Applies to all {nonAdminUserCount} non-admin user{nonAdminUserCount === 1 ? "" : "s"}. Admins have no
            message limit and are unaffected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={mode === "add" ? "default" : "outline"}
              size="sm"
              className={cn("flex-1")}
              onClick={() => setMode("add")}
            >
              Add / subtract
            </Button>
            <Button
              type="button"
              variant={mode === "set" ? "default" : "outline"}
              size="sm"
              className={cn("flex-1")}
              onClick={() => setMode("set")}
            >
              Set exact value
            </Button>
          </div>

          <div>
            <Input
              type="number"
              step={1}
              min={mode === "set" ? 0 : undefined}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {mode === "add"
                ? "Positive numbers increase everyone's remaining messages; negative numbers decrease them (never below 0)."
                : "Every non-admin user's remaining messages will be set to this exact number."}
            </p>
          </div>

          {valid && <p className="text-sm text-foreground">{summary()}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={apply} disabled={!valid || pending}>
            Apply to all users
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
