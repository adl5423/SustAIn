import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";
import { secureFetchJson, validateEndpoint } from "./http.js";

export interface OllamaProviderConfig {
  baseURL?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  allowPrivateNetwork?: boolean;
  allowedHosts?: string[];
}

interface OllamaChatResponse {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider extends BaseProvider {
  private readonly config: OllamaProviderConfig;
  private readonly endpoint: string;
  private readonly allowPrivateNetwork: boolean;

  constructor(config: OllamaProviderConfig = {}) {
    super();
    const configuredBaseUrl = config.baseURL ?? process.env["OLLAMA_BASE_URL"];
    const baseURL = configuredBaseUrl ?? "http://localhost:11434";
    this.allowPrivateNetwork =
      config.allowPrivateNetwork ?? configuredBaseUrl === undefined;
    const validated = validateEndpoint(baseURL, {
      allowInsecureHttp: true,
      allowPrivateNetwork: this.allowPrivateNetwork,
      ...(config.allowedHosts ? { allowedHosts: config.allowedHosts } : {}),
    });
    this.endpoint = new URL("/api/chat", validated).toString();
    this.config = { ...config };
  }

  async generate({
    model,
    messages,
  }: {
    model: string;
    messages: Message[];
  }): Promise<ProviderResponse> {
    const data = await secureFetchJson<OllamaChatResponse>(this.endpoint, {
      body: {
        model,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        stream: false,
      },
      allowInsecureHttp: true,
      allowPrivateNetwork: this.allowPrivateNetwork,
      ...(this.config.allowedHosts
        ? { allowedHosts: this.config.allowedHosts }
        : {}),
      ...(this.config.timeoutMs !== undefined
        ? { timeoutMs: this.config.timeoutMs }
        : {}),
      ...(this.config.maxResponseBytes !== undefined
        ? { maxResponseBytes: this.config.maxResponseBytes }
        : {}),
    });

    const promptTokens = finiteCount(data.prompt_eval_count);
    const completionTokens = finiteCount(data.eval_count);
    return {
      text: data.message?.content ?? "",
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    };
  }
}

function finiteCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}
