import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";

export interface OpenAIProviderConfig {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
}

export class OpenAIProvider extends BaseProvider {
  private config: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig = {}) {
    super();
    this.config = config;
  }

  async generate({ model, messages }: { model: string; messages: Message[] }): Promise<ProviderResponse> {
    const apiKey = this.config.apiKey ?? process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OpenAI API key required. Set OPENAI_API_KEY or pass apiKey in config.");

    let mod: { default: new (opts: Record<string, unknown>) => unknown };
    try {
      mod = (await import("openai")) as unknown as typeof mod;
    } catch {
      throw new Error("OpenAI SDK not installed. Run: npm install openai");
    }

    const client = new mod.default({
      apiKey,
      baseURL: this.config.baseURL,
      organization: this.config.organization,
    }) as {
      chat: {
        completions: {
          create: (args: { model: string; messages: Message[] }) => Promise<{
            choices: Array<{ message: { content: string | null } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          }>;
        };
      };
    };

    const res = await client.chat.completions.create({ model, messages });
    const choice = res.choices[0];

    return {
      text: choice?.message.content ?? "",
      usage: res.usage
        ? {
            prompt_tokens: res.usage.prompt_tokens,
            completion_tokens: res.usage.completion_tokens,
            total_tokens: res.usage.total_tokens,
          }
        : undefined,
    };
  }
}
