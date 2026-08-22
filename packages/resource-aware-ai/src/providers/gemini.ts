import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";

export interface GeminiProviderConfig {
  apiKey?: string;
  apiVersion?: string;
}

interface GeminiResponseShape {
  text?: string | (() => string);
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    cachedContentTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

export class GeminiProvider extends BaseProvider {
  private readonly config: GeminiProviderConfig;

  constructor(config: GeminiProviderConfig = {}) {
    super();
    this.config = { ...config };
  }

  async generate({
    model,
    messages,
  }: {
    model: string;
    messages: Message[];
  }): Promise<ProviderResponse> {
    const apiKey =
      this.config.apiKey ??
      process.env["GEMINI_API_KEY"] ??
      process.env["GOOGLE_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "Gemini API key required. Set GEMINI_API_KEY or pass apiKey in config.",
      );
    }

    let GoogleGenAI: new (options: Record<string, unknown>) => {
      models: {
        generateContent: (
          request: Record<string, unknown>,
        ) => Promise<GeminiResponseShape>;
      };
    };
    try {
      const module = await import("@google/genai");
      GoogleGenAI = module.GoogleGenAI as unknown as typeof GoogleGenAI;
    } catch {
      throw new Error(
        "Google Gen AI SDK not installed. Run: pnpm add @google/genai",
      );
    }

    const client = new GoogleGenAI({
      apiKey,
      ...(this.config.apiVersion ? { apiVersion: this.config.apiVersion } : {}),
    });
    const systemInstruction = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      }));
    if (contents.length === 0)
      throw new TypeError("GeminiProvider requires a user message.");

    const response = await client.models.generateContent({
      model,
      contents,
      ...(systemInstruction ? { config: { systemInstruction } } : {}),
    });
    const text =
      typeof response.text === "function"
        ? response.text()
        : (response.text ?? "");
    const usage = response.usageMetadata;
    const completionTokens = sumDefinedCounts(
      usage?.candidatesTokenCount,
      usage?.thoughtsTokenCount,
    );

    return {
      text,
      ...(usage
        ? {
            usage: {
              prompt_tokens: usage.promptTokenCount,
              completion_tokens: completionTokens,
              total_tokens: usage.totalTokenCount,
              cached_input_tokens: usage.cachedContentTokenCount,
              reasoning_tokens: usage.thoughtsTokenCount,
            },
          }
        : {}),
    };
  }
}

function sumDefinedCounts(
  ...counts: Array<number | undefined>
): number | undefined {
  const defined = counts.filter(
    (count): count is number =>
      typeof count === "number" && Number.isFinite(count) && count >= 0,
  );
  return defined.length > 0
    ? defined.reduce((total, count) => total + count, 0)
    : undefined;
}
