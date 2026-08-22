import type { ModelProfile } from "../types.js";

const VERIFIED_AS_OF = "2026-08-21";

const OPENAI_MODELS = "https://developers.openai.com/api/docs/models";
const ANTHROPIC_MODELS =
  "https://platform.claude.com/docs/en/about-claude/models/overview";
const GEMINI_MODELS = "https://ai.google.dev/gemini-api/docs/models";
const MISTRAL_MODELS = "https://docs.mistral.ai/models";
const COHERE_MODELS = "https://docs.cohere.com/docs/models";
const DEEPSEEK_MODELS = "https://api-docs.deepseek.com/updates/";
const GPT_OSS = "https://openai.com/index/introducing-gpt-oss/";
const LLAMA_4 = "https://ai.meta.com/blog/llama-4-multimodal-intelligence/";
const QWEN_3 = "https://qwenlm.github.io/blog/qwen3/";

function current(
  profile: Omit<ModelProfile, "verifiedAsOf" | "status">,
): ModelProfile {
  return { ...profile, status: "current", verifiedAsOf: VERIFIED_AS_OF };
}

function preview(
  profile: Omit<ModelProfile, "verifiedAsOf" | "status">,
): ModelProfile {
  return { ...profile, status: "preview", verifiedAsOf: VERIFIED_AS_OF };
}

function legacy(
  profile: Omit<ModelProfile, "verifiedAsOf" | "status">,
): ModelProfile {
  return { ...profile, status: "legacy", verifiedAsOf: VERIFIED_AS_OF };
}

const MODEL_REGISTRY: ModelProfile[] = [
  current({
    id: "gpt-5.6",
    provider: "openai",
    class: "large",
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: OPENAI_MODELS,
  }),
  current({
    id: "gpt-5.6-sol",
    provider: "openai",
    class: "large",
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: OPENAI_MODELS,
  }),
  current({
    id: "gpt-5.6-terra",
    provider: "openai",
    class: "medium",
    contextWindow: 1_050_000,
    maxOutputTokens: 128_000,
    energyMultiplier: 1,
    deployment: "hosted",
    sourceUrl: OPENAI_MODELS,
  }),
  current({
    id: "gpt-5.6-luna",
    provider: "openai",
    class: "small",
    contextWindow: 400_000,
    maxOutputTokens: 128_000,
    energyMultiplier: 0.65,
    deployment: "hosted",
    sourceUrl: OPENAI_MODELS,
  }),
  legacy({
    id: "gpt-5.4",
    provider: "openai",
    class: "large",
    contextWindow: 1_050_000,
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: OPENAI_MODELS,
  }),
  legacy({
    id: "gpt-4o",
    provider: "openai",
    class: "large",
    contextWindow: 128_000,
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: OPENAI_MODELS,
  }),
  legacy({
    id: "gpt-4o-mini",
    provider: "openai",
    class: "medium",
    contextWindow: 128_000,
    energyMultiplier: 1,
    deployment: "hosted",
    sourceUrl: OPENAI_MODELS,
  }),

  current({
    id: "claude-opus-5",
    provider: "anthropic",
    class: "large",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: ANTHROPIC_MODELS,
  }),
  current({
    id: "claude-sonnet-5",
    provider: "anthropic",
    class: "medium",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    energyMultiplier: 1,
    deployment: "hosted",
    sourceUrl: ANTHROPIC_MODELS,
  }),
  current({
    id: "claude-fable-5",
    provider: "anthropic",
    class: "medium",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    energyMultiplier: 0.8,
    deployment: "hosted",
    sourceUrl: ANTHROPIC_MODELS,
  }),
  current({
    id: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    class: "small",
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    energyMultiplier: 0.65,
    deployment: "hosted",
    sourceUrl: ANTHROPIC_MODELS,
  }),
  legacy({
    id: "claude-3-5-sonnet-20241022",
    provider: "anthropic",
    class: "large",
    contextWindow: 200_000,
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: ANTHROPIC_MODELS,
  }),

  current({
    id: "gemini-3.7-flash",
    provider: "gemini",
    class: "medium",
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    energyMultiplier: 0.8,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  current({
    id: "gemini-3.6-flash",
    provider: "gemini",
    class: "medium",
    contextWindow: 1_000_000,
    energyMultiplier: 0.8,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  current({
    id: "gemini-3.5-flash",
    provider: "gemini",
    class: "medium",
    contextWindow: 1_000_000,
    energyMultiplier: 0.8,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  current({
    id: "gemini-3.5-flash-lite",
    provider: "gemini",
    class: "small",
    contextWindow: 1_000_000,
    energyMultiplier: 0.6,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  current({
    id: "gemini-3.1-flash-lite",
    provider: "gemini",
    class: "small",
    contextWindow: 1_000_000,
    energyMultiplier: 0.6,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  preview({
    id: "gemini-3.1-pro-preview",
    provider: "gemini",
    class: "large",
    contextWindow: 1_000_000,
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  preview({
    id: "gemini-3-flash-preview",
    provider: "gemini",
    class: "medium",
    contextWindow: 1_000_000,
    energyMultiplier: 0.8,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  legacy({
    id: "gemini-2.5-pro",
    provider: "gemini",
    class: "large",
    contextWindow: 1_048_576,
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  legacy({
    id: "gemini-2.5-flash",
    provider: "gemini",
    class: "medium",
    contextWindow: 1_048_576,
    energyMultiplier: 0.8,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  legacy({
    id: "gemini-2.0-flash",
    provider: "gemini",
    class: "medium",
    contextWindow: 1_048_576,
    energyMultiplier: 0.8,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),
  legacy({
    id: "gemini-2.0-flash-lite",
    provider: "gemini",
    class: "small",
    contextWindow: 1_048_576,
    energyMultiplier: 0.6,
    deployment: "hosted",
    sourceUrl: GEMINI_MODELS,
  }),

  current({
    id: "mistral-medium-3-5",
    provider: "mistral",
    class: "medium",
    energyMultiplier: 1,
    deployment: "hosted",
    sourceUrl: MISTRAL_MODELS,
  }),
  current({
    id: "mistral-medium-latest",
    provider: "mistral",
    class: "medium",
    energyMultiplier: 1,
    deployment: "hosted",
    sourceUrl: MISTRAL_MODELS,
  }),
  current({
    id: "mistral-small-2603",
    provider: "mistral",
    class: "small",
    energyMultiplier: 0.7,
    deployment: "hosted",
    sourceUrl: MISTRAL_MODELS,
  }),
  current({
    id: "mistral-small-latest",
    provider: "mistral",
    class: "small",
    energyMultiplier: 0.7,
    deployment: "hosted",
    sourceUrl: MISTRAL_MODELS,
  }),
  current({
    id: "mistral-large-2512",
    provider: "mistral",
    class: "large",
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: MISTRAL_MODELS,
  }),
  current({
    id: "mistral-large-latest",
    provider: "mistral",
    class: "large",
    energyMultiplier: 1.75,
    deployment: "hosted",
    sourceUrl: MISTRAL_MODELS,
  }),
  current({
    id: "ministral-3-14b",
    provider: "mistral",
    class: "medium",
    parametersBillions: 14,
    energyMultiplier: 0.85,
    deployment: "open-weight",
    sourceUrl: MISTRAL_MODELS,
  }),
  current({
    id: "ministral-3-8b",
    provider: "mistral",
    class: "small",
    parametersBillions: 8,
    energyMultiplier: 0.65,
    deployment: "open-weight",
    sourceUrl: MISTRAL_MODELS,
  }),
  current({
    id: "ministral-3-3b",
    provider: "mistral",
    class: "small",
    parametersBillions: 3,
    energyMultiplier: 0.5,
    deployment: "open-weight",
    sourceUrl: MISTRAL_MODELS,
  }),

  current({
    id: "command-a-plus-05-2026",
    provider: "cohere",
    class: "large",
    parametersBillions: 218,
    activeParametersBillions: 25,
    contextWindow: 128_000,
    maxOutputTokens: 64_000,
    energyMultiplier: 1.5,
    deployment: "open-weight",
    sourceUrl: COHERE_MODELS,
  }),
  current({
    id: "command-a-03-2025",
    provider: "cohere",
    class: "medium",
    parametersBillions: 111,
    contextWindow: 256_000,
    maxOutputTokens: 32_000,
    energyMultiplier: 1,
    deployment: "open-weight",
    sourceUrl: COHERE_MODELS,
  }),
  current({
    id: "command-r7b-12-2024",
    provider: "cohere",
    class: "small",
    parametersBillions: 7,
    contextWindow: 128_000,
    energyMultiplier: 0.65,
    deployment: "open-weight",
    sourceUrl: COHERE_MODELS,
  }),
  legacy({
    id: "command-r-plus",
    provider: "cohere",
    class: "large",
    contextWindow: 128_000,
    energyMultiplier: 1.5,
    deployment: "hosted",
    sourceUrl: COHERE_MODELS,
  }),

  current({
    id: "deepseek-v4-pro",
    provider: "deepseek",
    class: "large",
    energyMultiplier: 2,
    deployment: "hosted",
    sourceUrl: DEEPSEEK_MODELS,
  }),
  current({
    id: "deepseek-v4-flash",
    provider: "deepseek",
    class: "medium",
    energyMultiplier: 0.85,
    deployment: "hosted",
    sourceUrl: DEEPSEEK_MODELS,
  }),

  current({
    id: "gpt-oss-120b",
    provider: "universal",
    class: "medium",
    parametersBillions: 117,
    activeParametersBillions: 5.1,
    contextWindow: 128_000,
    energyMultiplier: 0.8,
    deployment: "open-weight",
    sourceUrl: GPT_OSS,
  }),
  current({
    id: "gpt-oss-20b",
    provider: "universal",
    class: "small",
    parametersBillions: 21,
    activeParametersBillions: 3.6,
    contextWindow: 128_000,
    energyMultiplier: 0.6,
    deployment: "open-weight",
    sourceUrl: GPT_OSS,
  }),
  current({
    id: "llama4:scout",
    provider: "ollama",
    class: "medium",
    parametersBillions: 109,
    activeParametersBillions: 17,
    contextWindow: 10_000_000,
    energyMultiplier: 0.9,
    deployment: "open-weight",
    sourceUrl: LLAMA_4,
  }),
  current({
    id: "llama4:maverick",
    provider: "ollama",
    class: "large",
    parametersBillions: 400,
    activeParametersBillions: 17,
    energyMultiplier: 1.1,
    deployment: "open-weight",
    sourceUrl: LLAMA_4,
  }),
  current({
    id: "qwen3:0.6b",
    provider: "ollama",
    class: "small",
    parametersBillions: 0.6,
    energyMultiplier: 0.35,
    deployment: "open-weight",
    sourceUrl: QWEN_3,
  }),
  current({
    id: "qwen3:4b",
    provider: "ollama",
    class: "small",
    parametersBillions: 4,
    energyMultiplier: 0.5,
    deployment: "open-weight",
    sourceUrl: QWEN_3,
  }),
  current({
    id: "qwen3:8b",
    provider: "ollama",
    class: "small",
    parametersBillions: 8,
    energyMultiplier: 0.65,
    deployment: "open-weight",
    sourceUrl: QWEN_3,
  }),
  current({
    id: "qwen3:32b",
    provider: "ollama",
    class: "medium",
    parametersBillions: 32,
    energyMultiplier: 1,
    deployment: "open-weight",
    sourceUrl: QWEN_3,
  }),
  current({
    id: "qwen3:30b-a3b",
    provider: "ollama",
    class: "small",
    parametersBillions: 30,
    activeParametersBillions: 3,
    energyMultiplier: 0.6,
    deployment: "open-weight",
    sourceUrl: QWEN_3,
  }),
  current({
    id: "qwen3:235b-a22b",
    provider: "ollama",
    class: "large",
    parametersBillions: 235,
    activeParametersBillions: 22,
    energyMultiplier: 1.2,
    deployment: "open-weight",
    sourceUrl: QWEN_3,
  }),

  legacy({
    id: "llama3.3:70b",
    provider: "ollama",
    class: "large",
    parametersBillions: 70,
    contextWindow: 128_000,
    energyMultiplier: 1.3,
    deployment: "open-weight",
    sourceUrl: LLAMA_4,
  }),
  legacy({
    id: "llama3.1:70b",
    provider: "ollama",
    class: "large",
    parametersBillions: 70,
    contextWindow: 128_000,
    energyMultiplier: 1.3,
    deployment: "open-weight",
    sourceUrl: LLAMA_4,
  }),
  legacy({
    id: "deepseek-r1",
    provider: "ollama",
    class: "large",
    parametersBillions: 671,
    activeParametersBillions: 37,
    energyMultiplier: 4,
    deployment: "open-weight",
    sourceUrl: DEEPSEEK_MODELS,
  }),
  legacy({
    id: "phi4",
    provider: "ollama",
    class: "small",
    parametersBillions: 14,
    contextWindow: 16_384,
    energyMultiplier: 0.75,
    deployment: "open-weight",
    sourceUrl: MISTRAL_MODELS,
  }),
];

const MODEL_MAP = new Map(
  MODEL_REGISTRY.map((model) => [model.id.toLowerCase(), model]),
);

export function getModelProfile(modelId: string): ModelProfile {
  return MODEL_MAP.get(modelId.toLowerCase()) ?? inferModelProfile(modelId);
}

function inferModelProfile(modelId: string): ModelProfile {
  const id = modelId.toLowerCase();
  let modelClass: ModelProfile["class"] = "medium";

  if (
    /\b(?:120b|235b|400b|405b|671b|70b|72b)\b/.test(id) ||
    /(?:opus|large|pro|reasoner|r1)/.test(id)
  ) {
    modelClass = "large";
  } else if (
    /\b(?:0\.6b|1\.7b|2b|3b|4b|7b|8b)\b/.test(id) ||
    /(?:mini|small|haiku|flash-lite|lite|luna)/.test(id)
  ) {
    modelClass = "small";
  }

  return {
    id: modelId,
    provider: "unknown",
    class: modelClass,
    energyMultiplier:
      modelClass === "small" ? 0.65 : modelClass === "large" ? 1.75 : 1,
    status: "current",
    verifiedAsOf: VERIFIED_AS_OF,
  };
}

export function listModels(provider?: string): ModelProfile[] {
  const models = provider
    ? MODEL_REGISTRY.filter((model) => model.provider === provider)
    : MODEL_REGISTRY;
  return models.map((model) => ({ ...model }));
}
