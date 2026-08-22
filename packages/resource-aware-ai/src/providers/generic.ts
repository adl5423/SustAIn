import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";
import { UniversalProvider } from "./universal.js";
import type { EndpointPolicy } from "./http.js";

export interface GenericProviderConfig extends EndpointPolicy {
  endpoint: string;
  headers?: Record<string, string>;
  apiKey?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  transformRequest?: (model: string, messages: Message[]) => unknown;
  transformResponse?: (data: unknown) => ProviderResponse;
}

/**
 * Compatibility wrapper for the original custom JSON connector. New code can
 * use UniversalProvider directly to select an OpenAI-compatible protocol.
 */
export class GenericProvider extends BaseProvider {
  private readonly universal: UniversalProvider;

  constructor(config: GenericProviderConfig) {
    super();
    this.universal = new UniversalProvider({
      ...config,
      protocol: "generic-json",
    });
  }

  generate(options: {
    model: string;
    messages: Message[];
  }): Promise<ProviderResponse> {
    return this.universal.generate(options);
  }
}
