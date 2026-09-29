import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

let s3Client: S3Client | null = null;
const S3_BUCKET = process.env.MINIO_BUCKET ?? process.env.AWS_S3_BUCKET ?? "strim";
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR ?? join(process.cwd(), "data", "storage");

function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY ?? process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.MINIO_SECRET_KEY ?? process.env.AWS_SECRET_ACCESS_KEY;

  if (endpoint && accessKey && secretKey) {
    s3Client = new S3Client({
      endpoint,
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true, // Required for MinIO
    });
    return s3Client;
  }
  return null;
}

export async function storePayload(
  key: string,
  content: string | Buffer | Record<string, unknown>,
): Promise<string> {
  const data = typeof content === "object" && !Buffer.isBuffer(content)
    ? JSON.stringify(content)
    : content;
  const bodyBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data);

  const client = getS3Client();
  if (client) {
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: key,
          Body: bodyBuffer,
          ContentType: typeof content === "object" && !Buffer.isBuffer(content) ? "application/json" : "text/plain",
        }),
      );
      return `s3://${S3_BUCKET}/${key}`;
    } catch {
      // Fallback to local storage on S3 failure
    }
  }

  // Local storage fallback
  const filePath = join(LOCAL_STORAGE_DIR, key);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, bodyBuffer);
  return `file://${key}`;
}

export async function getPayload(key: string): Promise<string | null> {
  const cleanKey = key.replace(/^s3:\/\/[^/]+\//, "").replace(/^file:\/\//, "");

  const client = getS3Client();
  if (client) {
    try {
      const res = await client.send(
        new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: cleanKey,
        }),
      );
      return (await res.Body?.transformToString()) ?? null;
    } catch {
      // Fallback to local
    }
  }

  try {
    const filePath = join(LOCAL_STORAGE_DIR, cleanKey);
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}
