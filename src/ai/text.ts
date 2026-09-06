import { MAX_MODEL_CHARS } from "./constants";

export function getCompletionPrefix(before: string) {
  // Keep cursor whitespace: it distinguishes a finished word from a partial one.
  return before.split(/(?<=[.!?])\s+/u).pop()?.trimStart() ?? before;
}

export function truncateForModel(text: string, limit = MAX_MODEL_CHARS) {
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.floor(limit * 0.55))}\n\n[...]\n\n${text.slice(-Math.floor(limit * 0.4))}`;
}

export function fingerprintText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `${text.length}:${hash}`;
}

export function mergeStreamChunk(previous: string, chunk: string) {
  if (!chunk) return previous;
  if (chunk.startsWith(previous)) return chunk;
  return `${previous}${chunk}`;
}

export async function readTextStream(stream: ReadableStream<string>, onText: (text: string) => void) {
  const reader = stream.getReader();
  let result = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    result = mergeStreamChunk(result, value ?? "");
    onText(result);
  }

  return result;
}
