"use client";

import { useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { renderDicebearAvatar } from "@/lib/dicebear";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const GRID_SIZE = 15;

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

function svgDataUri(seed: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(renderDicebearAvatar(seed))}`;
}

interface AvatarPickerDialogProps {
  onSelected: (url: string) => void;
}

export function AvatarPickerDialog({ onSelected }: AvatarPickerDialogProps) {
  const [open, setOpen] = useState(false);
  // Generated lazily on first open (not during initial render) so the seed
  // list never differs between server and client render.
  const [seeds, setSeeds] = useState<string[] | null>(null);
  const [savingSeed, setSavingSeed] = useState<string | null>(null);

  function shuffle() {
    setSeeds(Array.from({ length: GRID_SIZE }, randomSeed));
  }

  async function handlePick(seed: string) {
    setSavingSeed(seed);
    try {
      const res = await fetch("/api/profile/avatar/dicebear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Could not save avatar.");
        return;
      }

      const { error } = await authClient.updateUser({ image: body.url });
      if (error) {
        toast.error(error.message || "Saved, but could not update your profile picture.");
        return;
      }

      onSelected(body.url);
      toast.success("Profile picture updated.");
      setOpen(false);
    } finally {
      setSavingSeed(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && !seeds) shuffle();
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Choose avatar
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose an avatar</DialogTitle>
          <DialogDescription>Pick one, or shuffle for more options.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-2">
          {(seeds ?? []).map((seed) => (
            <button
              key={seed}
              type="button"
              disabled={savingSeed !== null}
              onClick={() => handlePick(seed)}
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-full border border-border bg-muted transition hover:ring-2 hover:ring-ring disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- inline data: URI, not an optimizable remote asset */}
              <img src={svgDataUri(seed)} alt="" className="size-full" />
              {savingSeed === seed && (
                <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                  <Loader2 className="size-4 animate-spin" />
                </span>
              )}
            </button>
          ))}
        </div>

        <Button type="button" variant="ghost" size="sm" onClick={shuffle} disabled={savingSeed !== null} className="w-fit">
          <Shuffle className="size-4" />
          Shuffle
        </Button>
      </DialogContent>
    </Dialog>
  );
}
