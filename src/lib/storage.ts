import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";

// Private object storage (self-hosted MinIO). Every read is server-side — the
// browser never talks to storage directly; the file route streams bytes
// through the app. See add-minio-storage-to-coolify skill for the pattern.
const bucket = process.env.S3_BUCKET ?? "laws";

const s3 = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1", // required by the SDK; MinIO ignores it
  endpoint: process.env.S3_ENDPOINT,
  // MinIO serves buckets path-style (endpoint/bucket/key), not virtual-hosted.
  forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") !== "false",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

export interface DocumentStream {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

/** Stream the PDF at `storageKey` (documents.storage_key) without buffering it whole. */
export async function getDocumentStream(storageKey: string): Promise<DocumentStream> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
  return {
    body: res.Body as Readable,
    contentType: res.ContentType,
    contentLength: res.ContentLength,
  };
}

export async function putDocument(storageKey: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: body, ContentType: contentType })
  );
}

// The ingest pipeline needs the whole PDF in memory anyway (pdfjs parses a
// full buffer, not a stream), so this buffers getDocumentStream's Readable
// rather than teaching every other caller to.
export async function getDocumentBuffer(storageKey: string): Promise<Buffer> {
  const { body } = await getDocumentStream(storageKey);
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function deleteDocument(storageKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }));
}

// Profile pictures live in the same bucket under their own prefix, keyed by
// user id (not a generated filename) — a re-upload simply overwrites the
// previous picture rather than accumulating orphaned objects.
function avatarKey(userId: string): string {
  return `avatars/${userId}`;
}

export async function putAvatar(userId: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: avatarKey(userId), Body: body, ContentType: contentType })
  );
}

/** Returns null if the user has no uploaded avatar yet. */
export async function getAvatarStream(userId: string): Promise<DocumentStream | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: avatarKey(userId) }));
    return {
      body: res.Body as Readable,
      contentType: res.ContentType,
      contentLength: res.ContentLength,
    };
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw err;
  }
}

/** No-op if the user never uploaded an avatar. */
export async function deleteAvatar(userId: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: avatarKey(userId) }));
}
