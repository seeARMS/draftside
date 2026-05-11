import type { JSONContent } from "@tiptap/core";
import type { WriteSession } from "./types";

export const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function createBlankSession(): WriteSession {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: "Untitled",
    content: EMPTY_DOC,
    plainText: "",
    createdAt: now,
    updatedAt: now,
    wordCount: 0,
  };
}

export function deriveTitle(text: string) {
  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) return "Untitled";
  return firstLine.replace(/^#+\s*/, "").slice(0, 72);
}

export function countWords(text: string) {
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}
