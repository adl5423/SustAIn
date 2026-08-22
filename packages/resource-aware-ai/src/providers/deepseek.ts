import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";
import { UniversalProvider } from "./universal.js";
import type { EndpointPolicy } from "./http.js";

export interface DeepSeekProviderConfig extends EndpointPolicy {
  apiKey?: string;
  endpoint?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export class DeepSeekProvider extends BaseProvider {
  private readonly config: DeepSeekProviderConfig;

  constructor(config: DeepSeekProviderConfig = {}) {
    super();
    this.config = { ...config };
  }

  generate(options: {
    model: string;
    messages: Message[];
  }): Promise<ProviderResponse> {
    const apiKey = this.config.apiKey ?? process.env["DEEPSEEK_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "DeepSeek API key required. Set DEEPSEEK_API_KEY or pass apiKey in config.",
      );
    }
    const provider = new UniversalProvider({
      endpoint:
        this.config.endpoint ?? "https://api.deepseek.com/chat/completions",
      protocol: "openai-chat-completions",
      apiKey,
      ...(this.config.timeoutMs !== undefined
        ? { timeoutMs: this.config.timeoutMs }
        : {}),
      ...(this.config.maxResponseBytes !== undefined
        ? { maxResponseBytes: this.config.maxResponseBytes }
        : {}),
      ...(this.config.allowInsecureHttp !== undefined
        ? { allowInsecureHttp: this.config.allowInsecureHttp }
        : {}),
      ...(this.config.allowPrivateNetwork !== undefined
        ? { allowPrivateNetwork: this.config.allowPrivateNetwork }
        : {}),
      ...(this.config.allowedHosts
        ? { allowedHosts: this.config.allowedHosts }
        : {}),
    });
    return provider.generate(options);
  }
}
