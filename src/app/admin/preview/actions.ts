"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac";
import { PREVIEW_COOKIE } from "@/lib/viewer";

/** Admin: start viewing the app as a specific learner. */
export async function startPreview(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") || "");
  if (!userId) redirect("/admin/preview");
  const jar = await cookies();
  jar.set(PREVIEW_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour preview window
  });
  redirect("/dashboard");
}

/** Exit preview mode. */
export async function stopPreview() {
  await requireAdmin();
  const jar = await cookies();
  jar.delete(PREVIEW_COOKIE);
  redirect("/admin/preview");
}
