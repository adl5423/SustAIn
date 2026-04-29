import type { ModelProfile } from "../types.js";

const MODEL_REGISTRY: ModelProfile[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  { id: "gpt-4o", provider: "openai", class: "large", contextWindow: 128000 },
  { id: "gpt-4o-mini", provider: "openai", class: "medium", contextWindow: 128000 },
  { id: "gpt-4-turbo", provider: "openai", class: "large", contextWindow: 128000 },
  { id: "gpt-4-turbo-preview", provider: "openai", class: "large", contextWindow: 128000 },
  { id: "gpt-4", provider: "openai", class: "large", contextWindow: 8192 },
  { id: "gpt-3.5-turbo", provider: "openai", class: "medium", contextWindow: 16385 },
  { id: "o1", provider: "openai", class: "large", contextWindow: 200000 },
  { id: "o1-mini", provider: "openai", class: "medium", contextWindow: 128000 },
  { id: "o1-preview", provider: "openai", class: "large", contextWindow: 128000 },
  { id: "o3", provider: "openai", class: "large", contextWindow: 200000 },
  { id: "o3-mini", provider: "openai", class: "medium", contextWindow: 200000 },
  { id: "o4-mini", provider: "openai", class: "medium", contextWindow: 200000 },

  // ── Anthropic ────────────────────────────────────────────────────────────────
  { id: "claude-opus-4-5", provider: "anthropic", class: "large", contextWindow: 200000 },
  { id: "claude-sonnet-4-5", provider: "anthropic", class: "large", contextWindow: 200000 },
  { id: "claude-3-5-sonnet-20241022", provider: "anthropic", class: "large", contextWindow: 200000 },
  { id: "claude-3-5-haiku-20241022", provider: "anthropic", class: "medium", contextWindow: 200000 },
  { id: "claude-3-opus-20240229", provider: "anthropic", class: "large", contextWindow: 200000 },
  { id: "claude-3-sonnet-20240229", provider: "anthropic", class: "large", contextWindow: 200000 },
  { id: "claude-3-haiku-20240307", provider: "anthropic", class: "medium", contextWindow: 200000 },

  // ── Google Gemini ────────────────────────────────────────────────────────────
  { id: "gemini-2.5-pro", provider: "gemini", class: "large", contextWindow: 1048576 },
  { id: "gemini-2.5-flash", provider: "gemini", class: "medium", contextWindow: 1048576 },
  { id: "gemini-2.0-flash", provider: "gemini", class: "medium", contextWindow: 1048576 },
  { id: "gemini-2.0-flash-lite", provider: "gemini", class: "small", contextWindow: 1048576 },
  { id: "gemini-2.0-pro", provider: "gemini", class: "large", contextWindow: 1048576 },
  { id: "gemini-1.5-pro", provider: "gemini", class: "large", contextWindow: 2097152 },
  { id: "gemini-1.5-flash", provider: "gemini", class: "medium", contextWindow: 1048576 },
  { id: "gemini-1.5-flash-8b", provider: "gemini", class: "small", contextWindow: 1048576 },
  { id: "gemini-ultra", provider: "gemini", class: "large", contextWindow: 32768 },

  // ── Mistral ─────────────────────────────────────────────────────────────────
  { id: "mistral-large-latest", provider: "mistral", class: "large", contextWindow: 128000 },
  { id: "mistral-large-2411", provider: "mistral", class: "large", contextWindow: 128000 },
  { id: "mistral-medium", provider: "mistral", class: "medium", contextWindow: 32768 },
  { id: "mistral-small-latest", provider: "mistral", class: "small", contextWindow: 32768 },
  { id: "mistral-small-2409", provider: "mistral", class: "small", contextWindow: 32768 },
  { id: "mistral-7b-instruct", provider: "mistral", class: "small", parametersBillions: 7, contextWindow: 32768 },
  { id: "mixtral-8x7b-instruct", provider: "mistral", class: "medium", contextWindow: 32768 },
  { id: "mixtral-8x22b-instruct", provider: "mistral", class: "large", contextWindow: 65536 },
  { id: "codestral-latest", provider: "mistral", class: "large", contextWindow: 32768 },
  { id: "pixtral-large-latest", provider: "mistral", class: "large", contextWindow: 128000 },

  // ── Cohere ───────────────────────────────────────────────────────────────────
  { id: "command-r-plus-08-2024", provider: "cohere", class: "large", contextWindow: 128000 },
  { id: "command-r-plus", provider: "cohere", class: "large", contextWindow: 128000 },
  { id: "command-r-08-2024", provider: "cohere", class: "medium", contextWindow: 128000 },
  { id: "command-r", provider: "cohere", class: "medium", contextWindow: 128000 },
  { id: "command", provider: "cohere", class: "medium", contextWindow: 4096 },
  { id: "command-light", provider: "cohere", class: "small", contextWindow: 4096 },
  { id: "command-a-03-2025", provider: "cohere", class: "large", contextWindow: 256000 },

  // ── Ollama (local) ───────────────────────────────────────────────────────────
  { id: "llama3.3", provider: "ollama", class: "large", parametersBillions: 70, contextWindow: 128000 },
  { id: "llama3.2", provider: "ollama", class: "small", parametersBillions: 3, contextWindow: 128000 },
  { id: "llama3.1", provider: "ollama", class: "large", parametersBillions: 70, contextWindow: 128000 },
  { id: "llama3.1:8b", provider: "ollama", class: "small", parametersBillions: 8, contextWindow: 128000 },
  { id: "llama3.1:70b", provider: "ollama", class: "large", parametersBillions: 70, contextWindow: 128000 },
  { id: "llama3.1:405b", provider: "ollama", class: "large", parametersBillions: 405, contextWindow: 128000 },
  { id: "phi4", provider: "ollama", class: "small", parametersBillions: 14, contextWindow: 16384 },
  { id: "phi3.5", provider: "ollama", class: "small", parametersBillions: 3.8, contextWindow: 128000 },
  { id: "gemma3", provider: "ollama", class: "medium", parametersBillions: 27, contextWindow: 8192 },
  { id: "gemma3:2b", provider: "ollama", class: "small", parametersBillions: 2, contextWindow: 8192 },
  { id: "qwen2.5", provider: "ollama", class: "medium", parametersBillions: 32, contextWindow: 32768 },
  { id: "qwen2.5:72b", provider: "ollama", class: "large", parametersBillions: 72, contextWindow: 32768 },
  { id: "deepseek-r1", provider: "ollama", class: "large", parametersBillions: 70, contextWindow: 65536 },
  { id: "mistral", provider: "ollama", class: "small", parametersBillions: 7, contextWindow: 32768 },
];

const MODEL_MAP = new Map<string, ModelProfile>(MODEL_REGISTRY.map((m) => [m.id, m]));

export function getModelProfile(modelId: string): ModelProfile | undefined {
  return MODEL_MAP.get(modelId) ?? inferModelProfile(modelId);
}

function inferModelProfile(modelId: string): ModelProfile | undefined {
  const id = modelId.toLowerCase();

  let modelClass: "small" | "medium" | "large" = "medium";

  if (
    id.includes("405b") ||
    id.includes("gpt-4") ||
    id.includes("opus") ||
    id.includes("ultra") ||
    id.includes("large") ||
    id.includes("70b") ||
    id.includes("72b") ||
    id.includes("command-r-plus") ||
    id.includes("o1") ||
    id.includes("o3") ||
    id.includes("mixtral-8x22b") ||
    id.includes("2.5-pro")
  ) {
    modelClass = "large";
  } else if (
    id.includes("7b") ||
    id.includes("8b") ||
    id.includes("3b") ||
    id.includes("2b") ||
    id.includes("mini") ||
    id.includes("small") ||
    id.includes("haiku") ||
    id.includes("flash-8b") ||
    id.includes("lite") ||
    id.includes("light") ||
    id.includes("phi")
  ) {
    modelClass = "small";
  }

  return { id: modelId, provider: "unknown", class: modelClass };
}

export function listModels(provider?: string): ModelProfile[] {
  if (provider) return MODEL_REGISTRY.filter((m) => m.provider === provider);
  return [...MODEL_REGISTRY];
}
