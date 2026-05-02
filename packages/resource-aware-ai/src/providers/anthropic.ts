import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";

export interface AnthropicProviderConfig {
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
}

export class AnthropicProvider extends BaseProvider {
  private config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig = {}) {
    super();
    this.config = config;
  }

  async generate({ model, messages }: { model: string; messages: Message[] }): Promise<ProviderResponse> {
    const apiKey = this.config.apiKey ?? process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("Anthropic API key required. Set ANTHROPIC_API_KEY or pass apiKey in config.");

    let mod: { default: new (opts: Record<string, unknown>) => unknown };
    try {
      mod = (await import("@anthropic-ai/sdk")) as unknown as typeof mod;
    } catch {
      throw new Error("Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk");
    }

    const client = new mod.default({ apiKey, baseURL: this.config.baseURL }) as {
      messages: {
        create: (args: {
          model: string;
          max_tokens: number;
          system?: string;
          messages: Array<{ role: "user" | "assistant"; content: string }>;
        }) => Promise<{
          content: Array<{ type: string; text?: string }>;
          usage: { input_tokens: number; output_tokens: number };
        }>;
      };
    };

    const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const userMessages = messages.filter((m) => m.role !== "system");

    const res = await client.messages.create({
      model,
      max_tokens: this.config.maxTokens ?? 4096,
      system: systemMessages || undefined,
      messages: userMessages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const textBlock = res.content.find((b) => b.type === "text");
    const text = textBlock?.type === "text" ? textBlock.text ?? "" : "";

    return {
      text,
      usage: {
        prompt_tokens: res.usage.input_tokens,
        completion_tokens: res.usage.output_tokens,
        total_tokens: res.usage.input_tokens + res.usage.output_tokens,
      },
    };
  }
}
