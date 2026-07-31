import { marked } from "marked";
import type {
  AccordionBlock,
  TabsBlock,
  ChecklistBlock,
  KnowledgeCheckBlock,
  RevealCardBlock,
  ScenarioBlock,
  OrderingBlock,
} from "@/lib/blocks";
import { BlockList } from "./block-list";
import { AccordionBlockView as AccordionClient } from "./interactive/accordion";
import { TabsBlockView as TabsClient } from "./interactive/tabs";
import { ChecklistBlockView as ChecklistClient } from "./interactive/checklist";
import { KnowledgeCheckBlockView as KnowledgeCheckClient } from "./interactive/knowledge-check";
import { RevealCardBlockView as RevealCardClient } from "./interactive/reveal-card";
import { ScenarioBlockView as ScenarioClient } from "./interactive/scenario";
import { OrderingBlockView as OrderingClient } from "./interactive/ordering";

/** Parse markdown to HTML string, never throwing. */
function md(markdown: string): string {
  const text = String(markdown ?? "").trim();
  if (!text) return "";
  try {
    return marked.parse(text, { async: false }) as string;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// accordion — server wrapper renders children, passes to client shell
// ---------------------------------------------------------------------------

export function AccordionBlockView({
  block,
  depth,
}: {
  block: AccordionBlock;
  depth: number;
}) {
  // Render each panel's blocks server-side, pass as children to client shell.
  // The array is keyed because React sees it as a list even though the client
  // shell places each element individually.
  const panels = block.items.map((item) => (
    <BlockList key={item.id} blocks={item.blocks} depth={depth + 1} />
  ));
  return <AccordionClient block={block}>{panels}</AccordionClient>;
}

// ---------------------------------------------------------------------------
// tabs — server wrapper renders children, passes to client shell
// ---------------------------------------------------------------------------

export function TabsBlockView({
  block,
  depth,
}: {
  block: TabsBlock;
  depth: number;
}) {
  const panels = block.items.map((item) => (
    <BlockList key={item.id} blocks={item.blocks} depth={depth + 1} />
  ));
  return <TabsClient block={block}>{panels}</TabsClient>;
}

// ---------------------------------------------------------------------------
// checklist — no markdown, direct client render
// ---------------------------------------------------------------------------

export function ChecklistBlockView({ block }: { block: ChecklistBlock }) {
  return <ChecklistClient block={block} />;
}

// ---------------------------------------------------------------------------
// knowledgeCheck — pre-render explanation HTML on server
// ---------------------------------------------------------------------------

export function KnowledgeCheckBlockView({
  block,
}: {
  block: KnowledgeCheckBlock;
}) {
  const explanationHtml = md(block.explanation);
  return (
    <KnowledgeCheckClient block={block} explanationHtml={explanationHtml} />
  );
}

// ---------------------------------------------------------------------------
// revealCard — pre-render back markdown HTML on server
// ---------------------------------------------------------------------------

export function RevealCardBlockView({ block }: { block: RevealCardBlock }) {
  const backHtml = md(block.backMarkdown);
  return <RevealCardClient block={block} backHtml={backHtml} />;
}

// ---------------------------------------------------------------------------
// scenario — pre-render prompt + outcome markdown HTML on server
// ---------------------------------------------------------------------------

export function ScenarioBlockView({ block }: { block: ScenarioBlock }) {
  const promptHtml = md(block.promptMarkdown);
  const outcomeHtml: Record<string, string> = {};
  for (const option of block.options) {
    const html = md(option.outcomeMarkdown);
    if (html) outcomeHtml[option.id] = html;
  }
  return (
    <ScenarioClient
      block={block}
      promptHtml={promptHtml}
      outcomeHtml={outcomeHtml}
    />
  );
}

// ---------------------------------------------------------------------------
// ordering — pre-render prompt markdown HTML on server
// ---------------------------------------------------------------------------

export function OrderingBlockView({ block }: { block: OrderingBlock }) {
  const promptHtml = md(block.promptMarkdown);
  return <OrderingClient block={block} promptHtml={promptHtml} />;
}
