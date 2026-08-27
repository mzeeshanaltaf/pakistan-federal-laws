"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminDocumentRow } from "@/lib/admin-documents-queries";

interface Category {
  id: number;
  name: string;
}

interface AdminDocumentsPanelProps {
  categories: Category[];
  initialDocuments: AdminDocumentRow[];
}

const ACTIVE_STATUSES = new Set(["pending", "processing"]);

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "failed") return "destructive";
  if (status === "summarized") return "default";
  if (ACTIVE_STATUSES.has(status)) return "secondary";
  return "outline";
}

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Queued";
    case "processing":
      return "Processing…";
    case "chunked":
      return "Chunked";
    case "summarized":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminDocumentsPanel({ categories, initialDocuments }: AdminDocumentsPanelProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id.toString() ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasActiveJobs = documents.some((d) => ACTIVE_STATUSES.has(d.ingestStatus));

  async function refresh() {
    const res = await fetch("/api/admin/documents");
    if (!res.ok) return;
    const body = (await res.json()) as { documents: AdminDocumentRow[] };
    setDocuments(body.documents);
  }

  useEffect(() => {
    if (!hasActiveJobs) return;
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [hasActiveJobs]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim() || !categoryId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("categoryId", categoryId);
      formData.append("file", file);

      const res = await fetch("/api/admin/documents", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Upload failed.");
        return;
      }
      toast.success("Uploaded — ingestion started.");
      setTitle("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } finally {
      setUploading(false);
    }
  }

  async function handleRetry(id: string) {
    const res = await fetch(`/api/admin/documents/${id}/retry`, { method: "POST" });
    if (!res.ok) {
      toast.error("Could not restart ingestion.");
      return;
    }
    toast.success("Ingestion restarted.");
    await refresh();
  }

  async function handleDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/documents/${pendingDeleteId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Could not delete document.");
        return;
      }
      setDocuments((docs) => docs.filter((d) => d.id !== pendingDeleteId));
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  const deleteTarget = documents.find((d) => d.id === pendingDeleteId);

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleUpload} className="rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold">Upload a document</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="doc-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Some Act, 2026"
              className="h-10 px-3.5 py-2"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="doc-category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="doc-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 rounded-md border border-input bg-transparent px-3.5 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="doc-file" className="text-sm font-medium">
              PDF file
            </label>
            <input
              id="doc-file"
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
        </div>
        <Button
          type="submit"
          className="mt-4"
          disabled={uploading || !file || !title.trim() || !categoryId}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : null}
          {uploading ? "Uploading…" : "Ingest"}
        </Button>
      </form>

      <div>
        <h2 className="text-lg font-semibold">Ingested documents</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Pages</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Chunks</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Size</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{doc.title}</div>
                    {doc.ingestStatus === "failed" && doc.ingestError ? (
                      <div className="mt-1 text-xs text-destructive">{doc.ingestError}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{doc.categoryName ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{doc.numPages ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{doc.chunkCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBytes(doc.fileSizeBytes)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(doc.ingestStatus)}>
                      {ACTIVE_STATUSES.has(doc.ingestStatus) ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : null}
                      {statusLabel(doc.ingestStatus)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {doc.ingestStatus === "failed" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRetry(doc.id)}
                          aria-label="Retry ingestion"
                        >
                          <RefreshCw className="size-4" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDeleteId(doc.id)}
                        aria-label="Delete document"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {documents.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : null}
        </div>
      </div>

      <Dialog open={pendingDeleteId !== null} onOpenChange={(next) => !next && setPendingDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              This permanently deletes &quot;{deleteTarget?.title}&quot;, its chunks, and the stored PDF. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
