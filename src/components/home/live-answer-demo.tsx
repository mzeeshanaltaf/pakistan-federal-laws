"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, ExternalLink, RotateCcw } from "lucide-react";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { ReasoningBlock } from "@/components/chat/reasoning-block";
import { MessageContent } from "@/components/chat/message-content";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/rag-prompt";

interface LiveAnswerDemoProps {
  question: string;
  reasoning: string;
  answer: string;
  citations: Citation[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Reveals `text` into `setValue` one character at a time, bailing out as soon
// as `genRef` no longer matches `gen` (a replay or unmount happened) and
// pausing for as long as the card is hovered or the tab isn't visible.
async function typeText(
  setValue: (updater: (current: string) => string) => void,
  text: string,
  msPerChar: number,
  gen: number,
  genRef: React.MutableRefObject<number>,
  pausedRef: React.MutableRefObject<boolean>
): Promise<boolean> {
  for (const char of text) {
    if (genRef.current !== gen) return false;
    while ((pausedRef.current || document.hidden) && genRef.current === gen) {
      await sleep(60);
    }
    if (genRef.current !== gen) return false;
    setValue((current) => current + char);
    await sleep(msPerChar);
  }
  return true;
}

function latestCitationNumber(text: string): number | null {
  const matches = [...text.matchAll(/\[(\d+)\]/g)];
  if (matches.length === 0) return null;
  return Number(matches[matches.length - 1][1]);
}

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

// The canonical way to read external browser state (matchMedia) into React
// without setState-in-effect cascades or a server/client hydration mismatch —
// React resolves the client snapshot before paint, and reacts live if the OS
// setting changes while the page is open.
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getReducedMotionServerSnapshot);
}

// A self-playing, hover-to-pause loop that shows the real chat components
// (TypingIndicator, ReasoningBlock, MessageContent) running against a fixed
// example, so the homepage proves the product live instead of showing a
// static transcript.
export function LiveAnswerDemo({ question, reasoning, answer, citations }: LiveAnswerDemoProps) {
  const [inputValue, setInputValue] = useState("");
  const [sent, setSent] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [reasoningText, setReasoningText] = useState("");
  const [reasoningStreaming, setReasoningStreaming] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [pinnedCitation, setPinnedCitation] = useState<number | null>(null);
  const [cardOpacity, setCardOpacity] = useState(1);
  const [replayToken, setReplayToken] = useState(0);

  const genRef = useRef(0);
  const pausedRef = useRef(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;

    genRef.current += 1;
    const gen = genRef.current;

    async function loop() {
      while (genRef.current === gen) {
        setInputValue("");
        setSent(false);
        setThinking(false);
        setReasoningText("");
        setReasoningStreaming(false);
        setAnswerText("");
        setPinnedCitation(null);
        setCardOpacity(1);

        await sleep(500);
        if (genRef.current !== gen) return;

        if (!(await typeText(setInputValue, question, 20, gen, genRef, pausedRef))) return;

        await sleep(400);
        if (genRef.current !== gen) return;
        setSent(true);
        setInputValue("");

        await sleep(300);
        if (genRef.current !== gen) return;
        setThinking(true);

        await sleep(1000);
        if (genRef.current !== gen) return;
        setThinking(false);
        setReasoningStreaming(true);

        if (!(await typeText(setReasoningText, reasoning, 8, gen, genRef, pausedRef))) return;

        await sleep(350);
        if (genRef.current !== gen) return;
        setReasoningStreaming(false);

        await sleep(700);
        if (genRef.current !== gen) return;

        if (!(await typeText(setAnswerText, answer, 9, gen, genRef, pausedRef))) return;

        await sleep(2400);
        if (genRef.current !== gen) return;
        setCardOpacity(0.35);

        await sleep(280);
        if (genRef.current !== gen) return;
        setCardOpacity(1);

        await sleep(120);
      }
    }

    void loop();

    return () => {
      genRef.current += 1;
    };
  }, [question, reasoning, answer, replayToken, reducedMotion]);

  const sentDisplay = reducedMotion || sent;
  const reasoningDisplay = reducedMotion ? reasoning : reasoningText;
  const reasoningStreamingDisplay = reducedMotion ? false : reasoningStreaming;
  const answerDisplay = reducedMotion ? answer : answerText;

  const featuredCitation = useMemo(() => {
    const n = pinnedCitation ?? latestCitationNumber(answerDisplay);
    return (n !== null && citations.find((c) => c.n === n)) || citations[0];
  }, [answerDisplay, citations, pinnedCitation]);

  return (
    <section className="border-t border-border bg-secondary/40">
      <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">A real question, answered live</p>
          {!reducedMotion && (
            <button
              type="button"
              onClick={() => setReplayToken((t) => t + 1)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Replay
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div
            className="rounded-xl border border-border bg-card p-5 transition-opacity duration-300 sm:p-6"
            style={{ opacity: cardOpacity }}
            onMouseEnter={() => (pausedRef.current = true)}
            onMouseLeave={() => (pausedRef.current = false)}
          >
            {!sentDisplay && (
              <div className="mb-5 flex items-end gap-2">
                <div className="flex min-h-11 flex-1 items-center rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {inputValue || <span className="text-muted-foreground">Ask about any federal law&hellip;</span>}
                </div>
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md transition-colors",
                    inputValue ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  <ArrowUp className="size-4" />
                </div>
              </div>
            )}

            {sentDisplay && (
              <div className="mb-5 flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {question}
                </div>
              </div>
            )}

            {thinking && <TypingIndicator />}
            {reasoningDisplay && <ReasoningBlock text={reasoningDisplay} streaming={reasoningStreamingDisplay} />}
            {answerDisplay && (
              <MessageContent
                text={answerDisplay}
                citations={citations}
                onOpenCitation={(citation) => setPinnedCitation(citation.n)}
              />
            )}
          </div>

          <div
            key={featuredCitation.n}
            className="animate-in fade-in rounded-xl border border-border bg-card p-5 duration-300"
          >
            <p className="text-xs font-medium text-muted-foreground">Citation [{featuredCitation.n}]</p>
            <p className="mt-1.5 text-sm font-semibold">{featuredCitation.documentTitle}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {featuredCitation.categoryName} &middot; p. {featuredCitation.pageStart}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{featuredCitation.snippet}</p>
            <a
              href={featuredCitation.sourceUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
            >
              View on pakistancode.gov.pk <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>

        <p className="mt-4 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          {reducedMotion
            ? "An actual answer, unedited."
            : "Streamed live — nothing here is a recording. Hover to pause and read; it loops on its own otherwise."}
        </p>
      </div>
    </section>
  );
}
