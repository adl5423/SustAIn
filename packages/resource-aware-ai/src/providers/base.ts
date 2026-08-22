import type { Message, ProviderAdapter, ProviderResponse } from "../types.js";

export abstract class BaseProvider implements ProviderAdapter {
  abstract generate(options: {
    model: string;
    messages: Message[];
  }): Promise<ProviderResponse>;
}
