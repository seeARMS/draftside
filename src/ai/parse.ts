import type { Classification, DraftUpdate, ExpressionOption } from "../lib/types";
import { extractJsonArray, extractJsonObject, stripJsonFences } from "../lib/json";

function normalizeDraftUpdate(raw: unknown): DraftUpdate | null {
  const data = raw && typeof raw === "object" ? (raw as { text?: unknown; markdown?: unknown; summary?: unknown }) : null;
  if (!data) return null;

  const text = typeof data.text === "string" ? data.text.trim() : typeof data.markdown === "string" ? data.markdown.trim() : "";
  if (!text) return null;

  const summary = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim().slice(0, 120) : "Updated the draft";
  return { text, summary };
}

export function parseChatResponse(input: string): { reply: string; draftUpdate: DraftUpdate | null } {
  const json = extractJsonObject(input);

  if (json) {
    try {
      const data = JSON.parse(json) as { reply?: unknown; draftUpdate?: unknown; update?: unknown };
      const reply = typeof data.reply === "string" ? data.reply.trim() : "";
      return {
        reply: reply || "Done.",
        draftUpdate: normalizeDraftUpdate(data.draftUpdate ?? data.update ?? null),
      };
    } catch {
      // Fall through to plain text so the chat never exposes JSON parser errors.
    }
  }

  return {
    reply: stripJsonFences(input).trim() || "I could not produce a local response.",
    draftUpdate: null,
  };
}

function looseClassificationField(input: string, field: keyof Classification) {
  const match = input.match(new RegExp(`["']?${field}["']?\\s*[:=]\\s*["']?([^"',}\\]\\n]+)`, "i"));
  return match?.[1]?.trim();
}

function looseClassificationTags(input: string) {
  const tags = input.match(/["']?tags["']?\s*[:=]\s*\[([^\]]*)\]/i)?.[1];
  if (!tags) return [];

  return tags
    .split(",")
    .map((tag) => tag.replace(/^["'\s]+|["'\s]+$/g, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeClassification(raw: unknown): Classification {
  const data = raw && typeof raw === "object" ? (raw as Partial<Classification>) : {};

  return {
    form: typeof data.form === "string" ? data.form : "draft",
    intent: typeof data.intent === "string" ? data.intent : "unclear",
    stance: typeof data.stance === "string" ? data.stance : "developing",
    friction: typeof data.friction === "string" ? data.friction : "needs more context",
    nextMove: typeof data.nextMove === "string" ? data.nextMove : "write the next concrete sentence",
    confidence: typeof data.confidence === "number" ? Math.max(0, Math.min(1, data.confidence)) : 0.5,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 5) : [],
    observation: typeof data.observation === "string" ? data.observation.trim().slice(0, 220) : undefined,
  };
}

function looseClassification(input: string): Classification {
  const confidence = Number(looseClassificationField(input, "confidence"));

  return normalizeClassification({
    form: looseClassificationField(input, "form"),
    intent: looseClassificationField(input, "intent"),
    stance: looseClassificationField(input, "stance"),
    friction: looseClassificationField(input, "friction"),
    nextMove: looseClassificationField(input, "nextMove"),
    confidence: Number.isFinite(confidence) ? confidence : undefined,
    tags: looseClassificationTags(input),
  });
}

export function parseAmbientResponse(input: string): Classification {
  const json = extractJsonObject(input);

  if (json) {
    try {
      return normalizeClassification(JSON.parse(json));
    } catch {
      // Fall through to loose parse so a bad JSON does not kill the ambient pass.
    }
  }

  const loose = looseClassification(input);
  const observationMatch = input.match(/["']?observation["']?\s*[:=]\s*["']([^"']+)["']/i);
  if (observationMatch?.[1]) {
    loose.observation = observationMatch[1].trim().slice(0, 220);
  }
  return loose;
}

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

export function parseExpressionOptions(input: string, original: string) {
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
