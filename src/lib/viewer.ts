import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";

export const PREVIEW_COOKIE = "preview_uid";

export interface Viewer {
  id: string;
  name: string;
  agency: string;
  role: Role;
  /** True when an admin is viewing the app as another (learner) account. */
  impersonating: boolean;
  /** The real signed-in admin's id, if the real user is an admin. */
  realAdminId: string | null;
}

/**
 * Resolve the "effective" user for learner-facing pages.
 *
 * Normally this is the signed-in user. If the signed-in user is an ADMIN and a
 * valid preview cookie is set, we return the previewed learner instead so the
 * admin can see the student experience. Only admins can impersonate; the cookie
 * is ignored for everyone else. This affects READ/rendering only — mutations
 * still run as the real signed-in user.
 */
export async function getViewerUser(): Promise<Viewer | null> {
  const session = await auth();
  const real = session?.user;
  if (!real) return null;

  if (real.role === "ADMIN") {
    const jar = await cookies();
    const uid = jar.get(PREVIEW_COOKIE)?.value;
    if (uid && uid !== real.id) {
      const u = await prisma.user.findUnique({ where: { id: uid } });
      if (u) {
        return {
          id: u.id,
          name: u.name,
          agency: u.agency,
          role: u.role,
          impersonating: true,
          realAdminId: real.id,
        };
      }
    }
    return {
      id: real.id,
      name: real.name ?? "",
      agency: real.agency ?? "",
      role: real.role,
      impersonating: false,
      realAdminId: real.id,
    };
  }

  return {
    id: real.id,
    name: real.name ?? "",
    agency: real.agency ?? "",
    role: real.role,
    impersonating: false,
    realAdminId: null,
  };
}
