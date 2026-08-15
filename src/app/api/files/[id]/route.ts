import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";

/**
 * Serve an uploaded file. Access: the owner, or any ADMIN.
 * Files are stored on disk (UPLOAD_DIR); only metadata lives in the DB.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.fileUpload.findUnique({ where: { id } });
  if (!file) return new NextResponse("Not found", { status: 404 });

  const isOwner = file.ownerUserId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  // Course covers and course notes assets are shared teaching material, not
  // private evidence: any signed-in user may read them. Everything else —
  // assignment submissions in particular — stays owner-or-admin.
  const isPublicAsset =
    file.purpose === "course-cover" ||
    file.purpose === "course-asset" ||
    file.purpose === "partner-logo" ||
    file.purpose === "podcast-audio";
  if (!isOwner && !isAdmin && !isPublicAsset) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(file.path);
  } catch {
    return new NextResponse("File missing", { status: 404 });
  }

  const contentType = file.mimeType || "application/octet-stream";
  const total = buffer.byteLength;

  // Range support — required for reliable <audio>/<video> seeking. Browsers
  // send `Range: bytes=start-end`; reply with 206 + the requested slice.
  const range = req.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const startRaw = match[1];
      const endRaw = match[2];
      let start = startRaw ? parseInt(startRaw, 10) : 0;
      let end = endRaw ? parseInt(endRaw, 10) : total - 1;
      if (Number.isNaN(start)) start = 0;
      if (Number.isNaN(end)) end = total - 1;
      end = Math.min(end, total - 1);
      if (start > end || start >= total) {
        return new NextResponse("Range Not Satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${total}` },
        });
      }
      const chunk = buffer.subarray(start, end + 1);
      return new NextResponse(new Uint8Array(chunk), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunk.byteLength),
          "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
        },
      });
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
      "Content-Length": String(total),
    },
  });
}
