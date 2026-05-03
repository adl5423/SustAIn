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
  SessionSummary,
  CacheSavingsTotals,
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
export {
  calculateWater,
  calculateBaseline,
  calculateSavings,
  computeWaterMetrics,
} from "./core/calculator.js";
export {
  calculateCarbon,
  calculateBaselineCarbon,
  computeCarbonMetrics,
} from "./core/carbon.js";
export type { CarbonResult } from "./core/carbon.js";
export {
  GRID_INTENSITIES,
  BASELINE_GRID_G_PER_KWH,
  DEFAULT_REGION,
  getGridIntensity,
  getRegionData,
  listRegions,
} from "./core/regions.js";
export type { RegionData } from "./core/regions.js";
export {
  computeEquivalents,
  G_CO2_PER_KM,
  WH_PER_GOOGLE_SEARCH,
  WH_PER_SMARTPHONE_CHARGE,
  W_LED_BULB,
  ML_PER_SHOWER_SECOND,
} from "./core/equivalents.js";
export type { Equivalents } from "./core/equivalents.js";
export { generateFootnote, generateInlineFootnote } from "./core/footnote.js";
export { mlToDisplay, getUnit, mlToBottles, makeUnitContext } from "./core/units.js";
export type { UnitContext } from "./core/units.js";
