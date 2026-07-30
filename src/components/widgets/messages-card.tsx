"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type {
  DirectoryEntry,
  InboxItem,
  Thread,
} from "@/lib/messages";
import {
  getThread,
  searchDirectory,
  sendMessage,
  startConversation,
} from "@/app/messages/actions";
import { Avatar, RoleBadge } from "@/components/widgets/avatar";

type Mode =
  | { view: "inbox" }
  | { view: "thread"; conversationId: string }
  | { view: "new"; to?: DirectoryEntry };

/* ----------------------------------------------------------------- inbox -- */

function InboxList({
  inbox,
  onOpen,
  onNew,
}: {
  inbox: InboxItem[];
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onNew}
        className="btn btn-ghost btn-sm mb-3 w-full justify-center"
      >
        ＋ New message
      </button>

      {inbox.length === 0 ? (
        <p className="py-10 text-center text-[14px] text-muted">
          No conversations yet. Start one with a colleague or instructor.
        </p>
      ) : (
        <div className="-mx-1">
          {inbox.map((c) => (
            <button
              key={c.conversationId}
              type="button"
              onClick={() => onOpen(c.conversationId)}
              className="flex w-full items-center gap-3 rounded-sm px-1 py-2.5 text-left transition hover:bg-[rgba(0,180,216,0.05)]"
            >
              <Avatar name={c.other.name} role={c.other.role} size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-semibold text-foreground">
                    {c.other.name}
                  </span>
                  <RoleBadge role={c.other.role} />
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted">
                    {c.lastAt}
                  </span>
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span
                    className={`truncate text-[13px] ${
                      c.unread ? "font-semibold text-foreground" : "text-muted"
                    }`}
                  >
                    {c.fromMe ? "You: " : ""}
                    {c.lastMessage}
                  </span>
                  {c.unread ? (
                    <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent-bright" />
                  ) : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------ thread view -- */

function ThreadView({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const t = await getThread({ conversationId });
    setThread(t);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages.length]);

  function submit() {
    const body = value.trim();
    if (!body) return;
    start(async () => {
      await sendMessage({ conversationId, body });
      setValue("");
      await refresh();
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[12px] text-muted transition hover:text-accent-bright"
        >
          ← Inbox
        </button>
        {thread ? (
          <span className="ml-1 flex items-center gap-2">
            <Avatar name={thread.other.name} role={thread.other.role} size={26} />
            <span className="text-[14px] font-semibold text-foreground">
              {thread.other.name}
            </span>
            <RoleBadge role={thread.other.role} />
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto py-3 pr-1">
        {loading ? (
          <p className="py-8 text-center font-mono text-[13px] text-muted">Loading…</p>
        ) : !thread || thread.messages.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-muted">
            No messages yet. Say hello.
          </p>
        ) : (
          thread.messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[14px] leading-snug ${
                  m.mine
                    ? "bg-[rgba(0,180,216,0.16)] text-foreground"
                    : "border border-border bg-surface-2/50 text-foreground/90"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-0.5 font-mono text-[10px] text-muted">{m.ago}</span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2 border-t border-border pt-2">
        <textarea
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Message…"
          className="field min-h-[40px] flex-1 resize-none px-3 py-2 text-[14px]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || !value.trim()}
          className="btn btn-primary btn-sm shrink-0 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- new DM -- */

function NewMessage({
  onBack,
  onOpened,
}: {
  onBack: () => void;
  onOpened: (conversationId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryEntry[]>([]);
  const [to, setTo] = useState<DirectoryEntry | null>(null);
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      const r = await searchDirectory({ query });
      if (!cancelled) setResults(r);
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  function submit() {
    const body = value.trim();
    if (!to || !body) return;
    start(async () => {
      const { conversationId } = await startConversation({
        otherId: to.id,
        body,
      });
      if (conversationId) onOpened(conversationId);
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={onBack}
          className="font-mono text-[12px] text-muted transition hover:text-accent-bright"
        >
          ← Inbox
        </button>
        <span className="text-[14px] font-semibold text-foreground">New message</span>
      </div>

      {to ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase text-muted">To:</span>
          <span className="flex items-center gap-2 rounded-full border border-border px-2 py-1">
            <Avatar name={to.name} role={to.role} size={22} />
            <span className="text-[13px] text-foreground">{to.name}</span>
            <button
              type="button"
              onClick={() => setTo(null)}
              className="text-muted hover:text-foreground"
            >
              ×
            </button>
          </span>
        </div>
      ) : (
        <div className="mt-3 min-h-0 flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members by name or agency…"
            className="field w-full px-3 py-2 text-[14px]"
          />
          <div className="mt-2 max-h-[320px] overflow-y-auto">
            {results.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted">
                No members found.
              </p>
            ) : (
              results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setTo(u)}
                  className="flex w-full items-center gap-3 rounded-sm px-1 py-2 text-left transition hover:bg-[rgba(0,180,216,0.05)]"
                >
                  <Avatar name={u.name} role={u.role} size={32} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] text-foreground">
                        {u.name}
                      </span>
                      <RoleBadge role={u.role} />
                    </span>
                    <span className="block truncate font-mono text-[10px] uppercase text-muted">
                      {u.agency || "—"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {to ? (
        <div className="mt-auto flex items-end gap-2 border-t border-border pt-2">
          <textarea
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={`Message ${to.name.split(" ")[0]}…`}
            className="field min-h-[52px] flex-1 resize-none px-3 py-2 text-[14px]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || !value.trim()}
            className="btn btn-primary btn-sm shrink-0 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- the card -- */

export function MessagesCard({
  inbox,
  unread,
  number = "09",
  variant = "card",
}: {
  inbox: InboxItem[];
  unread: number;
  number?: string;
  variant?: "card" | "page";
}) {
  const [mode, setMode] = useState<Mode>({ view: "inbox" });

  const bodyClass =
    variant === "page"
      ? "flex-1 min-h-[60vh]"
      : "flex-1 min-h-[420px] max-h-[560px]";

  return (
    <section className="panel rule-top flex h-full flex-col p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{number} / Comms</p>
          <h2 className="display-sm mt-2 text-[1.15rem]">Messages</h2>
        </div>
        {unread > 0 ? (
          <span className="rounded-full bg-accent-bright px-2 py-0.5 font-mono text-[11px] font-bold text-void">
            {unread}
          </span>
        ) : null}
      </header>

      <div className={`mt-4 flex flex-col ${bodyClass}`}>
        {mode.view === "inbox" ? (
          <InboxList
            inbox={inbox}
            onOpen={(id) => setMode({ view: "thread", conversationId: id })}
            onNew={() => setMode({ view: "new" })}
          />
        ) : mode.view === "thread" ? (
          <ThreadView
            conversationId={mode.conversationId}
            onBack={() => setMode({ view: "inbox" })}
          />
        ) : (
          <NewMessage
            onBack={() => setMode({ view: "inbox" })}
            onOpened={(id) => setMode({ view: "thread", conversationId: id })}
          />
        )}
      </div>

      {variant === "card" ? (
        <Link
          href="/messages"
          className="mt-4 block border-t border-border pt-3 font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-muted transition hover:text-accent-bright"
        >
          Open messages →
        </Link>
      ) : null}
    </section>
  );
}
