"use client";

/**
 * Client-side interaction store for a NOTES unit.
 *
 * Interactive blocks are scattered anywhere in the block tree — including
 * inside tabs and accordions — while the "Mark as complete" button lives at the
 * bottom of the page. Threading state between them through props would mean
 * making every container a client component, so they share this context
 * instead.
 *
 * Writes are optimistic: the block updates immediately, the POST happens in the
 * background, and the authoritative `complete` flag from the server replaces
 * the optimistic guess when it lands. A failed write leaves the local state in
 * place and surfaces nothing — losing a checklist tick is not worth an error
 * dialog, and the next tick retries the whole payload anyway.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { InteractionPayload } from "@/lib/blocks";

export interface InteractionEntry {
  payload: InteractionPayload;
  complete: boolean;
}

interface Store {
  /** Saved answers keyed by block id. */
  answers: Record<string, InteractionEntry>;
  /** Required block ids still outstanding. */
  outstanding: string[];
  requiredTotal: number;
  /** True when nothing is gating completion. */
  passed: boolean;
  /** Admin preview — answers are evaluated but never persisted. */
  preview: boolean;
  /** Record an answer for a block. Safe to call on every keystroke/tick. */
  save: (blockId: string, payload: InteractionPayload) => void;
  /** True when this block blocks unit completion and is not yet satisfied. */
  isOutstanding: (blockId: string) => boolean;
}

const noop: Store = {
  answers: {},
  outstanding: [],
  requiredTotal: 0,
  passed: true,
  preview: false,
  save: () => {},
  isOutstanding: () => false,
};

const Ctx = createContext<Store>(noop);

/**
 * Read the store. Returns an inert store when no provider is mounted, so
 * interactive blocks can also be rendered in the admin preview or in isolation
 * without crashing.
 */
export function useInteractions(): Store {
  return useContext(Ctx);
}

export function InteractionProvider({
  unitId,
  initialAnswers,
  initialOutstanding,
  requiredTotal,
  preview = false,
  children,
}: {
  unitId: string;
  initialAnswers: Record<string, InteractionEntry>;
  initialOutstanding: string[];
  requiredTotal: number;
  preview?: boolean;
  children: React.ReactNode;
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [outstanding, setOutstanding] = useState(initialOutstanding);

  // Serialize writes per block so a fast series of ticks cannot land out of
  // order and leave the server holding an older payload than the UI shows.
  const seq = useRef<Record<string, number>>({});

  const save = useCallback(
    (blockId: string, payload: InteractionPayload) => {
      // Optimistic: assume the answer sticks. The server's verdict on whether
      // it counts as complete overwrites this a moment later.
      setAnswers((prev) => ({
        ...prev,
        [blockId]: { payload, complete: prev[blockId]?.complete ?? false },
      }));

      const ticket = (seq.current[blockId] ?? 0) + 1;
      seq.current[blockId] = ticket;

      void fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, blockId, payload }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return;
          // A newer write for this block has already been sent — its response
          // is the truthful one, so drop this stale reply.
          if (seq.current[blockId] !== ticket) return;

          setAnswers((prev) => ({
            ...prev,
            [blockId]: { payload, complete: !!data.complete },
          }));
          if (data.gate && Array.isArray(data.gate.outstanding)) {
            setOutstanding(data.gate.outstanding as string[]);
          }
        })
        .catch(() => {
          // Offline or a transient failure. The optimistic state stands; the
          // next interaction resends the full payload.
        });
    },
    [unitId]
  );

  const value = useMemo<Store>(
    () => ({
      answers,
      outstanding,
      requiredTotal,
      passed: outstanding.length === 0,
      preview,
      save,
      isOutstanding: (blockId: string) => outstanding.includes(blockId),
    }),
    [answers, outstanding, requiredTotal, preview, save]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
