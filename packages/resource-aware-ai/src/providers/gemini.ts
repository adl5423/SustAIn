import type { Message, ProviderResponse } from "../types.js";
import { BaseProvider } from "./base.js";

export interface GeminiProviderConfig {
  apiKey?: string;
}

export class GeminiProvider extends BaseProvider {
  private config: GeminiProviderConfig;

  constructor(config: GeminiProviderConfig = {}) {
    super();
    this.config = config;
  }

  async generate({ model, messages }: { model: string; messages: Message[] }): Promise<ProviderResponse> {
    const apiKey = this.config.apiKey ?? process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
    if (!apiKey) throw new Error("Gemini API key required. Set GEMINI_API_KEY or pass apiKey in config.");

    let GoogleGenerativeAI: typeof import("@google/generative-ai").GoogleGenerativeAI;
    try {
      ({ GoogleGenerativeAI } = await import("@google/generative-ai"));
    } catch {
      throw new Error('Google Generative AI SDK not installed. Run: npm install @google/generative-ai');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    const systemParts = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const history = messages
      .filter((m) => m.role !== "system")
      .slice(0, -1)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const lastMessage = messages.filter((m) => m.role !== "system").at(-1);
    if (!lastMessage) throw new Error("No user message provided");

    const chat = geminiModel.startChat({
      history,
      systemInstruction: systemParts || undefined,
    });

    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;

    return {
      text: response.text(),
      usage: response.usageMetadata
        ? {
            prompt_tokens: response.usageMetadata.promptTokenCount,
            completion_tokens: response.usageMetadata.candidatesTokenCount,
            total_tokens: response.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }
}
