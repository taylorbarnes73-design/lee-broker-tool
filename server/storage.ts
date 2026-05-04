import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function getS3Client() {
  return new S3Client({ region: ENV.awsS3Region || ENV.awsRegion });
}

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) return Buffer.from([]);
  if (Buffer.isBuffer(stream)) return stream;
  const chunks: Buffer[] = [];
  // AWS SDK v3 GetObject Body is usually a Node.js Readable stream
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of stream as any) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const bucket = ENV.awsS3Bucket;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set");

  const key = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? Buffer.from(data) : data;

  await getS3Client().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType })
  );

  const url = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );

  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const bucket = ENV.awsS3Bucket;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set");

  const key = relKey.replace(/^\/+/, "");
  const url = await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );

  return { key, url };
}

export async function storageGetBytes(relKey: string): Promise<{ key: string; bytes: Buffer }> {
  const bucket = ENV.awsS3Bucket;
  if (!bucket) throw new Error("AWS_S3_BUCKET is not set");

  const key = relKey.replace(/^\/+/, "");
  const resp = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await streamToBuffer(resp.Body);
  return { key, bytes };
}
