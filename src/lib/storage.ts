import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
