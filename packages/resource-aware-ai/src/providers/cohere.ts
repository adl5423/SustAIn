import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";

export interface CohereProviderConfig {
  apiKey?: string;
}

export class CohereProvider extends BaseProvider {
  private config: CohereProviderConfig;

  constructor(config: CohereProviderConfig = {}) {
    super();
    this.config = config;
  }

  async generate({ model, messages }: { model: string; messages: Message[] }): Promise<ProviderResponse> {
    const apiKey = this.config.apiKey ?? process.env["COHERE_API_KEY"];
    if (!apiKey) throw new Error("Cohere API key required. Set COHERE_API_KEY or pass apiKey in config.");

    let CohereClientV2: typeof import("cohere-ai").CohereClientV2;
    try {
      ({ CohereClientV2 } = await import("cohere-ai"));
    } catch {
      throw new Error('Cohere SDK not installed. Run: npm install cohere-ai');
    }

    const client = new CohereClientV2({ token: apiKey });

    const res = await client.chat({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const text = res.message?.content
      ?.filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("") ?? "";

    return {
      text,
      usage: res.usage
        ? {
            prompt_tokens: res.usage.tokens?.inputTokens,
            completion_tokens: res.usage.tokens?.outputTokens,
            total_tokens:
              (res.usage.tokens?.inputTokens ?? 0) + (res.usage.tokens?.outputTokens ?? 0),
          }
        : undefined,
    };
  }
}
