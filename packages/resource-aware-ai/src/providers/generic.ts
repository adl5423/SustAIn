import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";

export interface GenericProviderConfig {
  endpoint: string;
  headers?: Record<string, string>;
  apiKey?: string;
  transformRequest?: (model: string, messages: Message[]) => unknown;
  transformResponse?: (data: unknown) => ProviderResponse;
}

export class GenericProvider extends BaseProvider {
  private config: GenericProviderConfig;

  constructor(config: GenericProviderConfig) {
    super();
    if (!config.endpoint) throw new Error("GenericProvider requires an endpoint URL.");
    this.config = config;
  }

  async generate({ model, messages }: { model: string; messages: Message[] }): Promise<ProviderResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    const body = this.config.transformRequest
      ? this.config.transformRequest(model, messages)
      : { model, messages };

    const res = await fetch(this.config.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Generic provider error ${res.status}: ${text}`);
    }

    const data = await res.json();

    if (this.config.transformResponse) {
      return this.config.transformResponse(data);
    }

    return defaultTransformResponse(data);
  }
}

function defaultTransformResponse(data: unknown): ProviderResponse {
  if (typeof data !== "object" || data === null) {
    throw new Error("Unexpected response format from generic provider.");
  }

  const d = data as Record<string, unknown>;

  const text =
    (d["output"] as string | undefined) ??
    (d["text"] as string | undefined) ??
    (d["content"] as string | undefined) ??
    ((d["choices"] as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content) ??
    "";

  return { text, usage: (d["usage"] as ProviderResponse["usage"]) ?? undefined };
}
