import type { ExpressionOption } from "./types";
import { extractJsonArray, stripJsonFences } from "./json";

function cleanExpressionText(value: string) {
  return value
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeExpressionOptions(raw: unknown, original: string): ExpressionOption[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const originalKey = original.trim().toLocaleLowerCase();
  const options: ExpressionOption[] = [];

  for (const item of raw) {
    const text =
      typeof item === "string"
        ? cleanExpressionText(item)
        : item && typeof item === "object" && "text" in item && typeof item.text === "string"
          ? cleanExpressionText(item.text)
          : "";
    const note =
      item && typeof item === "object" && "note" in item && typeof item.note === "string"
        ? cleanExpressionText(item.note).slice(0, 44)
        : "";
    const key = text.toLocaleLowerCase();

    if (!text || key === originalKey || seen.has(key) || text.length > 96) continue;
    seen.add(key);
    options.push({ text, note });
    if (options.length === 6) break;
  }

  return options;
}

function parseExpressionOptions(input: string, original: string) {
  const json = extractJsonArray(input);
  if (json) {
    try {
      return normalizeExpressionOptions(JSON.parse(json), original);
    } catch {
      // Fall through to line parsing.
    }
  }

  const objectLineOptions = input
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith("{") && line.endsWith("}"))
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });

  if (objectLineOptions.length) {
    return normalizeExpressionOptions(objectLineOptions, original);
  }

  return normalizeExpressionOptions(
    input
      .replace(/```(?:json)?/gi, "\n")
      .replace(/```/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => !/^[\[\]{},\s]+$/.test(line))
      .filter((line) => !/"text"\s*:/.test(line))
      .filter(Boolean),
    original,
  );
}

export { parseExpressionOptions };
