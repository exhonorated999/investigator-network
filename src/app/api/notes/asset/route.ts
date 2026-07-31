import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { parseEmbedInput } from "@/lib/embed";
import { parseVideoInput } from "@/lib/video";

/**
 * Editor side-channel for the two things the client cannot do itself:
 * store an uploaded file, and normalize a pasted provider URL.
 *
 * The old builder folded both of these into server actions that ALSO rewrote
 * the block and saved the document. That does not fit the visual editor, where
 * the client owns the document — so these endpoints do one job each and hand
 * the result back for the client to patch into the block. The block update then
 * flows through the ordinary autosave like every other edit.
 */

const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/** "PDF · 2.4 MB" — display-only metadata for file rows. */
function describeFile(mime: string, bytes: number): string {
  const kind =
    mime.split("/")[1]?.toUpperCase().replace("VND.", "").slice(0, 12) || "FILE";
  const mb = bytes / 1048576;
  const size =
    mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${kind} · ${size}`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  // --- paste normalization (JSON) ----------------------------------------
  if (contentType.includes("application/json")) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
    }
    const o = (body ?? {}) as Record<string, unknown>;
    const raw = String(o.raw ?? "");

    if (o.kind === "embed") {
      return NextResponse.json(parseEmbedInput(raw));
    }
    if (o.kind === "video") {
      const provider = o.provider === "bunny" ? "bunny" : "youtube";
      // parseVideoInput lives in lib/video.ts, which pulls in node:crypto for
      // Bunny signing — that is why this cannot just run in the browser.
      return NextResponse.json(parseVideoInput(raw, provider));
    }
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  }

  // --- upload (multipart) -------------------------------------------------
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }
  if (file.size > MAX_ASSET_BYTES) {
    return NextResponse.json(
      { error: "File is larger than 25 MB" },
      { status: 413 }
    );
  }

  // `course-asset` is the purpose the /api/files route treats as readable by
  // any signed-in user — course material is shared with learners by definition.
  const stored = await saveFile(file, "course-asset");
  const record = await prisma.fileUpload.create({
    data: {
      ownerUserId: session.user.id,
      path: stored.path,
      filename: stored.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      purpose: "course-asset",
    },
  });

  return NextResponse.json({
    url: `/api/files/${record.id}`,
    filename: stored.filename,
    meta: describeFile(stored.mimeType, stored.sizeBytes),
  });
}
