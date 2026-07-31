import type { ColumnsBlock, CardBlock } from "@/lib/blocks";
import { BlockList } from "./block-list";

// ---------------------------------------------------------------------------
// columns
// ---------------------------------------------------------------------------

const GAP_CLASS: Record<ColumnsBlock["gap"], string> = {
  sm: "gap-4",
  md: "gap-6",
  lg: "gap-8",
};

export function ColumnsBlockView({
  block,
  depth,
}: {
  block: ColumnsBlock;
  depth: number;
}) {
  const cols = block.columns;
  if (!cols.length) return null;
  const colClass =
    cols.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  const gapClass = GAP_CLASS[block.gap] ?? GAP_CLASS.md;
  return (
    <div className={`grid grid-cols-1 ${colClass} ${gapClass}`}>
      {cols.map((col, i) => (
        <BlockList key={i} blocks={col} depth={depth + 1} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// card
// ---------------------------------------------------------------------------

export function CardBlockView({
  block,
  depth,
}: {
  block: CardBlock;
  depth: number;
}) {
  const title = block.title.trim();
  const eyebrow = block.eyebrow.trim();
  return (
    <div className="panel rule-top p-5">
      {eyebrow ? (
        <span className="eyebrow mb-1 block">{eyebrow}</span>
      ) : null}
      {title ? (
        <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-wide text-accent-bright">
          {title}
        </h3>
      ) : null}
      <BlockList blocks={block.blocks} depth={depth + 1} />
    </div>
  );
}
