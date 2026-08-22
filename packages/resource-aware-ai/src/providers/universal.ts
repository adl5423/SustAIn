import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";
import { secureFetchJson, validateEndpoint } from "./http.js";
import type { EndpointPolicy } from "./http.js";

export type UniversalProtocol =
  "openai-responses" | "openai-chat-completions" | "generic-json";

export interface UniversalProviderConfig extends EndpointPolicy {
  endpoint: string;
  protocol?: UniversalProtocol;
  apiKey?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxResponseBytes?: number;
  transformRequest?: (model: string, messages: Message[]) => unknown;
  transformResponse?: (data: unknown) => ProviderResponse;
}

export class UniversalProvider extends BaseProvider {
  private readonly config: UniversalProviderConfig;

  constructor(config: UniversalProviderConfig) {
    super();
    if (!config.endpoint)
      throw new TypeError("UniversalProvider requires an endpoint URL.");
    validateEndpoint(config.endpoint, config);
    this.config = { ...config };
  }

  async generate({
    model,
    messages,
  }: {
    model: string;
    messages: Message[];
  }): Promise<ProviderResponse> {
    const protocol = this.config.protocol ?? "openai-chat-completions";
    const headers = { ...this.config.headers };
    if (this.config.apiKey && !hasAuthorizationHeader(headers)) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const body = this.config.transformRequest
      ? this.config.transformRequest(model, messages)
      : buildRequest(protocol, model, messages);
    const data = await secureFetchJson(this.config.endpoint, {
      headers,
      body,
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

    if (this.config.transformResponse)
      return this.config.transformResponse(data);
    return parseResponse(protocol, data);
  }
}

function buildRequest(
  protocol: UniversalProtocol,
  model: string,
  messages: Message[],
): unknown {
  if (protocol === "openai-responses") {
    return {
      model,
      store: false,
      input: messages.map((message) => ({
        role: message.role === "system" ? "developer" : message.role,
        content: message.content,
      })),
    };
  }
  return { model, messages };
}

function parseResponse(
  protocol: UniversalProtocol,
  data: unknown,
): ProviderResponse {
  const record = asRecord(data);
  if (protocol === "openai-responses") {
    const outputText =
      stringField(record, "output_text") ??
      extractResponsesText(record["output"]);
    const usage = asOptionalRecord(record["usage"]);
    return {
      text: outputText,
      ...(usage
        ? {
            usage: {
              prompt_tokens: numberField(usage, "input_tokens"),
              completion_tokens: numberField(usage, "output_tokens"),
              total_tokens: numberField(usage, "total_tokens"),
              cached_input_tokens: numberField(
                asOptionalRecord(usage["input_tokens_details"]),
                "cached_tokens",
              ),
              reasoning_tokens: numberField(
                asOptionalRecord(usage["output_tokens_details"]),
                "reasoning_tokens",
              ),
            },
          }
        : {}),
    };
  }

  const text =
    extractChatText(record["choices"]) ??
    stringField(record, "output") ??
    stringField(record, "text") ??
    stringField(record, "content") ??
    "";
  const usage = asOptionalRecord(record["usage"]);
  return {
    text,
    ...(usage
      ? {
          usage: {
            prompt_tokens: numberField(usage, "prompt_tokens"),
            completion_tokens: numberField(usage, "completion_tokens"),
            total_tokens: numberField(usage, "total_tokens"),
          },
        }
      : {}),
  };
}

function extractResponsesText(output: unknown): string {
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    const record = asOptionalRecord(item);
    if (!record || !Array.isArray(record["content"])) continue;
    for (const content of record["content"]) {
      const part = asOptionalRecord(content);
      const text = part ? stringField(part, "text") : undefined;
      if (text) chunks.push(text);
    }
  }
  return chunks.join("\n");
}

function extractChatText(choices: unknown): string | undefined {
  if (!Array.isArray(choices)) return undefined;
  const first = asOptionalRecord(choices[0]);
  const message = first ? asOptionalRecord(first["message"]) : undefined;
  return message ? stringField(message, "content") : undefined;
}

function hasAuthorizationHeader(headers: Record<string, string>): boolean {
  return Object.keys(headers).some(
    (name) => name.toLowerCase() === "authorization",
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  const record = asOptionalRecord(value);
  if (!record)
    throw new TypeError("Provider returned a non-object JSON response.");
  return record;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringField(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof record[key] === "string" ? record[key] : undefined;
}

function numberField(
  record: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
