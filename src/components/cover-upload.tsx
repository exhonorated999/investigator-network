"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Cover image picker.
 *
 * This is a client component purely so bad files get a readable message. If the
 * browser POSTs a payload larger than `serverActions.bodySizeLimit`, Next
 * rejects it at the transport layer and React surfaces an opaque
 * "Failed to fetch" runtime error — so we validate size and type before the
 * form is ever submitted.
 *
 * Keep MAX_BYTES in sync with MAX_COVER_BYTES in admin/courses/actions.ts and
 * below the bodySizeLimit in next.config.ts.
 */
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-sm" disabled={disabled || pending}>
      {pending ? "Uploading…" : "Upload"}
    </button>
  );
}

export function CoverUpload({
  courseId,
  action,
}: {
  courseId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setError(null);
      setReady(false);
      return;
    }
    if (!ACCEPT.split(",").includes(file.type)) {
      setError(`"${file.type || "unknown type"}" isn't a supported image format.`);
      setReady(false);
      return;
    }
    if (file.size > MAX_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setError(`That file is ${mb} MB — the limit is 8 MB. Resize it and retry.`);
      setReady(false);
      return;
    }
    setError(null);
    setReady(true);
  }

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="id" value={courseId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept={ACCEPT}
          required
          onChange={onChange}
          className="field w-auto file:mr-3 file:border-0 file:bg-transparent file:font-mono file:text-[11px] file:uppercase file:tracking-[0.14em] file:text-accent"
        />
        <SubmitButton disabled={!ready} />
      </div>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
