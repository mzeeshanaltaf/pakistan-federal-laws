"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Trash2, RefreshCw, Eye, Download } from "lucide-react";
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
import { PdfViewer } from "@/components/pdf-viewer-loader";
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
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500];

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
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<AdminDocumentRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasActiveJobs = documents.some((d) => ACTIVE_STATUSES.has(d.ingestStatus));

  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageDocuments = useMemo(
    () => documents.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [documents, currentPage, pageSize]
  );
  const allOnPageSelected = pageDocuments.length > 0 && pageDocuments.every((d) => selectedIds.has(d.id));

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
    if (!pendingDeleteIds || pendingDeleteIds.length === 0) return;
    setDeleting(true);
    try {
      const results = await Promise.all(
        pendingDeleteIds.map((id) => fetch(`/api/admin/documents/${id}`, { method: "DELETE" }))
      );
      const failed = results.filter((r) => !r.ok).length;
      const deletedIds = new Set(pendingDeleteIds.filter((_, i) => results[i].ok));

      setDocuments((docs) => docs.filter((d) => !deletedIds.has(d.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deletedIds.forEach((id) => next.delete(id));
        return next;
      });

      if (failed > 0) {
        toast.error(
          deletedIds.size > 0
            ? `Deleted ${deletedIds.size}, but ${failed} failed.`
            : "Could not delete document(s)."
        );
      } else if (deletedIds.size > 1) {
        toast.success(`Deleted ${deletedIds.size} documents.`);
      }
      setPendingDeleteIds(null);
    } finally {
      setDeleting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageDocuments.forEach((d) => next.delete(d.id));
      } else {
        pageDocuments.forEach((d) => next.add(d.id));
      }
      return next;
    });
  }

  function handlePageSizeChange(next: number) {
    setPageSize(next);
    setPage(1);
  }

  const deleteTargets = documents.filter((d) => pendingDeleteIds?.includes(d.id));

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
            <label className="text-sm font-medium">PDF file</label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                Choose File
              </Button>
              <span className="truncate text-sm text-muted-foreground">
                {file ? file.name : "No file chosen"}
              </span>
              <input
                id="doc-file"
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </div>
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ingested documents</h2>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setPendingDeleteIds(Array.from(selectedIds))}
              >
                <Trash2 className="size-4" />
                Delete selected ({selectedIds.size})
              </Button>
            ) : null}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <label htmlFor="doc-page-size">Per page</label>
              <select
                id="doc-page-size"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all documents on this page"
                    className="size-4"
                  />
                </th>
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
              {pageDocuments.map((doc) => (
                <tr key={doc.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => toggleSelect(doc.id)}
                      aria-label={`Select ${doc.title}`}
                      className="size-4"
                    />
                  </td>
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPreviewDoc(doc)}
                        aria-label="Preview document"
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        nativeButton={false}
                        render={<a href={`/api/documents/${doc.slug}/file?download=1`} download aria-label="Download document" />}
                      >
                        <Download className="size-4" />
                      </Button>
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
                        onClick={() => setPendingDeleteIds([doc.id])}
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

        {documents.length > 0 ? (
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, documents.length)} of{" "}
              {documents.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="tabular-nums">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={previewDoc !== null} onOpenChange={(next) => !next && setPreviewDoc(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title}</DialogTitle>
          </DialogHeader>
          {previewDoc ? <PdfViewer key={previewDoc.id} fileUrl={`/api/documents/${previewDoc.slug}/file`} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDeleteIds !== null} onOpenChange={(next) => !next && setPendingDeleteIds(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{deleteTargets.length > 1 ? `Delete ${deleteTargets.length} documents?` : "Delete document?"}</DialogTitle>
            <DialogDescription>
              {deleteTargets.length > 1
                ? `This permanently deletes ${deleteTargets.length} documents, their chunks, and the stored PDFs. This cannot be undone.`
                : `This permanently deletes "${deleteTargets[0]?.title}", its chunks, and the stored PDF. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDeleteIds(null)} disabled={deleting}>
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
