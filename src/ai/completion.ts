import type { CompletionLength } from "../lib/types";

export const COMPLETION_LENGTH_OPTIONS = [
  { value: "short", label: "Short", description: "3–10 words" },
  { value: "medium", label: "Medium", description: "15–30 words" },
  { value: "long", label: "Long", description: "40–80 words" },
] as const satisfies ReadonlyArray<{ value: CompletionLength; label: string; description: string }>;

export const COMPLETION_LENGTH_CONFIG: Record<CompletionLength, {
  instruction: string;
  maxSentences: number;
  maxWords: number;
  maxChars: number;
}> = {
  short: {
    instruction: "Continue only the unfinished sentence at the cursor. Keep it subtle: 3 to 10 words, at most one short clause.",
    maxSentences: 1,
    maxWords: 12,
    maxChars: 96,
  },
  medium: {
    instruction: "Continue the writing at the cursor with 15 to 30 words, completing the current sentence and adding one more sentence if useful. Return at most two sentences.",
    maxSentences: 2,
    maxWords: 40,
    maxChars: 320,
  },
  long: {
    instruction: "Continue the writing at the cursor with a developed paragraph of 40 to 80 words. Complete the current sentence and carry the idea forward in up to four sentences, matching the writer's voice.",
    maxSentences: 4,
    maxWords: 100,
    maxChars: 800,
  },
};
