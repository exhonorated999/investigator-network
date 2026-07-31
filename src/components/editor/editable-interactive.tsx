"use client";

import type {
  AccordionBlock,
  AccordionItem,
  ChecklistBlock,
  KnowledgeCheckBlock,
  OrderingBlock,
  RevealCardBlock,
  ScenarioBlock,
  ScenarioOption,
  TabsBlock,
  TabsItem,
} from "@/lib/blocks";
import { newBlockId } from "@/lib/blocks";
import { PROSE_INLINE } from "@/components/blocks/prose";
import { useEditor } from "./editor-store";
import { InlineMarkdown, InlineText } from "./inline-fields";
import { EditableList } from "./canvas";
import { SlotFrame } from "./block-frame";
import {
  AddItemButton,
  ItemControls,
  NoProps,
  PropGroup,
  PropToggle,
} from "./fields";

/**
 * Editable surfaces for the interactive block types.
 *
 * Follows the same four rules as editable-content.tsx:
 *
 *  1. Render the block as closely as possible to its counterpart in
 *     `src/components/blocks/`, with reader-facing strings swapped for
 *     InlineText / InlineMarkdown carrying the SAME typography classes.
 *  2. Empty values show a placeholder, never collapse to nothing.
 *  3. Structural settings go in the matching *Props component, not on canvas.
 *  4. Mutations go through patch(block.id, { … }). Never mutate in place.
 *
 * Container blocks (accordion, tabs) call EditableList with
 * listRef={{ parentId: block.id, slot: i }}, exactly as EditColumns does.
 */

// ---------------------------------------------------------------------------
// accordion
// ---------------------------------------------------------------------------

export function EditAccordion({
  block,
  depth,
}: {
  block: AccordionBlock;
  depth: number;
}) {
  const { patch } = useEditor();
  const items = block.items;

  return (
    <div className="panel rule-top">
      <div className="border-b border-border px-5 py-3">
        <InlineText
          value={block.title}
          onChange={(title) => patch(block.id, { title })}
          placeholder="Section title (optional)"
          ariaLabel="Accordion section title"
          className="tag-chip"
        />
      </div>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div key={item.id}>
            <div className="flex items-center gap-2 px-5 py-3">
              <InlineText
                value={item.title}
                onChange={(title) =>
                  patch(block.id, {
                    items: items.map((it, j) =>
                      j === i ? { ...it, title } : it,
                    ),
                  })
                }
                placeholder={`Panel ${i + 1} title`}
                ariaLabel={`Panel ${i + 1} title`}
                className="flex-1 font-display text-sm font-semibold uppercase tracking-wide text-foreground"
              />
              <ItemControls
                removeLabel={`Remove panel ${i + 1}`}
                onRemove={() =>
                  patch(block.id, {
                    items: items.filter((_, j) => j !== i),
                  })
                }
              />
            </div>
            <div className="border-t border-border px-5 py-4">
              <SlotFrame label={`Panel ${i + 1}`}>
                <EditableList
                  listRef={{ parentId: block.id, slot: i }}
                  blocks={item.blocks}
                  depth={depth + 1}
                  emptyHint="Empty panel"
                />
              </SlotFrame>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3">
        <AddItemButton
          label="Add panel"
          onClick={() =>
            patch(block.id, {
              items: [
                ...items,
                { id: newBlockId(), title: "", open: false, blocks: [] },
              ],
            })
          }
        />
      </div>
    </div>
  );
}

function AccordionProps({ block }: { block: AccordionBlock }) {
  const { patch } = useEditor();
  const items = block.items;
  return (
    <PropGroup label="Accordion">
      <PropToggle
        label="Exclusive"
        value={block.exclusive}
        onChange={(exclusive) => patch(block.id, { exclusive })}
        hint="Only one panel open at a time."
      />
      <div className="grid gap-2">
        {items.map((item, i) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              checked={item.open}
              onChange={(e) =>
                patch(block.id, {
                  items: items.map((it, j) =>
                    j === i ? { ...it, open: e.target.checked } : it,
                  ),
                })
              }
              className="h-4 w-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-[13px] text-foreground">
              {item.title.trim() || `Panel ${i + 1}`}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              open on load
            </span>
          </label>
        ))}
      </div>
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// tabs
// ---------------------------------------------------------------------------

export function EditTabs({
  block,
  depth,
}: {
  block: TabsBlock;
  depth: number;
}) {
  const { patch } = useEditor();
  const items = block.items;

  return (
    <div className="panel rule-top">
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div key={item.id} className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <InlineText
                value={item.label}
                onChange={(label) =>
                  patch(block.id, {
                    items: items.map((it, j) =>
                      j === i ? { ...it, label } : it,
                    ),
                  })
                }
                placeholder={`Tab ${i + 1} label`}
                ariaLabel={`Tab ${i + 1} label`}
                className="flex-1 border-b-2 border-accent px-1 py-1 font-display text-xs font-semibold uppercase tracking-wide text-accent-bright"
              />
              <ItemControls
                removeLabel={`Remove tab ${i + 1}`}
                onRemove={() =>
                  patch(block.id, {
                    items: items.filter((_, j) => j !== i),
                  })
                }
              />
            </div>
            <SlotFrame label={`Tab ${i + 1}`}>
              <EditableList
                listRef={{ parentId: block.id, slot: i }}
                blocks={item.blocks}
                depth={depth + 1}
                emptyHint="Empty tab"
              />
            </SlotFrame>
          </div>
        ))}
      </div>
      <div className="p-3">
        <AddItemButton
          label="Add tab"
          onClick={() =>
            patch(block.id, {
              items: [...items, { id: newBlockId(), label: "", blocks: [] }],
            })
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// checklist
// ---------------------------------------------------------------------------

export function EditChecklist({ block }: { block: ChecklistBlock }) {
  const { patch } = useEditor();
  const items = block.items;

  return (
    <div className="panel rule-top p-5">
      <div className="mb-4 flex items-center gap-2">
        <InlineText
          value={block.title}
          onChange={(title) => patch(block.id, { title })}
          placeholder="Checklist title (optional)"
          ariaLabel="Checklist title"
          className="tag-chip"
        />
      </div>
      <ul className="grid gap-2">
        {items.map((item, i) => (
          <li key={item.id}>
            <div className="flex items-start gap-3 border border-border bg-surface-2 p-3">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-border-strong text-transparent"
                aria-hidden
              >
                ✓
              </span>
              <InlineText
                value={item.text}
                onChange={(text) =>
                  patch(block.id, {
                    items: items.map((it, j) =>
                      j === i ? { ...it, text } : it,
                    ),
                  })
                }
                placeholder={`Item ${i + 1}`}
                ariaLabel={`Checklist item ${i + 1}`}
                className="flex-1 text-sm text-foreground"
              />
              <ItemControls
                removeLabel={`Remove item ${i + 1}`}
                onRemove={() =>
                  patch(block.id, {
                    items: items.filter((_, j) => j !== i),
                  })
                }
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <AddItemButton
          label="Add item"
          onClick={() =>
            patch(block.id, {
              items: [...items, { id: newBlockId(), text: "" }],
            })
          }
        />
      </div>
    </div>
  );
}

function ChecklistProps({ block }: { block: ChecklistBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Checklist">
      <PropToggle
        label="Required"
        value={block.required}
        onChange={(required) => patch(block.id, { required })}
        hint="Learner must tick every item before the unit can be marked complete."
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// knowledgeCheck
// ---------------------------------------------------------------------------

export function EditKnowledgeCheck({ block }: { block: KnowledgeCheckBlock }) {
  const { patch } = useEditor();
  const choices = block.choices;

  return (
    <div className="panel rule-top p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-sm text-accent" aria-hidden>
          ?
        </span>
        <span className="eyebrow eyebrow-muted">KNOWLEDGE CHECK</span>
      </div>
      <InlineText
        value={block.question}
        onChange={(question) => patch(block.id, { question })}
        placeholder="Type the question…"
        ariaLabel="Knowledge check question"
        className="mb-4 block font-display text-sm font-semibold uppercase tracking-wide text-foreground"
      />
      <div className="grid gap-2">
        {choices.map((choice, i) => {
          const isCorrect = choice.correct;
          return (
            <div
              key={choice.id}
              className={`flex items-center gap-3 border p-3 transition ${
                isCorrect
                  ? "border-success bg-success/5"
                  : "border-border bg-surface-2"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition ${
                  isCorrect
                    ? "border-success text-success"
                    : "border-border-strong text-transparent"
                }`}
                aria-hidden
              >
                ●
              </span>
              <InlineText
                value={choice.text}
                onChange={(text) =>
                  patch(block.id, {
                    choices: choices.map((c, j) =>
                      j === i ? { ...c, text } : c,
                    ),
                  })
                }
                placeholder={`Choice ${i + 1}`}
                ariaLabel={`Choice ${i + 1} text`}
                className="flex-1 text-sm text-foreground"
              />
              {isCorrect ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-success">
                  Correct
                </span>
              ) : null}
              <ItemControls
                removeLabel={`Remove choice ${i + 1}`}
                disabled={choices.length <= 2}
                onRemove={() =>
                  patch(block.id, {
                    choices: choices.filter((_, j) => j !== i),
                  })
                }
              >
                <button
                  type="button"
                  aria-label={`Mark choice ${i + 1} as correct`}
                  title={
                    isCorrect ? "Marked correct" : "Mark as correct answer"
                  }
                  onClick={() =>
                    patch(block.id, {
                      choices: choices.map((c, j) =>
                        j === i
                          ? { ...c, correct: !c.correct }
                          : { ...c, correct: false },
                      ),
                    })
                  }
                  className={`border px-1.5 py-0.5 font-mono text-[11px] leading-none transition ${
                    isCorrect
                      ? "border-success text-success"
                      : "border-border text-muted hover:border-success hover:text-success"
                  }`}
                >
                  ✓
                </button>
              </ItemControls>
            </div>
          );
        })}
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Explanation
        </p>
        <InlineMarkdown
          value={block.explanation}
          onChange={(explanation) => patch(block.id, { explanation })}
          placeholder="Explain why the correct answer is right…"
          proseClass={PROSE_INLINE}
          ariaLabel="Knowledge check explanation"
          minRows={2}
        />
      </div>
      <div className="mt-3">
        <AddItemButton
          label="Add choice"
          onClick={() =>
            patch(block.id, {
              choices: [...choices, { id: newBlockId(), text: "", correct: false }],
            })
          }
        />
      </div>
    </div>
  );
}

function KnowledgeCheckProps({ block }: { block: KnowledgeCheckBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Knowledge check">
      <PropToggle
        label="Required"
        value={block.required}
        onChange={(required) => patch(block.id, { required })}
        hint="Learner must answer before the unit can be marked complete."
      />
      <PropToggle
        label="Require correct"
        value={block.requireCorrect}
        onChange={(requireCorrect) => patch(block.id, { requireCorrect })}
        hint="Answering is not enough — it must be right."
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// revealCard
// ---------------------------------------------------------------------------

export function EditRevealCard({ block }: { block: RevealCardBlock }) {
  const { patch } = useEditor();
  return (
    <div className="panel rule-top p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-sm text-accent" aria-hidden>
          ⇄
        </span>
        <span className="eyebrow eyebrow-muted">REVEAL CARD</span>
      </div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
        Front
      </p>
      <InlineText
        value={block.front}
        onChange={(front) => patch(block.id, { front })}
        placeholder="The prompt the learner sees before clicking…"
        ariaLabel="Reveal card front"
        className="mb-4 block font-display text-sm font-semibold uppercase tracking-wide text-foreground"
      />
      <div className="border-t border-border pt-4">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Back (revealed)
        </p>
        <InlineMarkdown
          value={block.backMarkdown}
          onChange={(backMarkdown) => patch(block.id, { backMarkdown })}
          placeholder="The content revealed on click…"
          proseClass={PROSE_INLINE}
          ariaLabel="Reveal card back"
          minRows={2}
        />
      </div>
    </div>
  );
}

function RevealCardProps({ block }: { block: RevealCardBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Reveal card">
      <PropToggle
        label="Required"
        value={block.required}
        onChange={(required) => patch(block.id, { required })}
        hint="Learner must reveal the card before the unit can be marked complete."
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// scenario
// ---------------------------------------------------------------------------

export function EditScenario({ block }: { block: ScenarioBlock }) {
  const { patch } = useEditor();
  const options = block.options;

  return (
    <div className="panel rule-top p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="font-mono text-sm text-accent" aria-hidden>
          ⑂
        </span>
        <span className="eyebrow eyebrow-muted">SCENARIO</span>
      </div>
      <InlineText
        value={block.title}
        onChange={(title) => patch(block.id, { title })}
        placeholder="Scenario title (optional)"
        ariaLabel="Scenario title"
        className="mb-3 block font-display text-lg font-bold uppercase tracking-wide text-accent-bright"
      />
      <div className="mb-5">
        <InlineMarkdown
          value={block.promptMarkdown}
          onChange={(promptMarkdown) => patch(block.id, { promptMarkdown })}
          placeholder="Set up the situation the learner must respond to…"
          proseClass={PROSE_INLINE}
          ariaLabel="Scenario prompt"
          minRows={3}
        />
      </div>
      <div className="grid gap-3">
        {options.map((option, i) => {
          const letter = String.fromCharCode(65 + i);
          const isCorrect = option.correct;
          return (
            <div
              key={option.id}
              className={`border p-4 transition ${
                isCorrect
                  ? "border-success bg-success/5"
                  : "border-border bg-surface-2"
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center border font-mono text-xs font-bold transition ${
                    isCorrect
                      ? "border-success text-success"
                      : "border-border-strong text-muted"
                  }`}
                  aria-hidden
                >
                  {letter}
                </span>
                <div className="min-w-0 flex-1">
                  <InlineText
                    value={option.text}
                    onChange={(text) =>
                      patch(block.id, {
                        options: options.map((o, j) =>
                          j === i ? { ...o, text } : o,
                        ),
                      })
                    }
                    placeholder={`Option ${letter} text`}
                    ariaLabel={`Option ${letter} text`}
                    className="text-sm text-foreground"
                  />
                </div>
                <ItemControls
                  removeLabel={`Remove option ${letter}`}
                  disabled={options.length <= 2}
                  onRemove={() =>
                    patch(block.id, {
                      options: options.filter((_, j) => j !== i),
                    })
                  }
                >
                  <button
                    type="button"
                    aria-label={`Mark option ${letter} as correct`}
                    title={
                      isCorrect
                        ? "Marked as sound"
                        : "Mark as the sound decision"
                    }
                    onClick={() =>
                      patch(block.id, {
                        options: options.map((o, j) =>
                          j === i
                            ? { ...o, correct: !o.correct }
                            : { ...o, correct: false },
                        ),
                      })
                    }
                    className={`border px-1.5 py-0.5 font-mono text-[11px] leading-none transition ${
                      isCorrect
                        ? "border-success text-success"
                        : "border-border text-muted hover:border-success hover:text-success"
                    }`}
                  >
                    ✓
                  </button>
                </ItemControls>
              </div>
              <div className="mt-3 border-l-2 border-border pl-4">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                  Outcome
                </p>
                <InlineMarkdown
                  value={option.outcomeMarkdown}
                  onChange={(outcomeMarkdown) =>
                    patch(block.id, {
                      options: options.map((o, j) =>
                        j === i ? { ...o, outcomeMarkdown } : o,
                      ),
                    })
                  }
                  placeholder="What happens when the learner chooses this option…"
                  proseClass={PROSE_INLINE}
                  ariaLabel={`Option ${letter} outcome`}
                  minRows={2}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <AddItemButton
          label="Add option"
          onClick={() =>
            patch(block.id, {
              options: [
                ...options,
                { id: newBlockId(), text: "", outcomeMarkdown: "", correct: false },
              ],
            })
          }
        />
      </div>
    </div>
  );
}

function ScenarioProps({ block }: { block: ScenarioBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Scenario">
      <PropToggle
        label="Required"
        value={block.required}
        onChange={(required) => patch(block.id, { required })}
        hint="Learner must choose an option before the unit can be marked complete."
      />
      <PropToggle
        label="Require correct"
        value={block.requireCorrect}
        onChange={(requireCorrect) => patch(block.id, { requireCorrect })}
        hint="Choosing is not enough — the choice must be sound."
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// ordering
// ---------------------------------------------------------------------------

export function EditOrdering({ block }: { block: OrderingBlock }) {
  const { patch } = useEditor();
  const items = block.items;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    patch(block.id, { items: next });
  };

  return (
    <div className="panel rule-top p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="font-mono text-sm text-accent" aria-hidden>
          ⇅
        </span>
        <span className="eyebrow eyebrow-muted">PUT IN ORDER</span>
      </div>
      <InlineText
        value={block.title}
        onChange={(title) => patch(block.id, { title })}
        placeholder="Ordering title (optional)"
        ariaLabel="Ordering title"
        className="mb-3 block font-display text-lg font-bold uppercase tracking-wide text-accent-bright"
      />
      <div className="mb-5">
        <InlineMarkdown
          value={block.promptMarkdown}
          onChange={(promptMarkdown) => patch(block.id, { promptMarkdown })}
          placeholder="Explain what the learner needs to put in order…"
          proseClass={PROSE_INLINE}
          ariaLabel="Ordering prompt"
          minRows={2}
        />
      </div>
      <p className="mb-2 font-mono text-[11px] text-muted">
        The order below is the answer key. Learners see these steps shuffled.
      </p>
      <ol className="grid gap-2">
        {items.map((item, i) => (
          <li key={item.id}>
            <div className="flex items-center gap-3 border border-border bg-surface-2 p-3">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center border border-border-strong font-mono text-xs font-bold text-muted"
                aria-hidden
              >
                {i + 1}
              </span>
              <InlineText
                value={item.text}
                onChange={(text) =>
                  patch(block.id, {
                    items: items.map((it, j) =>
                      j === i ? { ...it, text } : it,
                    ),
                  })
                }
                placeholder={`Step ${i + 1}`}
                ariaLabel={`Step ${i + 1} text`}
                className="flex-1 text-sm text-foreground"
              />
              <ItemControls
                removeLabel={`Remove step ${i + 1}`}
                disabled={items.length <= 2}
                onRemove={() =>
                  patch(block.id, {
                    items: items.filter((_, j) => j !== i),
                  })
                }
              >
                <button
                  type="button"
                  aria-label={`Move step ${i + 1} up`}
                  title="Move up"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="border border-border-strong px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted transition hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-border-strong disabled:hover:text-muted"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move step ${i + 1} down`}
                  title="Move down"
                  onClick={() => move(i, i + 1)}
                  disabled={i === items.length - 1}
                  className="border border-border-strong px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted transition hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-border-strong disabled:hover:text-muted"
                >
                  ↓
                </button>
              </ItemControls>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-3">
        <AddItemButton
          label="Add step"
          onClick={() =>
            patch(block.id, {
              items: [...items, { id: newBlockId(), text: "" }],
            })
          }
        />
      </div>
    </div>
  );
}

function OrderingProps({ block }: { block: OrderingBlock }) {
  const { patch } = useEditor();
  return (
    <PropGroup label="Ordering">
      <PropToggle
        label="Required"
        value={block.required}
        onChange={(required) => patch(block.id, { required })}
        hint="Learner must complete the ordering before the unit can be marked complete."
      />
    </PropGroup>
  );
}

// ---------------------------------------------------------------------------
// Properties dispatcher
// ---------------------------------------------------------------------------

export function InteractiveProps({
  block,
}: {
  block:
    | AccordionBlock
    | TabsBlock
    | ChecklistBlock
    | KnowledgeCheckBlock
    | RevealCardBlock
    | ScenarioBlock
    | OrderingBlock;
}) {
  switch (block.type) {
    case "accordion":
      return <AccordionProps block={block} />;
    case "tabs":
      return <NoProps what="Tabs" />;
    case "checklist":
      return <ChecklistProps block={block} />;
    case "knowledgeCheck":
      return <KnowledgeCheckProps block={block} />;
    case "revealCard":
      return <RevealCardProps block={block} />;
    case "scenario":
      return <ScenarioProps block={block} />;
    case "ordering":
      return <OrderingProps block={block} />;
  }
}
