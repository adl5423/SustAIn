import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";

export interface OllamaProviderConfig {
  baseURL?: string;
}

export class OllamaProvider extends BaseProvider {
  private baseURL: string;

  constructor(config: OllamaProviderConfig = {}) {
    super();
    this.baseURL = config.baseURL ?? process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
  }

  async generate({ model, messages }: { model: string; messages: Message[] }): Promise<ProviderResponse> {
    const url = `${this.baseURL}/api/chat`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama error ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      message?: { content?: string };
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      text: data.message?.content ?? "",
      usage: {
        prompt_tokens: data.prompt_eval_count,
        completion_tokens: data.eval_count,
        total_tokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    };
  }
}
