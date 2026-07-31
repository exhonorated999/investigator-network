"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Block } from "@/lib/blocks";
import { type ListRef, ROOT_LIST } from "@/lib/notes-doc";
import { useEditor } from "./editor-store";
import { BlockFrame } from "./block-frame";
import { InsertPoint } from "./block-picker";
import { EditableBlock } from "./editable-blocks";

/**
 * The editing canvas: a recursive list renderer that interleaves blocks with
 * insert points.
 *
 * Drag state lives in a context rather than in the editor store because it is
 * pure interaction state — it changes many times a second while a block is in
 * flight and must never end up in the undo history or trigger a save.
 */

const DragCtx = createContext<{
  dragging: string | null;
  start: (id: string) => void;
  end: () => void;
}>({ dragging: null, start: () => {}, end: () => {} });

export function DragProvider({ children }: { children: ReactNode }) {
  const [dragging, setDragging] = useState<string | null>(null);
  return (
    <DragCtx.Provider
      value={{
        dragging,
        start: setDragging,
        end: () => setDragging(null),
      }}
    >
      {children}
    </DragCtx.Provider>
  );
}

export function EditableList({
  listRef = ROOT_LIST,
  blocks,
  depth = 0,
  emptyHint,
}: {
  listRef?: ListRef;
  blocks: Block[];
  depth?: number;
  emptyHint?: string;
}) {
  const { move } = useEditor();
  const drag = useContext(DragCtx);

  const handleDrop = (ref: ListRef, index: number) => {
    if (!drag.dragging) return;
    move(drag.dragging, ref, index);
    drag.end();
  };

  return (
    <div className="grid gap-2">
      <InsertPoint
        listRef={listRef}
        index={0}
        dragging={drag.dragging}
        onDrop={handleDrop}
      />

      {blocks.map((block, i) => (
        <div key={block.id} className="grid gap-2">
          <BlockFrame
            block={block}
            dragging={drag.dragging === block.id}
            onDragStart={drag.start}
            onDragEnd={drag.end}
          >
            <EditableBlock block={block} depth={depth} />
          </BlockFrame>

          <InsertPoint
            listRef={listRef}
            index={i + 1}
            dragging={drag.dragging}
            onDrop={handleDrop}
          />
        </div>
      ))}

      {blocks.length === 0 && emptyHint ? (
        <p className="px-3 py-4 text-center text-[13px] italic text-muted/70">
          {emptyHint}
        </p>
      ) : null}
    </div>
  );
}
