/**
 * Normalize an LLM text response down to the JSON object it contains.
 *
 * Models (Claude and Gemini in particular) frequently wrap JSON answers in
 * Markdown code fences or add prose around them even when told not to.
 * Flattens multipart content (string | TextContent[]), strips fences, and
 * slices to the outermost braces when present. Returns "" when no usable
 * text remains — callers decide whether that is an error.
 */
export function extractJsonText(raw: unknown): string {
  let text = "";
  if (typeof raw === "string") {
    text = raw;
  } else if (Array.isArray(raw)) {
    text = raw
      .map(part =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : ""
      )
      .join("");
  }
  text = text.trim();
  if (!text) return "";

  text = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    text = text.slice(first, last + 1);
  }
  return text;
}
