import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";

export interface MistralProviderConfig {
  apiKey?: string;
  serverURL?: string;
}

export class MistralProvider extends BaseProvider {
  private config: MistralProviderConfig;

  constructor(config: MistralProviderConfig = {}) {
    super();
    this.config = config;
  }

  async generate({ model, messages }: { model: string; messages: Message[] }): Promise<ProviderResponse> {
    const apiKey = this.config.apiKey ?? process.env["MISTRAL_API_KEY"];
    if (!apiKey) throw new Error("Mistral API key required. Set MISTRAL_API_KEY or pass apiKey in config.");

    let Mistral: typeof import("@mistralai/mistralai").Mistral;
    try {
      ({ Mistral } = await import("@mistralai/mistralai"));
    } catch {
      throw new Error('Mistral SDK not installed. Run: npm install @mistralai/mistralai');
    }

    const client = new Mistral({ apiKey, serverURL: this.config.serverURL });

    const res = await client.chat.complete({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const choice = res.choices?.[0];
    const content = choice?.message?.content;
    const text = typeof content === "string" ? content : (content?.[0] as { text?: string } | undefined)?.text ?? "";

    return {
      text,
      usage: res.usage
        ? {
            prompt_tokens: res.usage.promptTokens,
            completion_tokens: res.usage.completionTokens,
            total_tokens: res.usage.totalTokens,
          }
        : undefined,
    };
  }
}
