import type { Block } from "@/lib/blocks";
import {
  RichTextBlockView,
  HeadingBlockView,
  CalloutBlockView,
  QuoteBlockView,
  TableBlockView,
  DividerBlockView,
  HtmlBlockView,
} from "./content";
import {
  ImageBlockView,
  VideoBlockView,
  PdfBlockView,
  EmbedBlockView,
  FileListBlockView,
  EmailBlockView,
} from "./media";
import {
  ColumnsBlockView,
  CardBlockView,
} from "./layout";
import {
  AccordionBlockView,
  TabsBlockView,
  ChecklistBlockView,
  KnowledgeCheckBlockView,
  RevealCardBlockView,
  ScenarioBlockView,
  OrderingBlockView,
} from "./interactive";

/**
 * Recursive renderer for a block list. Maps each block to its renderer via an
 * exhaustive switch on `block.type`. A future block type is a compile error.
 *
 * Server component — no client JS. Container blocks (accordion, tabs, etc.)
 * render their children here on the server and pass the resulting React nodes
 * to their client shells.
 */
export function BlockList({ blocks, depth = 0 }: { blocks: Block[]; depth?: number }) {
  if (!blocks.length) return null;
  return (
    <div className="grid gap-6">
      {blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} depth={depth} />
      ))}
    </div>
  );
}

function BlockRenderer({ block, depth }: { block: Block; depth: number }) {
  switch (block.type) {
    case "richText":
      return <RichTextBlockView block={block} />;
    case "heading":
      return <HeadingBlockView block={block} />;
    case "callout":
      return <CalloutBlockView block={block} />;
    case "quote":
      return <QuoteBlockView block={block} />;
    case "table":
      return <TableBlockView block={block} />;
    case "divider":
      return <DividerBlockView block={block} />;
    case "image":
      return <ImageBlockView block={block} />;
    case "video":
      return <VideoBlockView block={block} />;
    case "pdf":
      return <PdfBlockView block={block} />;
    case "embed":
      return <EmbedBlockView block={block} />;
    case "fileList":
      return <FileListBlockView block={block} />;
    case "email":
      return <EmailBlockView block={block} />;
    case "columns":
      return <ColumnsBlockView block={block} depth={depth} />;
    case "accordion":
      return <AccordionBlockView block={block} depth={depth} />;
    case "tabs":
      return <TabsBlockView block={block} depth={depth} />;
    case "card":
      return <CardBlockView block={block} depth={depth} />;
    case "checklist":
      return <ChecklistBlockView block={block} />;
    case "knowledgeCheck":
      return <KnowledgeCheckBlockView block={block} />;
    case "revealCard":
      return <RevealCardBlockView block={block} />;
    case "scenario":
      return <ScenarioBlockView block={block} />;
    case "ordering":
      return <OrderingBlockView block={block} />;
    case "html":
      return <HtmlBlockView block={block} />;
    default: {
      // Exhaustiveness check — if a new block type is added to the union
      // without a case here, TypeScript errors on this line.
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}
