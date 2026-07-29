import { getViewerUser } from "@/lib/viewer";
import { stopPreview } from "@/app/admin/preview/actions";

/** Shown at the top of learner pages when an admin is previewing as a learner. */
export async function PreviewBanner() {
  const viewer = await getViewerUser();
  if (!viewer?.impersonating) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-gold/50 bg-[rgba(244,162,97,0.12)] px-4 py-2.5 backdrop-blur-md">
      <span className="font-mono text-xs text-gold">
        <span className="opacity-60">// </span>
        PREVIEWING AS <strong className="font-bold">{viewer.name}</strong> — READ-ONLY. ENROLLING OR SUBMITTING WILL ACT AS YOUR ADMIN ACCOUNT.
      </span>
      <form action={stopPreview}>
        <button
          type="submit"
          className="btn btn-ghost btn-sm shrink-0 border-gold/50 text-gold hover:border-gold hover:text-gold"
        >
          Exit preview
        </button>
      </form>
    </div>
  );
}
