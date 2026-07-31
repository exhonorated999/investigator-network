"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { saveFile } from "@/lib/storage";
import { parseEmbedInput } from "@/lib/embed";
import { parseVideoInput } from "@/lib/video";
import {
  type Block,
  type BlockType,
  BLOCK_CATALOG,
  decodePath,
  emptyBlock,
  findBlock,
  insertBlock,
  moveBlockInList,
  newBlockId,
  parseBlocks,
  readNotesDoc,
  removeBlock,
} from "@/lib/blocks";

/**
 * Server actions for the Course Notes block builder.
 *
 * Every action follows the same shape: load the unit, read its block tree,
 * mutate the tree in memory, write the whole tree back. Blocks live inside a
 * single JSON column rather than their own table, so there is no partial-write
 * hazard — each action is one `update`.
 */

const VALID_TYPES = new Set<string>(BLOCK_CATALOG.map((b) => b.type));

/** Load a unit's blocks, or null if the unit is missing or isn't a NOTES unit. */
async function loadBlocks(unitId: string): Promise<Block[] | null> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, type: true, data: true },
  });
  if (!unit || unit.type !== "NOTES") return null;
  return readNotesDoc((unit.data as Record<string, unknown>) ?? {}).blocks;
}

/**
 * Persist a block tree.
 *
 * The legacy `contentMarkdown` / `embedUrl` keys are dropped on write: once a
 * unit has been saved through the builder, `readNotesDoc` reads `blocks` and
 * would ignore them anyway, and leaving them behind invites confusion later.
 */
async function saveBlocks(unitId: string, courseId: string, blocks: Block[]) {
  await prisma.unit.update({
    where: { id: unitId },
    data: { data: { version: 1, blocks } as unknown as object },
  });
  revalidatePath(`/admin/courses/${courseId}/units/${unitId}`);
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/courses", "layout");
}

/** Shared preamble: auth, read the ids, load the tree. */
async function begin(formData: FormData) {
  await requireAdmin();
  const unitId = String(formData.get("unitId") || "");
  const courseId = String(formData.get("courseId") || "");
  const blocks = await loadBlocks(unitId);
  return { unitId, courseId, blocks };
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export async function addNoteBlock(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const type = String(formData.get("type") || "");
  if (!VALID_TYPES.has(type)) return;

  const path = decodePath(String(formData.get("path") || ""));
  insertBlock(blocks, path, emptyBlock(type as BlockType));
  await saveBlocks(unitId, courseId, blocks);
}

export async function deleteNoteBlock(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const path = decodePath(String(formData.get("path") || ""));
  removeBlock(blocks, path, String(formData.get("blockId") || ""));
  await saveBlocks(unitId, courseId, blocks);
}

export async function moveNoteBlock(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const path = decodePath(String(formData.get("path") || ""));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;
  moveBlockInList(blocks, path, String(formData.get("blockId") || ""), dir);
  await saveBlocks(unitId, courseId, blocks);
}

/**
 * Duplicate a block, including its children. Ids are regenerated throughout so
 * the copy is independent — reusing them would make the editor's per-block
 * forms target two blocks at once.
 */
export async function duplicateNoteBlock(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const path = decodePath(String(formData.get("path") || ""));
  const blockId = String(formData.get("blockId") || "");
  const source = findBlock(blocks, blockId);
  if (!source) return;

  const copy = reid(structuredClone(source));
  insertBlock(blocks, path, copy);
  await saveBlocks(unitId, courseId, blocks);
}

/** Recursively assign fresh ids to a cloned block and everything inside it. */
function reid(block: Block): Block {
  block.id = newBlockId();
  switch (block.type) {
    case "columns":
      block.columns = block.columns.map((col) => col.map(reid));
      break;
    case "accordion":
    case "tabs":
      block.items = block.items.map((item) => ({
        ...item,
        id: newBlockId(),
        blocks: item.blocks.map(reid),
      })) as typeof block.items;
      break;
    case "card":
      block.blocks = block.blocks.map(reid);
      break;
    case "fileList":
    case "checklist":
    case "ordering":
      block.items = block.items.map((i) => ({ ...i, id: newBlockId() })) as typeof block.items;
      break;
    case "knowledgeCheck":
      block.choices = block.choices.map((c) => ({ ...c, id: newBlockId() }));
      break;
    case "scenario":
      block.options = block.options.map((o) => ({ ...o, id: newBlockId() }));
      break;
    default:
      break;
  }
  return block;
}

// ---------------------------------------------------------------------------
// Field editing
// ---------------------------------------------------------------------------

/**
 * Write one block's fields.
 *
 * The editor names its inputs `f_<dotted.path>` — `f_title`, `f_items.0.title`,
 * `f_choices.1.correct`. That keeps a single action able to edit every block
 * type, including the repeated sub-items of accordions, tab strips, checklists
 * and knowledge checks, without a bespoke action per shape.
 *
 * The assembled patch is merged onto the existing block and the result is run
 * back through `parseBlocks`, so all coercion and clamping lives in one place
 * (lib/blocks.ts) rather than being duplicated here.
 */
export async function updateNoteBlock(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const blockId = String(formData.get("blockId") || "");
  const target = findBlock(blocks, blockId);
  if (!target) return;

  const patch: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (!key.startsWith("f_")) continue;
    // Checkboxes ship a hidden "false" ahead of the real control, so the last
    // value present is the truthful one.
    const values = formData.getAll(key);
    const raw = String(values[values.length - 1] ?? "");
    setDeep(patch, key.slice(2), coerceField(key.slice(2), raw));
  }

  const merged = deepMerge(target as unknown as Record<string, unknown>, patch);
  const [reparsed] = parseBlocks([merged]);
  if (!reparsed) return;

  replaceBlock(blocks, blockId, reparsed);
  await saveBlocks(unitId, courseId, blocks);
}

/**
 * Per-field input massaging that can't live in the parser because it depends on
 * what a human pasted rather than on the stored shape.
 */
function coerceField(field: string, raw: string): unknown {
  // Email attachments are edited as one-per-line text.
  if (field === "attachments") {
    return raw
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  // Admins paste whole <iframe> snippets; normalize to a bare embed URL and
  // let the provider's own height come along if it set a sensible one.
  if (field === "embedInput") return raw;
  return raw;
}

/**
 * Apply a value at a dotted path, creating intermediate objects/arrays.
 * `items.0.title` becomes `{ items: [ { title: … } ] }`.
 */
function setDeep(root: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;

  let node: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextIsIndex = /^\d+$/.test(parts[i + 1]);
    const container = node as Record<string, unknown>;
    const idx = /^\d+$/.test(key) ? Number(key) : null;

    if (idx !== null && Array.isArray(node)) {
      if (node[idx] == null) node[idx] = nextIsIndex ? [] : {};
      node = node[idx] as Record<string, unknown>;
    } else {
      if (container[key] == null) container[key] = nextIsIndex ? [] : {};
      node = container[key] as Record<string, unknown>;
    }
  }

  const last = parts[parts.length - 1];
  if (Array.isArray(node) && /^\d+$/.test(last)) {
    (node as unknown[])[Number(last)] = value;
  } else {
    (node as Record<string, unknown>)[last] = value;
  }
}

/**
 * Merge a patch onto a block. Arrays are merged element-wise rather than
 * replaced, so editing `items.0.title` leaves `items[0].blocks` — the nested
 * children the form never sends — untouched.
 */
function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = Array.isArray(base)
    ? ([...(base as unknown as unknown[])] as unknown as Record<string, unknown>)
    : { ...base };

  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    if (Array.isArray(value)) {
      // A whole-array replacement (e.g. attachments) — take it as-is.
      out[key] = value;
    } else if (
      value &&
      typeof value === "object" &&
      prev &&
      typeof prev === "object"
    ) {
      if (Array.isArray(prev)) {
        const copy = [...prev];
        for (const [i, sub] of Object.entries(value as Record<string, unknown>)) {
          const n = Number(i);
          copy[n] =
            sub && typeof sub === "object" && copy[n] && typeof copy[n] === "object"
              ? deepMerge(copy[n] as Record<string, unknown>, sub as Record<string, unknown>)
              : sub;
        }
        out[key] = copy;
      } else {
        out[key] = deepMerge(
          prev as Record<string, unknown>,
          value as Record<string, unknown>
        );
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Swap a block in place, anywhere in the tree. */
function replaceBlock(list: Block[], id: string, next: Block): boolean {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i] = next;
      return true;
    }
    const b = list[i];
    if (b.type === "columns") {
      for (const col of b.columns) if (replaceBlock(col, id, next)) return true;
    } else if (b.type === "accordion" || b.type === "tabs") {
      for (const item of b.items) if (replaceBlock(item.blocks, id, next)) return true;
    } else if (b.type === "card") {
      if (replaceBlock(b.blocks, id, next)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Repeated sub-items (accordion panels, tabs, downloads, choices, columns)
// ---------------------------------------------------------------------------

export async function addNoteItem(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const target = findBlock(blocks, String(formData.get("blockId") || ""));
  if (!target) return;

  switch (target.type) {
    case "accordion":
      target.items.push({
        id: newBlockId(),
        title: `Panel ${target.items.length + 1}`,
        open: false,
        blocks: [],
      });
      break;
    case "tabs":
      target.items.push({
        id: newBlockId(),
        label: `Tab ${target.items.length + 1}`,
        blocks: [],
      });
      break;
    case "fileList":
      target.items.push({
        id: newBlockId(),
        url: "",
        label: "",
        description: "",
        meta: "",
      });
      break;
    case "checklist":
      target.items.push({ id: newBlockId(), text: "" });
      break;
    case "ordering":
      // Appended at the end, which is where it belongs in the answer key —
      // the authored order IS the correct order.
      target.items.push({ id: newBlockId(), text: "" });
      break;
    case "knowledgeCheck":
      target.choices.push({ id: newBlockId(), text: "", correct: false });
      break;
    case "scenario":
      target.options.push({
        id: newBlockId(),
        text: "",
        outcomeMarkdown: "",
        correct: false,
      });
      break;
    case "columns":
      if (target.columns.length < 3) target.columns.push([]);
      break;
    default:
      return;
  }

  await saveBlocks(unitId, courseId, blocks);
}

export async function deleteNoteItem(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const target = findBlock(blocks, String(formData.get("blockId") || ""));
  if (!target) return;
  const index = Number(formData.get("index"));
  if (!Number.isInteger(index) || index < 0) return;

  switch (target.type) {
    case "accordion":
    case "tabs":
    case "fileList":
    case "checklist":
      target.items.splice(index, 1);
      break;
    case "ordering":
      // Two items is the minimum that can be "in an order" at all.
      if (target.items.length > 2) target.items.splice(index, 1);
      break;
    case "knowledgeCheck":
      target.choices.splice(index, 1);
      break;
    case "scenario":
      // A decision point with one option is not a decision.
      if (target.options.length > 2) target.options.splice(index, 1);
      break;
    case "columns":
      // Never drop below two columns — one column is just a stack, and the
      // orphaned blocks would vanish with no way to get them back.
      if (target.columns.length > 2) target.columns.splice(index, 1);
      break;
    default:
      return;
  }

  await saveBlocks(unitId, courseId, blocks);
}

// ---------------------------------------------------------------------------
// Assets & pasted embeds
// ---------------------------------------------------------------------------

const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/**
 * Upload a PDF / image / document and drop its URL into a block field.
 *
 * Reuses the FileUpload + lib/storage + /api/files/[id] pipeline. Assets are
 * tagged `purpose: "course-asset"`, which the file route treats as readable by
 * any signed-in user — course material is shared with learners by definition.
 */
export async function uploadNoteAsset(formData: FormData) {
  const session = await requireAdmin();
  const unitId = String(formData.get("unitId") || "");
  const courseId = String(formData.get("courseId") || "");
  const blockId = String(formData.get("blockId") || "");
  const field = String(formData.get("field") || "url");
  const index = formData.get("index");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_ASSET_BYTES) return;

  const blocks = await loadBlocks(unitId);
  if (!blocks) return;
  const target = findBlock(blocks, blockId);
  if (!target) return;

  const stored = await saveFile(file, "course-asset");
  const record = await prisma.fileUpload.create({
    data: {
      ownerUserId: session.user!.id!,
      path: stored.path,
      filename: stored.filename,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      purpose: "course-asset",
    },
  });
  const url = `/api/files/${record.id}`;

  // fileList rows address a specific item; everything else has a flat field.
  if (target.type === "fileList" && index != null && index !== "") {
    const i = Number(index);
    const item = target.items[i];
    if (item) {
      item.url = url;
      if (!item.label) item.label = stored.filename;
      if (!item.meta) item.meta = describeFile(stored.mimeType, stored.sizeBytes);
    }
  } else {
    const t = target as unknown as Record<string, unknown>;
    t[field] = url;
    if (target.type === "pdf" && !target.title) target.title = stored.filename;
    if (target.type === "image" && !target.alt) target.alt = stored.filename;
  }

  await saveBlocks(unitId, courseId, blocks);
}

function describeFile(mime: string, bytes: number): string {
  const kind =
    mime.split("/")[1]?.toUpperCase().replace("VND.", "").slice(0, 12) || "FILE";
  const mb = bytes / 1048576;
  const size = mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${kind} · ${size}`;
}

/**
 * Accept whatever a provider handed the admin — a full `<iframe>` snippet, a
 * share link, a bare URL — and store a normalized embed URL.
 */
export async function setNoteEmbed(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const target = findBlock(blocks, String(formData.get("blockId") || ""));
  if (!target || target.type !== "embed") return;

  const { url, height } = parseEmbedInput(String(formData.get("raw") || ""));
  target.url = url;
  if (height > 0) target.height = height;

  await saveBlocks(unitId, courseId, blocks);
}

/** Same idea for video: paste a share URL or embed snippet, store the id. */
export async function setNoteVideo(formData: FormData) {
  const { unitId, courseId, blocks } = await begin(formData);
  if (!blocks) return;

  const target = findBlock(blocks, String(formData.get("blockId") || ""));
  if (!target || target.type !== "video") return;

  const provider = String(formData.get("provider")) === "bunny" ? "bunny" : "youtube";
  const { videoId, libraryId } = parseVideoInput(
    String(formData.get("raw") || ""),
    provider
  );
  target.provider = provider;
  if (videoId) target.videoId = videoId;
  if (libraryId) target.libraryId = libraryId;

  await saveBlocks(unitId, courseId, blocks);
}

// ---------------------------------------------------------------------------
// JSON source view
// ---------------------------------------------------------------------------

export interface JsonResult {
  ok: boolean;
  message: string;
}

/**
 * Replace the whole document from pasted JSON.
 *
 * This is the authoring escape hatch: anything expressible in the block format
 * can be written here in one shot, whether or not the visual editor exposes a
 * control for it. Accepts either a bare array of blocks or a full
 * `{ version, blocks }` document.
 *
 * Returns a result rather than throwing so the editor can show a message —
 * this is the one action where silent failure would be actively harmful, since
 * the admin may have just pasted a long document.
 */
export async function setNotesJson(
  _prev: JsonResult | null,
  formData: FormData
): Promise<JsonResult> {
  await requireAdmin();
  const unitId = String(formData.get("unitId") || "");
  const courseId = String(formData.get("courseId") || "");
  const raw = String(formData.get("json") || "").trim();

  if (!raw) return { ok: false, message: "Nothing to import — the box is empty." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      message: `That isn't valid JSON: ${(err as Error).message}`,
    };
  }

  const candidate = Array.isArray(parsed)
    ? parsed
    : (parsed as { blocks?: unknown })?.blocks;

  if (!Array.isArray(candidate)) {
    return {
      ok: false,
      message: 'Expected an array of blocks, or an object with a "blocks" array.',
    };
  }

  const blocks = parseBlocks(candidate);
  const dropped = candidate.length - blocks.length;

  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { type: true },
  });
  if (!unit || unit.type !== "NOTES") {
    return { ok: false, message: "That unit is not a notes unit." };
  }

  await saveBlocks(unitId, courseId, blocks);

  return {
    ok: true,
    message:
      dropped > 0
        ? `Imported ${blocks.length} block${blocks.length === 1 ? "" : "s"}. ${dropped} top-level entr${dropped === 1 ? "y was" : "ies were"} skipped — unknown or malformed type.`
        : `Imported ${blocks.length} block${blocks.length === 1 ? "" : "s"}.`,
  };
}
