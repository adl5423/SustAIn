export { ResourceAwareAI } from "./client.js";
export { ResourceAwareAIError } from "./types.js";
export type {
  Message,
  Role,
  Mode,
  UnitSystem,
  Constraints,
  ChatOptions,
  ChatResponse,
  ResourceMetrics,
  ProviderResponse,
  ProviderAdapter,
  EstimatorFn,
  ResourceAwareAIConfig,
  SDKError,
  ModelProfile,
} from "./types.js";

export { OpenAIProvider } from "./providers/openai.js";
export type { OpenAIProviderConfig } from "./providers/openai.js";

export { AnthropicProvider } from "./providers/anthropic.js";
export type { AnthropicProviderConfig } from "./providers/anthropic.js";

export { GeminiProvider } from "./providers/gemini.js";
export type { GeminiProviderConfig } from "./providers/gemini.js";

export { MistralProvider } from "./providers/mistral.js";
export type { MistralProviderConfig } from "./providers/mistral.js";

export { CohereProvider } from "./providers/cohere.js";
export type { CohereProviderConfig } from "./providers/cohere.js";

export { OllamaProvider } from "./providers/ollama.js";
export type { OllamaProviderConfig } from "./providers/ollama.js";

export { GenericProvider } from "./providers/generic.js";
export type { GenericProviderConfig } from "./providers/generic.js";

export { listModels, getModelProfile } from "./core/models.js";
export { estimateEnergy, estimateTokens, estimateTokensFromMessages } from "./core/estimator.js";
export { calculateWater, computeWaterMetrics } from "./core/calculator.js";
export { generateFootnote, generateInlineFootnote } from "./core/footnote.js";
export { mlToDisplay, getUnit, mlToBottles, makeUnitContext } from "./core/units.js";
export type { UnitContext } from "./core/units.js";
