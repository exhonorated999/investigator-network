import { prisma } from "@/lib/prisma";

/**
 * ISP / provider directory — where to serve legal process (search warrants,
 * subpoenas) to internet service providers & platforms. Admin-managed and
 * surfaced as an alphabetized "Service of Process" dashboard widget.
 */

export interface IspProviderItem {
  id: string;
  name: string;
  url: string;
  email: string;
  note: string;
}

/** All providers, always alphabetized by name (case-insensitive). */
export async function loadIspProviders(): Promise<IspProviderItem[]> {
  const rows = await prisma.ispProvider.findMany({
    select: { id: true, name: true, url: true, email: true, note: true },
  });
  return rows.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
