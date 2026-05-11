export function stripJsonFences(input: string) {
  return input
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractFirstJsonValue(input: string, open: "{" | "[", close: "}" | "]") {
  const text = stripJsonFences(input);
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "\"") {
        inString = false;
      }
      continue;
    }

    if (character === "\"") {
      inString = true;
      continue;
    }

    if (character === open) depth += 1;
    if (character === close) depth -= 1;

    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

export function extractJsonArray(input: string) {
  return extractFirstJsonValue(input, "[", "]");
}

export function extractJsonObject(input: string) {
  return extractFirstJsonValue(input, "{", "}");
}
