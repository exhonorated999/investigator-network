"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BOARD_FILE_ACCEPT,
  BOARD_KINDS,
  BOARD_MAX_BODY,
  type BoardKind,
} from "@/lib/board-config";
import {
  createBoardPost,
  type BoardActionState,
} from "@/app/courses/[slug]/board/actions";

const INITIAL: BoardActionState = { ok: false, error: null };

export function BoardComposer({
  slug,
  defaults,
  onDone,
}: {
  slug: string;
  defaults: { name: string; agency: string };
  onDone: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<BoardKind>("INTRO");
  const [title, setTitle] = useState(defaults.name);
  const [agency, setAgency] = useState(defaults.agency);
  const [contactEmail, setContactEmail] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [state, action, pending] = useActionState(createBoardPost, INITIAL);
  const handled = useRef<BoardActionState | null>(null);

  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  function pick(k: BoardKind) {
    setKind(k);
    // Name is the "title" of an intro; other kinds start blank.
    setTitle(k === "INTRO" ? defaults.name : "");
  }

  const meta = BOARD_KINDS.find((k) => k.kind === kind)!;
  const titleLabel =
    kind === "INTRO"
      ? "Your name"
      : kind === "QUESTION"
        ? "Subject (optional)"
        : kind === "NEWS"
          ? "Headline"
          : "Resource title";
  const bodyLabel =
    kind === "INTRO"
      ? "A bit about you (optional)"
      : kind === "QUESTION"
        ? "Your question"
        : kind === "NEWS"
          ? "Write-up"
          : "Description (optional)";

  return (
    <form action={action} className="panel space-y-3 p-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />

      <div className="flex flex-wrap gap-1.5">
        {BOARD_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => pick(k.kind)}
            className={`border px-2.5 py-1 text-xs transition ${
              kind === k.kind
                ? "border-accent bg-surface-2 text-foreground"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {k.icon} {k.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted">{meta.hint}</p>

      <label className="block">
        <span className="eyebrow eyebrow-muted text-[10px]">{titleLabel}</span>
        <input
          name="title"
          className="field mt-1 w-full text-sm"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      {kind === "INTRO" ? (
        <>
          <label className="block">
            <span className="eyebrow eyebrow-muted text-[10px]">Agency</span>
            <input
              name="agency"
              className="field mt-1 w-full text-sm"
              value={agency}
              maxLength={200}
              onChange={(e) => setAgency(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="eyebrow eyebrow-muted text-[10px]">
              Contact email (optional — visible to the class)
            </span>
            <input
              name="contactEmail"
              type="email"
              className="field mt-1 w-full text-sm"
              value={contactEmail}
              maxLength={200}
              onChange={(e) => setContactEmail(e.target.value)}
            />
          </label>
        </>
      ) : null}

      <label className="block">
        <span className="eyebrow eyebrow-muted text-[10px]">{bodyLabel}</span>
        <textarea
          name="body"
          className="field mt-1 min-h-[90px] w-full text-sm"
          value={body}
          maxLength={BOARD_MAX_BODY}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>

      {kind === "NEWS" || kind === "RESOURCE" ? (
        <label className="block">
          <span className="eyebrow eyebrow-muted text-[10px]">
            Link {kind === "NEWS" ? "to the article" : ""} (optional{kind === "RESOURCE" ? " if attaching a file" : ""})
          </span>
          <input
            name="linkUrl"
            className="field mt-1 w-full text-sm"
            placeholder="https://"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </label>
      ) : null}

      {kind === "RESOURCE" ? (
        <label className="block">
          <span className="eyebrow eyebrow-muted text-[10px]">
            Attach a file (PDF, Office, image, zip — max 10 MB)
          </span>
          <input
            name="file"
            type="file"
            accept={BOARD_FILE_ACCEPT}
            className="mt-1 block w-full text-xs text-muted file:mr-3 file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-foreground"
          />
        </label>
      ) : null}

      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending ? "Posting…" : "Post to class"}
        </button>
      </div>
    </form>
  );
}
