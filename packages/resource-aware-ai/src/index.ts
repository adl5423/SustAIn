export { SustainAI } from "./client.js";
export { SustainAIError } from "./types.js";
export type {
  Message,
  Role,
  Mode,
  UnitSystem,
  Constraints,
  ChatOptions,
  RoutedChatOptions,
  ChatResponse,
  ResourceMetrics,
  ProviderResponse,
  ProviderAdapter,
  EstimatorFn,
  EmbedderFn,
  SustainAIConfig,
  SDKError,
  ModelProfile,
  SessionSummary,
  CacheSavingsTotals,
  TokenUsage,
  TokenSource,
  WaterScope,
  WaterAccountingConfig,
  EstimationDetails,
  EstimateConfidence,
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

export { DeepSeekProvider } from "./providers/deepseek.js";
export type { DeepSeekProviderConfig } from "./providers/deepseek.js";

export { GenericProvider } from "./providers/generic.js";
export type { GenericProviderConfig } from "./providers/generic.js";

export { UniversalProvider } from "./providers/universal.js";
export type {
  UniversalProviderConfig,
  UniversalProtocol,
} from "./providers/universal.js";
export { ProviderHttpError, validateEndpoint } from "./providers/http.js";
export type { EndpointPolicy } from "./providers/http.js";

export { listModels, getModelProfile } from "./core/models.js";
export {
  estimateEnergy,
  estimateEnergyDetailed,
  estimateTokens,
  estimateTokensFromMessages,
  getEnergyFactor,
  getEnergyMultiplier,
  MODEL_ENERGY_FACTORS,
  MODEL_ENERGY_MULTIPLIERS,
  REFERENCE_QUERY_ENERGY_WH,
  REFERENCE_INPUT_TOKENS,
  REFERENCE_OUTPUT_TOKENS,
} from "./core/estimator.js";
export type { EnergyEstimate } from "./core/estimator.js";
export {
  calculateWater,
  calculateBaseline,
  calculateSavings,
  calculateDeltaPercent,
  computeWaterMetrics,
  computeOperationalWater,
  resolveWaterAccounting,
  DEFAULT_WATER_ACCOUNTING,
} from "./core/calculator.js";
export type { WaterResult, OperationalWaterResult } from "./core/calculator.js";
export { compareModels } from "./core/comparison.js";
export type {
  CompareModelsOptions,
  ModelComparisonRow,
  ModelComparisonWorkload,
} from "./core/comparison.js";
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
export {
  mlToDisplay,
  getUnit,
  mlToBottles,
  makeUnitContext,
} from "./core/units.js";
export type { UnitContext } from "./core/units.js";

// ── Semantic cache ──────────────────────────────────────────────────────────
export {
  SemanticCache,
  cosineSimilarity,
  canonicalizeMessages,
} from "./core/semantic-cache.js";
export type { SemanticCacheHit } from "./core/semantic-cache.js";

// ── Router ──────────────────────────────────────────────────────────────────
export {
  defaultConfidenceFn,
  DEFAULT_CONFIDENCE_THRESHOLD,
  LOW_CONFIDENCE_PATTERNS,
  REFUSAL_PATTERNS,
  LOW_CONFIDENCE_PENALTY,
  REFUSAL_PENALTY,
  SHORT_RESPONSE_PENALTY,
  QUESTION_BACK_PENALTY,
  SHORT_RESPONSE_THRESHOLD,
  QUESTION_BACK_LENGTH_LIMIT,
} from "./core/router.js";
export type {
  RouterTier,
  RouterOptions,
  RouterMetrics,
  RouterSessionTotals,
  RouterDecisionContext,
  ConfidenceFn,
} from "./core/router.js";
