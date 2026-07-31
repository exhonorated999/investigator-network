/**
 * Per-learner state for interactive blocks inside NOTES units.
 *
 * Blocks live in a JSON document, not their own table, so this module is the
 * bridge between an opaque `blockId` and a durable row. Two rules:
 *
 * 1. **The server decides what "complete" means.** The client reports a
 *    payload; `isInteractionComplete` in lib/blocks.ts derives the flag. A
 *    crafted request cannot mark a required block done without a real answer.
 *
 * 2. **Orphans are harmless.** An admin can delete or reword a block at any
 *    time. Rows for blocks that no longer exist are simply never read.
 */

import { prisma } from "@/lib/prisma";
import {
  collectInteractive,
  isInteractionComplete,
  parseInteractionPayload,
  requiredBlockIds,
  type Block,
  type InteractionPayload,
} from "@/lib/blocks";

/** One learner's saved answer for one block. */
export interface InteractionState {
  payload: InteractionPayload;
  complete: boolean;
}

export type InteractionMap = Record<string, InteractionState>;

/** Load every saved answer this learner has for a unit, keyed by block id. */
export async function loadInteractions(
  userId: string,
  unitId: string
): Promise<InteractionMap> {
  const rows = await prisma.blockInteraction.findMany({
    where: { userId, unitId },
    select: { blockId: true, payload: true, complete: true },
  });

  const map: InteractionMap = {};
  for (const row of rows) {
    map[row.blockId] = {
      payload: parseInteractionPayload(row.payload),
      complete: row.complete,
    };
  }
  return map;
}

export interface GateState {
  /** Ids of required blocks that still need an answer. */
  outstanding: string[];
  /** How many required blocks the document has at all. */
  total: number;
  /** How many are satisfied. */
  satisfied: number;
  /** True when the unit may be marked complete. */
  passed: boolean;
}

/**
 * Compare a document's required blocks against what the learner has answered.
 *
 * Recomputed from the block tree every time rather than cached, because an
 * admin adding a required block must immediately re-gate learners who had
 * already finished the page.
 */
export function computeGate(blocks: Block[], answers: InteractionMap): GateState {
  const required = requiredBlockIds(blocks);
  const outstanding = required.filter((id) => !answers[id]?.complete);
  return {
    outstanding,
    total: required.length,
    satisfied: required.length - outstanding.length,
    passed: outstanding.length === 0,
  };
}

/**
 * Write one answer and return the resulting completion flag.
 *
 * `blocks` is the authoritative document; the block is looked up in it so the
 * completion rule comes from what the admin authored, not from the request.
 * Returns null when the block id is unknown — a stale tab answering a block
 * that has since been deleted, which is a no-op rather than an error.
 */
export async function recordInteraction(
  userId: string,
  unitId: string,
  blocks: Block[],
  blockId: string,
  rawPayload: unknown
): Promise<{ complete: boolean } | null> {
  const ref = collectInteractive(blocks).find((r) => r.block.id === blockId);
  if (!ref) return null;

  const payload = parseInteractionPayload(rawPayload);
  const complete = isInteractionComplete(ref.block, payload);

  await prisma.blockInteraction.upsert({
    where: { userId_unitId_blockId: { userId, unitId, blockId } },
    update: { payload: payload as object, complete, kind: ref.block.type },
    create: {
      userId,
      unitId,
      blockId,
      kind: ref.block.type,
      payload: payload as object,
      complete,
    },
  });

  return { complete };
}

/**
 * Aggregate answers to one block across all learners — feeds the admin
 * "most-missed question" view. Counts only blocks with recorded answers.
 */
export async function blockAnswerCounts(
  unitId: string,
  blockId: string
): Promise<{ total: number; complete: number; choices: Record<string, number> }> {
  const rows = await prisma.blockInteraction.findMany({
    where: { unitId, blockId },
    select: { payload: true, complete: true },
  });

  const choices: Record<string, number> = {};
  let complete = 0;
  for (const row of rows) {
    if (row.complete) complete += 1;
    const p = parseInteractionPayload(row.payload);
    const picked = p.choiceId ?? p.optionId;
    if (picked) choices[picked] = (choices[picked] ?? 0) + 1;
  }

  return { total: rows.length, complete, choices };
}
