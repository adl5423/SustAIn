import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";
import { validateEndpoint } from "./http.js";
import type { EndpointPolicy } from "./http.js";

export interface OpenAIProviderConfig extends EndpointPolicy {
  apiKey?: string;
  baseURL?: string;
  organization?: string;
  project?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Responses are not stored by default. */
  store?: boolean;
}

interface OpenAIResponseShape {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
  };
}

export class OpenAIProvider extends BaseProvider {
  private readonly config: OpenAIProviderConfig;

  constructor(config: OpenAIProviderConfig = {}) {
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
    const apiKey = this.config.apiKey ?? process.env["OPENAI_API_KEY"];
    if (!apiKey) {
      throw new Error(
        "OpenAI API key required. Set OPENAI_API_KEY or pass apiKey in config.",
      );
    }

    let OpenAI: new (options: Record<string, unknown>) => {
      responses: {
        create: (
          request: Record<string, unknown>,
        ) => Promise<OpenAIResponseShape>;
      };
    };
    try {
      const module = await import("openai");
      OpenAI = module.default as unknown as typeof OpenAI;
    } catch {
      throw new Error("OpenAI SDK not installed. Run: pnpm add openai");
    }

    const client = new OpenAI({
      apiKey,
      ...(this.config.baseURL ? { baseURL: this.config.baseURL } : {}),
      ...(this.config.organization
        ? { organization: this.config.organization }
        : {}),
      ...(this.config.project ? { project: this.config.project } : {}),
      ...(this.config.timeoutMs !== undefined
        ? { timeout: this.config.timeoutMs }
        : {}),
      ...(this.config.maxRetries !== undefined
        ? { maxRetries: this.config.maxRetries }
        : {}),
    });

    const instructions = messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n\n");
    const input = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role, content: message.content }));
    if (input.length === 0)
      throw new TypeError(
        "OpenAIProvider requires a user or assistant message.",
      );

    const response = await client.responses.create({
      model,
      input,
      ...(instructions ? { instructions } : {}),
      store: this.config.store ?? false,
    });
    const text = response.output_text ?? extractOutputText(response.output);

    return {
      text,
      ...(response.usage
        ? {
            usage: {
              prompt_tokens: response.usage.input_tokens,
              completion_tokens: response.usage.output_tokens,
              total_tokens: response.usage.total_tokens,
              cached_input_tokens:
                response.usage.input_tokens_details?.cached_tokens,
              reasoning_tokens:
                response.usage.output_tokens_details?.reasoning_tokens,
            },
          }
        : {}),
    };
  }
}

function extractOutputText(output: OpenAIResponseShape["output"]): string {
  if (!output) return "";
  return output
    .flatMap((item) => item.content ?? [])
    .filter(
      (content) =>
        content.type === "output_text" && typeof content.text === "string",
    )
    .map((content) => content.text ?? "")
    .join("\n");
}
