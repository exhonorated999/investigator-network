import type { Role } from "@/generated/prisma";

/** First-letter initials, up to two, from a display name. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Monogram avatar. Staff (ADMIN) get a gold ring so instructors are instantly
 * distinguishable in the feed and inbox.
 */
export function Avatar({
  name,
  role,
  size = 36,
}: {
  name: string;
  role?: Role;
  size?: number;
}) {
  const staff = role === "ADMIN";
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full border font-display font-bold uppercase ${
        staff
          ? "border-gold/70 bg-[rgba(178,106,18,0.14)] text-gold"
          : "border-border-strong bg-surface-2 text-accent-bright"
      }`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/** "Staff" chip for instructor/admin authors. */
export function RoleBadge({ role }: { role: Role }) {
  if (role !== "ADMIN") return null;
  return (
    <span className="rounded-sm border border-gold/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-gold">
      Staff
    </span>
  );
}
