/**
 * Immutable, id-keyed operations on a block document.
 *
 * The visual editor holds the whole document in client state and mutates it
 * locally, so every operation here is PURE and returns a new tree — React needs
 * new references to re-render, and undo needs the old ones to stay intact.
 *
 * Everything is keyed by block id rather than by position. The old builder used
 * a `BlockPath` of container ids plus slot indices, which is fine when the
 * server re-reads the document on every edit, but in a live editor a path goes
 * stale the moment anything above it moves. An id does not.
 *
 * No React, no Prisma, no DOM — imported by both the client editor and the
 * server actions so there is exactly one implementation of "duplicate a block".
 */
import {
  type AccordionBlock,
  type Block,
  type CardBlock,
  type ColumnsBlock,
  type TabsBlock,
  childLists,
  newBlockId,
} from "./blocks";

/**
 * Identifies one child list. `parentId: null` is the document root; otherwise
 * `slot` selects which of a container's lists (column 2, tab 3, …).
 */
export interface ListRef {
  parentId: string | null;
  slot: number;
}

export interface BlockLoc {
  ref: ListRef;
  index: number;
}

export const ROOT_LIST: ListRef = { parentId: null, slot: 0 };

export function sameList(a: ListRef, b: ListRef): boolean {
  return a.parentId === b.parentId && a.slot === b.slot;
}

/** How many child lists a block holds. 0 for leaves. */
export function slotCount(block: Block): number {
  return childLists(block).length;
}

/**
 * Replace one of a container's child lists, returning a new block.
 *
 * Mirrors `childLists` in blocks.ts — the two must agree on slot ordering, so
 * they are deliberately written in the same order.
 */
export function withChildList(block: Block, slot: number, next: Block[]): Block {
  switch (block.type) {
    case "columns": {
      const columns = block.columns.map((c, i) => (i === slot ? next : c));
      return { ...block, columns } satisfies ColumnsBlock;
    }
    case "accordion": {
      const items = block.items.map((it, i) =>
        i === slot ? { ...it, blocks: next } : it
      );
      return { ...block, items } satisfies AccordionBlock;
    }
    case "tabs": {
      const items = block.items.map((it, i) =>
        i === slot ? { ...it, blocks: next } : it
      );
      return { ...block, items } satisfies TabsBlock;
    }
    case "card":
      return { ...block, blocks: next } satisfies CardBlock;
    default:
      return block;
  }
}

/** Read a child list. Returns null for a ref that no longer resolves. */
export function getList(blocks: Block[], ref: ListRef): Block[] | null {
  if (ref.parentId === null) return blocks;
  const parent = findBlockById(blocks, ref.parentId);
  if (!parent) return null;
  return childLists(parent)[ref.slot] ?? null;
}

/** Find a block anywhere in the tree. */
export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    for (const list of childLists(b)) {
      const hit = findBlockById(list, id);
      if (hit) return hit;
    }
  }
  return null;
}

/** Where a block currently sits: which list, and at what index. */
export function findLoc(blocks: Block[], id: string): BlockLoc | null {
  const walk = (list: Block[], ref: ListRef): BlockLoc | null => {
    for (let i = 0; i < list.length; i++) {
      if (list[i].id === id) return { ref, index: i };
      const nested = childLists(list[i]);
      for (let slot = 0; slot < nested.length; slot++) {
        const hit = walk(nested[slot], { parentId: list[i].id, slot });
        if (hit) return hit;
      }
    }
    return null;
  };
  return walk(blocks, ROOT_LIST);
}

/**
 * Rebuild the tree with one child list replaced.
 *
 * Every ancestor along the way is copied, which is what makes React's identity
 * checks work: only the branch that actually changed gets a new reference.
 */
export function replaceList(
  blocks: Block[],
  ref: ListRef,
  next: Block[]
): Block[] {
  if (ref.parentId === null) return next;

  let touchedAny = false;
  const out = blocks.map((b) => {
    if (b.id === ref.parentId) {
      touchedAny = true;
      return withChildList(b, ref.slot, next);
    }

    const nested = childLists(b);
    if (!nested.length) return b;

    let rebuiltBlock = b;
    let touched = false;
    for (let slot = 0; slot < nested.length; slot++) {
      const rebuilt = replaceList(nested[slot], ref, next);
      if (rebuilt !== nested[slot]) {
        rebuiltBlock = withChildList(rebuiltBlock, slot, rebuilt);
        touched = true;
      }
    }
    if (touched) touchedAny = true;
    return touched ? rebuiltBlock : b;
  });

  // Returning the original array when nothing matched keeps referential
  // equality intact for callers that use it to skip work.
  return touchedAny ? out : blocks;
}

/** Apply a transform to one block, leaving the rest of the tree untouched. */
export function updateBlockById(
  blocks: Block[],
  id: string,
  update: (block: Block) => Block
): Block[] {
  let hit = false;
  const walk = (list: Block[]): Block[] => {
    const out = list.map((b) => {
      if (b.id === id) {
        hit = true;
        return update(b);
      }
      const nested = childLists(b);
      if (!nested.length) return b;
      let next = b;
      for (let slot = 0; slot < nested.length; slot++) {
        const rebuilt = walk(nested[slot]);
        if (rebuilt !== nested[slot]) next = withChildList(next, slot, rebuilt);
      }
      return next;
    });
    return hit ? out : list;
  };
  return walk(blocks);
}

/**
 * Patch fields on one block.
 *
 * Typed loosely on purpose: callers pass a partial of a specific block type and
 * the discriminant `type` is never among the keys, so the result stays a valid
 * member of the union. Tightening this would need a generic per-type map that
 * buys nothing at the call sites.
 */
export function patchBlock(
  blocks: Block[],
  id: string,
  patch: Record<string, unknown>
): Block[] {
  return updateBlockById(blocks, id, (b) => ({ ...b, ...patch }) as Block);
}

export function removeBlockById(blocks: Block[], id: string): Block[] {
  const loc = findLoc(blocks, id);
  if (!loc) return blocks;
  const list = getList(blocks, loc.ref);
  if (!list) return blocks;
  const next = list.filter((b) => b.id !== id);
  return replaceList(blocks, loc.ref, next);
}

export function insertBlockAt(
  blocks: Block[],
  ref: ListRef,
  index: number,
  block: Block
): Block[] {
  const list = getList(blocks, ref);
  if (!list) return blocks;
  const i = Math.max(0, Math.min(index, list.length));
  const next = [...list.slice(0, i), block, ...list.slice(i)];
  return replaceList(blocks, ref, next);
}

/** Insert directly after an existing block, in whatever list it lives in. */
export function insertAfter(
  blocks: Block[],
  siblingId: string,
  block: Block
): Block[] {
  const loc = findLoc(blocks, siblingId);
  if (!loc) return [...blocks, block];
  return insertBlockAt(blocks, loc.ref, loc.index + 1, block);
}

/**
 * Move a block to a new list and index.
 *
 * Refuses to drop a container into its own subtree — that would detach the
 * whole branch from the document and lose it silently.
 */
export function moveBlockTo(
  blocks: Block[],
  id: string,
  ref: ListRef,
  index: number
): Block[] {
  if (ref.parentId === id) return blocks;
  if (ref.parentId && isDescendant(blocks, id, ref.parentId)) return blocks;

  const from = findLoc(blocks, id);
  if (!from) return blocks;
  const block = findBlockById(blocks, id);
  if (!block) return blocks;

  // Removing first shifts later indices in the same list down by one.
  const removed = removeBlockById(blocks, id);
  const target =
    sameList(from.ref, ref) && from.index < index ? index - 1 : index;
  return insertBlockAt(removed, ref, target, block);
}

/** True when `maybeChildId` sits anywhere inside `ancestorId`. */
export function isDescendant(
  blocks: Block[],
  ancestorId: string,
  maybeChildId: string
): boolean {
  const ancestor = findBlockById(blocks, ancestorId);
  if (!ancestor) return false;
  for (const list of childLists(ancestor)) {
    if (findBlockById(list, maybeChildId)) return true;
  }
  return false;
}

/** Shift a block one position within its own list. */
export function nudgeBlock(blocks: Block[], id: string, dir: -1 | 1): Block[] {
  const loc = findLoc(blocks, id);
  if (!loc) return blocks;
  const list = getList(blocks, loc.ref);
  if (!list) return blocks;
  const to = loc.index + dir;
  if (to < 0 || to >= list.length) return blocks;
  const next = [...list];
  const [moved] = next.splice(loc.index, 1);
  next.splice(to, 0, moved);
  return replaceList(blocks, loc.ref, next);
}

/**
 * Fresh ids for a block and everything inside it, including repeated sub-items.
 *
 * Ids are how the editor targets a block and how `BlockInteraction` rows find
 * their answer, so a copy that reused them would be edited in lockstep with its
 * original and would inherit its learners' recorded answers.
 */
export function reidBlock(block: Block): Block {
  const b: Block = { ...block, id: newBlockId() };

  switch (b.type) {
    case "columns":
      return { ...b, columns: b.columns.map((col) => col.map(reidBlock)) };
    case "accordion":
      return {
        ...b,
        items: b.items.map((it) => ({
          ...it,
          id: newBlockId(),
          blocks: it.blocks.map(reidBlock),
        })),
      };
    case "tabs":
      return {
        ...b,
        items: b.items.map((it) => ({
          ...it,
          id: newBlockId(),
          blocks: it.blocks.map(reidBlock),
        })),
      };
    case "card":
      return { ...b, blocks: b.blocks.map(reidBlock) };
    case "fileList":
      // Split rather than sharing a case with the other item-bearing blocks:
      // collapsing them makes `b.items` a union of three element types, which
      // TypeScript will not let us map and assign back.
      return { ...b, items: b.items.map((it) => ({ ...it, id: newBlockId() })) };
    case "checklist":
      return { ...b, items: b.items.map((it) => ({ ...it, id: newBlockId() })) };
    case "ordering":
      return { ...b, items: b.items.map((it) => ({ ...it, id: newBlockId() })) };
    case "knowledgeCheck":
      return {
        ...b,
        choices: b.choices.map((c) => ({ ...c, id: newBlockId() })),
      };
    case "scenario":
      return {
        ...b,
        options: b.options.map((o) => ({ ...o, id: newBlockId() })),
      };
    default:
      return b;
  }
}

export function duplicateBlockById(blocks: Block[], id: string): Block[] {
  const source = findBlockById(blocks, id);
  if (!source) return blocks;
  return insertAfter(blocks, id, reidBlock(source));
}
