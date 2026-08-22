import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";
import { validateEndpoint } from "./http.js";
import type { EndpointPolicy } from "./http.js";

export interface AnthropicProviderConfig extends EndpointPolicy {
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
}

export class AnthropicProvider extends BaseProvider {
  private readonly config: AnthropicProviderConfig;

  constructor(config: AnthropicProviderConfig = {}) {
    super();
    if (config.baseURL) validateEndpoint(config.baseURL, config);
    this.config = { ...config };
  }

  async generate({
    model,
    messages,
  }: {
    model: string;
    messages: Message[];
  }): Promise<ProviderResponse> {
    const apiKey = this.config.apiKey ?? process.env["ANTHROPIC_API_KEY"];
    if (!apiKey)
      throw new Error(
        "Anthropic API key required. Set ANTHROPIC_API_KEY or pass apiKey in config.",
      );

    let mod: { default: new (opts: Record<string, unknown>) => unknown };
    try {
      mod = (await import("@anthropic-ai/sdk")) as unknown as typeof mod;
    } catch {
      throw new Error(
        "Anthropic SDK not installed. Run: pnpm add @anthropic-ai/sdk",
      );
    }

    const client = new mod.default({
      apiKey,
      baseURL: this.config.baseURL,
    }) as {
      messages: {
        create: (args: {
          model: string;
          max_tokens: number;
          system?: string;
          messages: Array<{ role: "user" | "assistant"; content: string }>;
        }) => Promise<{
          content: Array<{ type: string; text?: string }>;
          usage: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number;
            cache_read_input_tokens?: number;
          };
        }>;
      };
    };

    const systemMessages = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
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
    const text = textBlock?.type === "text" ? (textBlock.text ?? "") : "";
    const promptTokens =
      res.usage.input_tokens +
      (res.usage.cache_creation_input_tokens ?? 0) +
      (res.usage.cache_read_input_tokens ?? 0);

    return {
      text,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: res.usage.output_tokens,
        total_tokens: promptTokens + res.usage.output_tokens,
        cached_input_tokens: res.usage.cache_read_input_tokens,
      },
    };
  }
}
