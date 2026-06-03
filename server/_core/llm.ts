import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

/**
 * Returns true when the model name indicates an OpenAI o-series reasoning model
 * (o1, o3, o4-mini, etc.). These models:
 *   - Use `max_completion_tokens` instead of `max_tokens`
 *   - Do not support `response_format: json_schema` (use json_object or prompt-based JSON)
 *   - Do not support `system` role messages (use `developer` role instead)
 */
function isOSeriesModel(model: string): boolean {
  return /^o\d/i.test(model.trim());
}

/**
 * Choose an OpenAI-compatible LLM backend.
 *   1. If both BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY are set,
 *      use the Forge proxy.
 *   2. If GEMINI_API_KEY is set, use Google's OpenAI-compatible endpoint
 *      (https://generativelanguage.googleapis.com/v1beta/openai/).
 *   3. Otherwise, fall back to direct OpenAI using OPENAI_API_KEY (and
 *      OPENAI_API_URL, which defaults to https://api.openai.com/v1).
 */
type LLMBackend = { url: string; key: string; model: string };
function resolveBackend(): LLMBackend {
  if (
    ENV.forgeApiUrl &&
    ENV.forgeApiUrl.trim().length > 0 &&
    ENV.forgeApiKey
  ) {
    return {
      url: `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`,
      key: ENV.forgeApiKey,
      model: "gemini-2.5-flash",
    };
  }
  if (ENV.geminiApiKey) {
    return {
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: ENV.geminiApiKey,
      model: ENV.geminiModel || "gemini-2.5-flash",
    };
  }
  if (ENV.openaiApiKey) {
    return {
      url: `${ENV.openaiApiUrl}/chat/completions`,
      key: ENV.openaiApiKey,
      model: ENV.openaiModel || "gpt-4.1-mini",
    };
  }
  throw new Error(
    "No AI backend configured. Set OPENAI_API_KEY, BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY, or GEMINI_API_KEY."
  );
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

/**
 * Returns true when a GEMINI_API_KEY is configured for native inline-file API access.
 * Used by file-parsing callers to decide whether to send files as inline data rather
 * than extracting text first.
 */
export function isGeminiDirectAvailable(): boolean {
  return Boolean(ENV.geminiApiKey?.trim());
}

/**
 * Invoke Gemini via the OpenAI-compatible endpoint with an inline file (PDF or image).
 *
 * Sends the file as a base64 data URL in an image_url content part, which the
 * Gemini OpenAI-compatible endpoint handles for PDFs and images alike.
 * This approach is more reliable than the native generateContent API for
 * structured JSON extraction.
 *
 * Falls back to the regular `invokeLLM` path when GEMINI_API_KEY is not set.
 */
export async function invokeLLMWithFile(params: {
  fileBuffer: Buffer;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  systemPrompt: string;
  userPrompt: string;
  /** Optional JSON Schema — when provided the AI will return structured JSON. */
  outputSchema?: OutputSchema;
}): Promise<string> {
  const { fileBuffer, mimeType, systemPrompt, userPrompt } = params;

  if (!ENV.geminiApiKey?.trim()) {
    throw new Error(
      "invokeLLMWithFile requires GEMINI_API_KEY. Set GEMINI_API_KEY in the server environment."
    );
  }

  const model = (ENV.geminiModel || "gemini-2.5-flash").trim();
  const base64Data = fileBuffer.toString("base64");
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  // Use the OpenAI-compatible Gemini endpoint
  const url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

  const payload = {
    model,
    max_tokens: 8192,
    temperature: 0,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
          {
            type: "text",
            text: userPrompt,
          },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.geminiApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini OpenAI-compat file API failed: ${response.status} ${response.statusText} – ${errorText.slice(0, 800)}`
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
    }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const text = data.choices?.[0]?.message?.content ?? "";
  return text;
}

/**
 * Recursively remove `additionalProperties` keys from a JSON Schema object.
 * Gemini's responseSchema does not support this keyword and will return a 400 error.
 */
function stripAdditionalProperties(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = stripAdditionalProperties(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        item && typeof item === "object" && !Array.isArray(item)
          ? stripAdditionalProperties(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Returns true when an Anthropic API key is configured for Claude fallback.
 */
export function isClaudeFallbackAvailable(): boolean {
  return Boolean(ENV.anthropicApiKey?.trim());
}

/**
 * Invoke Claude as a fallback for document extraction when Gemini returns poor results.
 * Uses the Anthropic Messages API with base64 document content.
 */
export async function invokeClaudeWithFile(params: {
  fileBuffer: Buffer;
  mimeType: "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
  systemPrompt: string;
  userPrompt: string;
}): Promise<string> {
  const { fileBuffer, mimeType, systemPrompt, userPrompt } = params;

  if (!ENV.anthropicApiKey?.trim()) {
    throw new Error("invokeClaudeWithFile requires ANTHROPIC_API_KEY.");
  }

  const model = ENV.anthropicModel || "claude-sonnet-4-20250514";
  const url = "https://api.anthropic.com/v1/messages";

  // Claude uses a different content format for documents/images
  const mediaType = mimeType === "application/pdf" ? "document" : "image";
  const sourceType = "base64";

  const body = {
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: mediaType,
            source: {
              type: sourceType,
              media_type: mimeType,
              data: fileBuffer.toString("base64"),
            },
          },
          {
            type: "text",
            text: userPrompt,
          },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ENV.anthropicApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Claude API failed: ${response.status} ${response.statusText} – ${errorText.slice(0, 800)}`
    );
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(`Claude API error: ${data.error.message}`);
  }

  const text = data.content?.find(b => b.type === "text")?.text ?? "";
  return text;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const backend = resolveBackend();
  const oSeries = isOSeriesModel(backend.model);

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  // o-series models do not support the `system` role — convert to `developer`
  const normalizedMessages = messages.map(normalizeMessage).map(msg => {
    if (oSeries && msg.role === "system") {
      return { ...msg, role: "developer" as const };
    }
    return msg;
  });

  const payload: Record<string, unknown> = {
    model: backend.model,
    messages: normalizedMessages,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const tokenLimit = params.maxTokens ?? params.max_tokens ?? 4096;
  if (oSeries) {
    // o-series models use max_completion_tokens, not max_tokens
    payload.max_completion_tokens = tokenLimit;
  } else {
    payload.max_tokens = tokenLimit;
  }

  let normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  // o-series models do not support json_schema response format — downgrade to json_object
  // and rely on the system/developer prompt to enforce JSON structure
  if (oSeries && normalizedResponseFormat?.type === "json_schema") {
    normalizedResponseFormat = { type: "json_object" };
  }

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(backend.url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${backend.key}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}
