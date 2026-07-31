"use client";

import type { Block } from "@/lib/blocks";
import {
  EditCallout,
  EditCard,
  EditColumns,
  EditDivider,
  EditHeading,
  EditHtml,
  EditQuote,
  EditRichText,
  EditTable,
  ContentProps,
} from "./editable-content";
import {
  EditEmail,
  EditEmbed,
  EditFileList,
  EditImage,
  EditPdf,
  EditVideo,
  MediaProps,
} from "./editable-media";
import {
  EditAccordion,
  EditChecklist,
  EditKnowledgeCheck,
  EditOrdering,
  EditRevealCard,
  EditScenario,
  EditTabs,
  InteractiveProps,
} from "./editable-interactive";

/**
 * Maps a block to its editable surface.
 *
 * Deliberately shaped like `BlockList` in src/components/blocks/, including the
 * exhaustiveness check: the two switches must stay in lockstep, and a new block
 * type that renders for learners but cannot be edited is a bug worth catching
 * at compile time rather than in the UI.
 */
export function EditableBlock({
  block,
  depth,
}: {
  block: Block;
  depth: number;
}) {
  switch (block.type) {
    case "richText":
      return <EditRichText block={block} />;
    case "heading":
      return <EditHeading block={block} />;
    case "callout":
      return <EditCallout block={block} />;
    case "quote":
      return <EditQuote block={block} />;
    case "table":
      return <EditTable block={block} />;
    case "divider":
      return <EditDivider block={block} />;
    case "image":
      return <EditImage block={block} />;
    case "video":
      return <EditVideo block={block} />;
    case "pdf":
      return <EditPdf block={block} />;
    case "embed":
      return <EditEmbed block={block} />;
    case "fileList":
      return <EditFileList block={block} />;
    case "email":
      return <EditEmail block={block} />;
    case "columns":
      return <EditColumns block={block} depth={depth} />;
    case "accordion":
      return <EditAccordion block={block} depth={depth} />;
    case "tabs":
      return <EditTabs block={block} depth={depth} />;
    case "card":
      return <EditCard block={block} depth={depth} />;
    case "checklist":
      return <EditChecklist block={block} />;
    case "knowledgeCheck":
      return <EditKnowledgeCheck block={block} />;
    case "revealCard":
      return <EditRevealCard block={block} />;
    case "scenario":
      return <EditScenario block={block} />;
    case "ordering":
      return <EditOrdering block={block} />;
    case "html":
      return <EditHtml block={block} />;
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}

/** Settings for the selected block, routed to the owning group. */
export function BlockProps({ block }: { block: Block }) {
  switch (block.type) {
    case "richText":
    case "heading":
    case "callout":
    case "quote":
    case "table":
    case "divider":
    case "html":
    case "columns":
    case "card":
      return <ContentProps block={block} />;
    case "image":
    case "video":
    case "pdf":
    case "embed":
    case "fileList":
    case "email":
      return <MediaProps block={block} />;
    case "accordion":
    case "tabs":
    case "checklist":
    case "knowledgeCheck":
    case "revealCard":
    case "scenario":
    case "ordering":
      return <InteractiveProps block={block} />;
    default: {
      const _exhaustive: never = block;
      void _exhaustive;
      return null;
    }
  }
}
