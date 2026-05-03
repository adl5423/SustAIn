import type { Equivalents } from "./core/equivalents.js";
import type {
  RouterMetrics,
  RouterOptions,
  RouterSessionTotals,
} from "./core/router.js";

export type Role = "user" | "system" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export type Mode = "performance" | "balanced" | "water_saver";
export type UnitSystem = "metric" | "imperial";

export interface Constraints {
  max_water_ml?: number;
  max_kwh?: number;
  max_co2_g?: number;
}

export interface ChatOptions {
  model: string;
  provider: string;
  messages: Message[];
  mode?: Mode;
  constraints?: Constraints;
}

export interface RoutedChatOptions {
  messages: Message[];
  router: RouterOptions;
  mode?: Mode;
  constraints?: Constraints;
}

export interface CacheSavingsTotals {
  /** Total cache hits (= exact_hits + semantic_hits). */
  requests: number;
  /**
   * Subset of `requests`: hits served by the exact-match cache.
   *
   * Optional for backward compatibility — older consumers that hand-built
   * a `CacheSavingsTotals` literal won't break on upgrade. The SDK always
   * populates this field.
   */
  exact_hits?: number;
  /**
   * Subset of `requests`: hits served by the semantic cache. Optional for
   * the same reason as `exact_hits`; always populated by the SDK.
   */
  semantic_hits?: number;
  energy_wh: number;
  water_ml: number;
  co2_g: number;
}

export interface SessionSummary {
  requests: number;
  cache_hits: number;
  cache_hit_rate: number;
  energy_kwh: number;
  water_ml: number;
  co2_g: number;
  water_saved_ml: number;
  co2_saved_g: number;
  bottles_saved: number;
  cache_savings: CacheSavingsTotals;
  equivalents_used: Equivalents;
  equivalents_saved: Equivalents;
  /** Present once `chatWithRouting()` has been called at least once. */
  router?: RouterSessionTotals;
}

export interface ResourceMetrics {
  // ── Energy ─────────────────────────────────────────────────────────────────
  energy_kwh: number;
  energy_wh: number;

  // ── Water ──────────────────────────────────────────────────────────────────
  water_ml: number;
  baseline_water_ml: number;
  water_saved_ml: number;
  water_saved_percent: number;

  water_display: number;
  baseline_display: number;
  water_saved_display: number;
  unit: string;

  bottles_saved: number;
  bottles_saved_session: number;
  bottle_size_display: number;

  // ── Carbon ─────────────────────────────────────────────────────────────────
  co2_g: number;
  baseline_co2_g: number;
  co2_saved_g: number;
  co2_saved_percent: number;
  co2_saved_session_g: number;
  region: string;
  grid_intensity_g_per_kwh: number;
  baseline_grid_intensity_g_per_kwh: number;

  // ── Human-scale equivalents (this request) ─────────────────────────────────
  equivalents: Equivalents;

  // ── Tokens & cache ─────────────────────────────────────────────────────────
  tokens_estimated: number;
  cache_hit: boolean;
  /**
   * "exact" | "semantic" when cache_hit is true; null otherwise.
   * Optional for backward compatibility with older consumers that built
   * `ResourceMetrics` literals before this field existed.
   */
  cache_hit_type?: "exact" | "semantic" | null;
  /**
   * Cosine similarity for semantic hits (0–1); null otherwise. Optional
   * for the same backward-compat reason as `cache_hit_type`.
   */
  cache_similarity?: number | null;

  // ── Router metadata (only set on chatWithRouting responses) ────────────────
  router?: RouterMetrics;

  // ── Session snapshot (cumulative since last reset) ─────────────────────────
  session: SessionSummary;
}

export interface ChatResponse {
  output: string;
  metrics: ResourceMetrics;
  footnote: string;
}

export interface ProviderResponse {
  text: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ProviderAdapter {
  generate(options: { model: string; messages: Message[] }): Promise<ProviderResponse>;
}

export type EstimatorFn = (tokens: number, model: string) => number;

/**
 * Embedder function: turns a string into a fixed-length numeric vector.
 *
 * The SDK does not ship with a default embedder so it stays dependency-free.
 * Plug in any embedder you like — OpenAI's `text-embedding-3-small`, a local
 * MiniLM via `@xenova/transformers`, or your own.
 */
export type EmbedderFn = (text: string) => number[] | Promise<number[]>;

export interface ResourceAwareAIConfig {
  regionFactor?: number;
  baselineFactor?: number;
  enableCache?: boolean;
  customEstimator?: EstimatorFn;
  unitSystem?: UnitSystem;
  bottleSizeMl?: number;
  region?: string;
  gridIntensityG?: number;
  baselineGridIntensityG?: number;

  // ── Semantic cache ────────────────────────────────────────────────────────
  /**
   * Enable embedding-based fuzzy cache lookups in addition to exact-match
   * caching. Requires `embedder` (or a later call to `setEmbedder`).
   * Default: `false`.
   */
  enableSemanticCache?: boolean;
  /**
   * Embedder used for semantic cache lookups. Required when
   * `enableSemanticCache` is true.
   */
  embedder?: EmbedderFn;
  /**
   * Cosine-similarity cutoff for serving a cached response. Default: `0.95`.
   * Lower values give more cache hits at the cost of looser matches.
   */
  semanticCacheThreshold?: number;
  /** FIFO eviction limit for the semantic cache. Default: `1000`. */
  semanticCacheMaxSize?: number;
}

export interface ResourceLimitError {
  code: "RESOURCE_LIMIT_EXCEEDED";
  details: {
    water_ml?: number;
    water_limit?: number;
    energy_kwh?: number;
    energy_limit?: number;
    co2_g?: number;
    co2_limit?: number;
  };
}

export interface ProviderError {
  code: "PROVIDER_ERROR";
  message: string;
  provider: string;
}

export interface UnknownProviderError {
  code: "UNKNOWN_PROVIDER";
  message: string;
  provider: string;
  availableProviders: string[];
}

export interface ConfigError {
  code: "CONFIG_ERROR";
  message: string;
}

export type SDKError =
  | ResourceLimitError
  | ProviderError
  | UnknownProviderError
  | ConfigError;

export class ResourceAwareAIError extends Error {
  public readonly sdkError: SDKError;

  constructor(sdkError: SDKError) {
    const msg =
      sdkError.code === "RESOURCE_LIMIT_EXCEEDED"
        ? `Resource limit exceeded: ${JSON.stringify(sdkError.details)}`
        : sdkError.code === "UNKNOWN_PROVIDER"
          ? sdkError.message
          : sdkError.message;
    super(msg);
    this.name = "ResourceAwareAIError";
    this.sdkError = sdkError;
  }
}

export interface ModelProfile {
  id: string;
  provider: string;
  class: "small" | "medium" | "large";
  parametersBillions?: number;
  contextWindow?: number;
}
