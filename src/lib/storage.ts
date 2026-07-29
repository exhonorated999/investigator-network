import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Storage abstraction for uploaded files.
 *
 * v1 writes to a local directory (UPLOAD_DIR), which on Railway should be a
 * mounted persistent volume. The interface is deliberately small so it can be
 * swapped for S3 / Cloudflare R2 later without touching call sites.
 */

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./.uploads";

export interface StoredFile {
  /** Path relative to UPLOAD_DIR, stored in FileUpload.path */
  path: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export async function saveFile(
  file: { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> },
  purpose: string
): Promise<StoredFile> {
  const ext = path.extname(file.name);
  const key = `${purpose}/${randomUUID()}${ext}`;
  const absDir = path.join(UPLOAD_DIR, path.dirname(key));
  await fs.mkdir(absDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, key), buffer);

  return {
    path: key,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: buffer.byteLength,
  };
}

export async function readFile(relPath: string): Promise<Buffer> {
  return fs.readFile(path.join(UPLOAD_DIR, relPath));
}

export async function deleteFile(relPath: string): Promise<void> {
  await fs.rm(path.join(UPLOAD_DIR, relPath), { force: true });
}
