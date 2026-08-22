import type {
  ChatOptions,
  ChatResponse,
  EstimatorFn,
  EmbedderFn,
  ProviderAdapter,
  SustainAIConfig,
  ResourceMetrics,
  RoutedChatOptions,
  SessionSummary,
  CacheSavingsTotals,
  Constraints,
  TokenSource,
  TokenUsage,
  WaterAccountingConfig,
} from "./types.js";
import { SustainAIError } from "./types.js";
import {
  estimateTokensFromMessages,
  estimateEnergyDetailed,
  REFERENCE_INPUT_TOKENS,
  REFERENCE_OUTPUT_TOKENS,
  REFERENCE_QUERY_ENERGY_WH,
} from "./core/estimator.js";
import type { EnergyEstimate } from "./core/estimator.js";
import {
  calculateDeltaPercent,
  calculateSavings,
  computeOperationalWater,
  resolveWaterAccounting,
} from "./core/calculator.js";
import { calculateCarbon } from "./core/carbon.js";
import { generateFootnote } from "./core/footnote.js";
import { ResponseCache } from "./core/cache.js";
import { SemanticCache, canonicalizeMessages } from "./core/semantic-cache.js";
import { makeUnitContext, mlToDisplay, mlToBottles } from "./core/units.js";
import type { UnitContext } from "./core/units.js";
import { DEFAULT_REGION, getGridIntensity } from "./core/regions.js";
import { computeEquivalents } from "./core/equivalents.js";
import type { Equivalents } from "./core/equivalents.js";
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  defaultConfidenceFn,
} from "./core/router.js";
import type {
  ConfidenceFn,
  RouterMetrics,
  RouterSessionTotals,
} from "./core/router.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GeminiProvider } from "./providers/gemini.js";
import { MistralProvider } from "./providers/mistral.js";
import { CohereProvider } from "./providers/cohere.js";
import { OllamaProvider } from "./providers/ollama.js";
import { DeepSeekProvider } from "./providers/deepseek.js";

const DEFAULT_SEMANTIC_THRESHOLD = 0.95;
const DEFAULT_SEMANTIC_MAX_SIZE = 1000;
const DEFAULT_BASELINE_MODEL = "gpt-5.6-sol";
const DEFAULT_EXPECTED_OUTPUT_TOKENS = 300;
const MAX_MESSAGE_COUNT = 1_000;
const MAX_MESSAGE_CHARACTERS = 10_000_000;
const MAX_EMBEDDING_DIMENSIONS = 65_536;
const PROVIDER_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

type BuiltinProviderName =
  | "openai"
  | "anthropic"
  | "gemini"
  | "mistral"
  | "cohere"
  | "deepseek"
  | "ollama";

const BUILTIN_PROVIDER_FACTORIES: Record<
  BuiltinProviderName,
  () => ProviderAdapter
> = {
  openai: () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
  gemini: () => new GeminiProvider(),
  mistral: () => new MistralProvider(),
  cohere: () => new CohereProvider(),
  deepseek: () => new DeepSeekProvider(),
  ollama: () => new OllamaProvider(),
};

interface RawMetricsInput {
  model: string;
  baseline_model: string;
  energy_kwh: number;
  energy_low_wh: number;
  energy_high_wh: number;
  baseline_energy_kwh: number;
  water_ml: number;
  direct_water_ml: number;
  electricity_water_ml: number;
  water_low_ml: number;
  water_high_ml: number;
  co2_g: number;
  baseline_water_ml: number;
  baseline_co2_g: number;
  tokens_estimated: number;
  token_usage: TokenUsage;
  token_source: TokenSource;
  estimation: EnergyEstimate;
  cache_hit: boolean;
  cache_hit_type?: "exact" | "semantic" | null;
  cache_similarity?: number | null;
}

export class SustainAI {
  private readonly waterAccounting: WaterAccountingConfig;
  private readonly baselineModel: string;
  private readonly baselineEnergyMultiplier?: number;
  private readonly legacyRegionFactor?: number;
  private readonly legacyBaselineFactor?: number;
  private readonly cache: ResponseCache | null;
  private customEstimator?: EstimatorFn;
  private readonly providers: Map<string, ProviderAdapter>;
  private readonly unitCtx: UnitContext;

  private readonly region: string;
  private readonly gridIntensityG: number;
  private readonly baselineGridIntensityG: number;

  // ── Semantic cache ────────────────────────────────────────────────────────
  private readonly semanticCache: SemanticCache | null;
  private readonly semanticCacheThreshold: number;
  private embedder?: EmbedderFn;

  // ── Session state (full precision; rounding occurs at display) ─────────────
  private sessionRequests = 0;
  private sessionCacheHits = 0;
  private sessionEnergyKwh = 0;
  private sessionWaterMl = 0;
  private sessionCo2G = 0;
  private sessionWaterSavedMl = 0;
  private sessionCo2SavedG = 0;
  private sessionBottlesSaved = 0;
  private readonly cacheSavings: CacheSavingsTotals = {
    requests: 0,
    exact_hits: 0,
    semantic_hits: 0,
    energy_wh: 0,
    water_ml: 0,
    co2_g: 0,
  };
  private routerSession: RouterSessionTotals | null = null;
  private readonly providerCounts: Record<string, number> = Object.create(
    null,
  ) as Record<string, number>;

  constructor(config: SustainAIConfig = {}) {
    this.waterAccounting = resolveWaterAccounting(config.waterAccounting);
    this.baselineModel = config.baselineModel ?? DEFAULT_BASELINE_MODEL;
    assertNonEmptyIdentifier(this.baselineModel, "baselineModel");
    this.baselineEnergyMultiplier = config.baselineEnergyMultiplier;
    this.legacyRegionFactor = config.regionFactor;
    this.legacyBaselineFactor = config.baselineFactor;
    if (this.legacyRegionFactor !== undefined) {
      assertNonNegativeFinite(this.legacyRegionFactor, "regionFactor");
    }
    if (this.legacyBaselineFactor !== undefined) {
      assertNonNegativeFinite(this.legacyBaselineFactor, "baselineFactor");
    }
    if (
      this.baselineEnergyMultiplier !== undefined &&
      (!Number.isFinite(this.baselineEnergyMultiplier) ||
        this.baselineEnergyMultiplier <= 0)
    ) {
      throw new TypeError(
        "baselineEnergyMultiplier must be a finite number greater than zero.",
      );
    }
    this.cache = config.enableCache !== false ? new ResponseCache() : null;
    if (
      config.customEstimator !== undefined &&
      typeof config.customEstimator !== "function"
    ) {
      throw new TypeError("customEstimator must be a function.");
    }
    this.customEstimator = config.customEstimator;
    this.providers = new Map();
    this.unitCtx = makeUnitContext(
      config.unitSystem ?? "metric",
      config.bottleSizeMl,
    );

    this.region = config.region ?? DEFAULT_REGION;
    assertNonEmptyIdentifier(this.region, "region");
    this.gridIntensityG =
      config.gridIntensityG ?? getGridIntensity(this.region);
    this.baselineGridIntensityG =
      config.baselineGridIntensityG ?? this.gridIntensityG;
    assertNonNegativeFinite(this.gridIntensityG, "gridIntensityG");
    assertNonNegativeFinite(
      this.baselineGridIntensityG,
      "baselineGridIntensityG",
    );

    this.semanticCacheThreshold =
      config.semanticCacheThreshold ?? DEFAULT_SEMANTIC_THRESHOLD;
    if (
      !Number.isFinite(this.semanticCacheThreshold) ||
      this.semanticCacheThreshold < 0 ||
      this.semanticCacheThreshold > 1
    ) {
      throw new TypeError(
        "semanticCacheThreshold must be a finite number from 0 to 1.",
      );
    }
    if (
      config.embedder !== undefined &&
      typeof config.embedder !== "function"
    ) {
      throw new TypeError("embedder must be a function.");
    }
    this.embedder = config.embedder;
    this.semanticCache = config.enableSemanticCache
      ? new SemanticCache(
          config.semanticCacheMaxSize ?? DEFAULT_SEMANTIC_MAX_SIZE,
        )
      : null;
  }

  registerProvider(name: string, adapter: ProviderAdapter): this {
    if (!PROVIDER_NAME_PATTERN.test(name)) {
      throw new TypeError(
        "Provider name must start with a letter or number and contain at most 64 letters, numbers, dots, underscores, or hyphens.",
      );
    }
    if (!adapter || typeof adapter.generate !== "function") {
      throw new TypeError("Provider adapter must define generate().");
    }
    this.providers.set(name.toLowerCase(), adapter);
    return this;
  }

  setEstimator(fn: EstimatorFn): this {
    if (typeof fn !== "function")
      throw new TypeError("Estimator must be a function.");
    this.customEstimator = fn;
    return this;
  }

  setEmbedder(fn: EmbedderFn): this {
    if (typeof fn !== "function")
      throw new TypeError("Embedder must be a function.");
    this.embedder = fn;
    return this;
  }

  private resolveProvider(providerName: string): ProviderAdapter {
    const key = providerName.toLowerCase();
    if (this.providers.has(key)) return this.providers.get(key)!;
    const factory = BUILTIN_PROVIDER_FACTORIES[key as BuiltinProviderName];
    if (factory) return factory();

    throw new SustainAIError({
      code: "UNKNOWN_PROVIDER",
      message: `Unknown provider "${providerName}". Available built-in providers: ${Object.keys(BUILTIN_PROVIDER_FACTORIES).join(", ")}. Use registerProvider() to add a custom one.`,
      provider: providerName,
      availableProviders: [
        ...Object.keys(BUILTIN_PROVIDER_FACTORIES),
        ...Array.from(this.providers.keys()),
      ],
    });
  }

  private buildSessionSummary(): SessionSummary {
    const cache_hit_rate =
      this.sessionRequests > 0
        ? (this.sessionCacheHits / this.sessionRequests) * 100
        : 0;

    const equivalents_used: Equivalents = computeEquivalents({
      energy_wh: this.sessionEnergyKwh * 1000,
      water_ml: this.sessionWaterMl,
      co2_g: this.sessionCo2G,
    });
    const equivalents_saved: Equivalents = computeEquivalents({
      energy_wh: this.cacheSavings.energy_wh,
      water_ml: this.sessionWaterSavedMl,
      co2_g: this.sessionCo2SavedG,
    });

    const summary: SessionSummary = {
      requests: this.sessionRequests,
      cache_hits: this.sessionCacheHits,
      cache_hit_rate,
      energy_kwh: this.sessionEnergyKwh,
      water_ml: this.sessionWaterMl,
      co2_g: this.sessionCo2G,
      water_saved_ml: this.sessionWaterSavedMl,
      co2_saved_g: this.sessionCo2SavedG,
      bottles_saved: this.sessionBottlesSaved,
      cache_savings: { ...this.cacheSavings },
      equivalents_used,
      equivalents_saved,
    };
    if (this.routerSession) {
      summary.router = {
        ...this.routerSession,
        tier_usage: [...this.routerSession.tier_usage],
      };
    }
    return summary;
  }

  private buildMetrics(raw: RawMetricsInput): ResourceMetrics {
    const {
      model,
      baseline_model,
      energy_kwh,
      energy_low_wh,
      energy_high_wh,
      baseline_energy_kwh,
      water_ml,
      direct_water_ml,
      electricity_water_ml,
      water_low_ml,
      water_high_ml,
      co2_g,
      baseline_water_ml,
      baseline_co2_g,
      tokens_estimated,
      token_usage,
      token_source,
      estimation,
      cache_hit,
      cache_hit_type = cache_hit ? "exact" : null,
      cache_similarity = null,
    } = raw;

    const { system, unit, bottleSizeMl, bottleSizeDisplay } = this.unitCtx;

    const water_delta_ml = baseline_water_ml - water_ml;
    const water_delta_percent = calculateDeltaPercent(
      water_ml,
      baseline_water_ml,
    );
    const water_saved_ml = Math.max(0, water_delta_ml);
    const water_saved_percent = calculateSavings(water_ml, baseline_water_ml);
    const co2_saved_g = Math.max(0, baseline_co2_g - co2_g);
    const co2_saved_percent = calculateSavings(co2_g, baseline_co2_g);
    const bottles_saved = mlToBottles(water_saved_ml, bottleSizeMl);

    this.sessionRequests++;
    if (cache_hit) this.sessionCacheHits++;
    this.sessionEnergyKwh += energy_kwh;
    this.sessionWaterMl += water_ml;
    this.sessionCo2G += co2_g;
    this.sessionWaterSavedMl += water_saved_ml;
    this.sessionCo2SavedG += co2_saved_g;
    this.sessionBottlesSaved += bottles_saved;

    const equivalents = computeEquivalents({
      energy_wh: energy_kwh * 1000,
      water_ml,
      co2_g,
    });

    return {
      model,
      energy_kwh,
      energy_wh: energy_kwh * 1000,
      energy_low_wh,
      energy_high_wh,
      baseline_energy_kwh,
      baseline_model,

      water_ml,
      direct_water_ml,
      electricity_water_ml,
      water_low_ml,
      water_high_ml,
      water_scope: this.waterAccounting.scope,
      pue: this.waterAccounting.pue,
      site_wue_l_per_kwh_it: this.waterAccounting.siteWueLitersPerKwhIt,
      electricity_water_l_per_kwh:
        this.waterAccounting.electricityWaterLitersPerKwh,
      baseline_water_ml,
      water_saved_ml,
      water_saved_percent,
      water_delta_ml,
      water_delta_percent,
      water_display: mlToDisplay(water_ml, system),
      baseline_display: mlToDisplay(baseline_water_ml, system),
      water_saved_display: mlToDisplay(water_saved_ml, system),
      unit,
      bottles_saved,
      bottles_saved_session: this.sessionBottlesSaved,
      bottle_size_display: bottleSizeDisplay,

      co2_g,
      baseline_co2_g,
      co2_saved_g,
      co2_saved_percent,
      co2_saved_session_g: this.sessionCo2SavedG,
      region: this.region,
      grid_intensity_g_per_kwh: this.gridIntensityG,
      baseline_grid_intensity_g_per_kwh: this.baselineGridIntensityG,

      equivalents,

      tokens_estimated,
      token_usage,
      token_source,
      estimation: {
        confidence: estimation.confidence,
        method: cache_hit ? "cache" : estimation.method,
        basis:
          "Microsoft 2026 production median normalized by token mix; model multipliers are disclosed heuristics, not provider measurements.",
        model_class: estimation.model_class,
        model_energy_multiplier: estimation.model_energy_multiplier,
        reference_query_wh: REFERENCE_QUERY_ENERGY_WH,
        reference_input_tokens: REFERENCE_INPUT_TOKENS,
        reference_output_tokens: REFERENCE_OUTPUT_TOKENS,
      },
      cache_hit,
      cache_hit_type,
      cache_similarity,

      session: this.buildSessionSummary(),
    };
  }

  private createRawMetrics(
    model: string,
    usage: TokenUsage,
    tokenSource: TokenSource,
    baselineModel = this.baselineModel,
  ): RawMetricsInput {
    const estimation = estimateEnergyDetailed(usage, model, {
      ...(this.customEstimator
        ? { customEstimator: this.customEstimator }
        : {}),
      tokenSource,
    });
    const baselineEstimate = estimateEnergyDetailed(usage, baselineModel, {
      ...(this.customEstimator
        ? { customEstimator: this.customEstimator }
        : {}),
      tokenSource,
    });
    const baselineScale =
      this.baselineEnergyMultiplier === undefined
        ? 1
        : this.baselineEnergyMultiplier /
          baselineEstimate.model_energy_multiplier;
    const baselineEnergyKwh = baselineEstimate.energy_kwh * baselineScale;

    let waterMl: number;
    let directWaterMl: number;
    let electricityWaterMl: number;
    let waterLowMl: number;
    let waterHighMl: number;
    let baselineWaterMl: number;

    if (this.legacyRegionFactor !== undefined) {
      waterMl = estimation.energy_kwh * this.legacyRegionFactor;
      directWaterMl = waterMl;
      electricityWaterMl = 0;
      waterLowMl = (estimation.low_wh / 1000) * this.legacyRegionFactor;
      waterHighMl = (estimation.high_wh / 1000) * this.legacyRegionFactor;
      baselineWaterMl =
        this.legacyBaselineFactor !== undefined
          ? estimation.energy_kwh * this.legacyBaselineFactor
          : baselineEnergyKwh * this.legacyRegionFactor;
    } else {
      const water = computeOperationalWater(
        estimation.energy_kwh,
        this.waterAccounting,
      );
      const lowWater = computeOperationalWater(
        estimation.low_wh / 1000,
        this.waterAccounting,
      );
      const highWater = computeOperationalWater(
        estimation.high_wh / 1000,
        this.waterAccounting,
      );
      const baselineWater = computeOperationalWater(
        baselineEnergyKwh,
        this.waterAccounting,
      );
      waterMl = water.water_ml;
      directWaterMl = water.direct_water_ml;
      electricityWaterMl = water.electricity_water_ml;
      waterLowMl = lowWater.water_ml;
      waterHighMl = highWater.water_ml;
      baselineWaterMl = baselineWater.water_ml;
    }

    return {
      model,
      baseline_model: baselineModel,
      energy_kwh: estimation.energy_kwh,
      energy_low_wh: estimation.low_wh,
      energy_high_wh: estimation.high_wh,
      baseline_energy_kwh: baselineEnergyKwh,
      water_ml: waterMl,
      direct_water_ml: directWaterMl,
      electricity_water_ml: electricityWaterMl,
      water_low_ml: waterLowMl,
      water_high_ml: waterHighMl,
      co2_g: calculateCarbon(estimation.energy_kwh, this.gridIntensityG),
      baseline_water_ml: baselineWaterMl,
      baseline_co2_g: calculateCarbon(
        baselineEnergyKwh,
        this.baselineGridIntensityG,
      ),
      tokens_estimated: estimation.usage.total_tokens,
      token_usage: { ...estimation.usage },
      token_source: tokenSource,
      estimation,
      cache_hit: false,
    };
  }

  private enforceConstraints(
    raw: RawMetricsInput,
    constraints?: Constraints,
  ): void {
    if (!constraints) return;
    if (
      constraints.max_water_ml !== undefined &&
      raw.water_ml > constraints.max_water_ml
    ) {
      throw new SustainAIError({
        code: "RESOURCE_LIMIT_EXCEEDED",
        details: {
          water_ml: raw.water_ml,
          water_limit: constraints.max_water_ml,
        },
      });
    }
    if (
      constraints.max_kwh !== undefined &&
      raw.energy_kwh > constraints.max_kwh
    ) {
      throw new SustainAIError({
        code: "RESOURCE_LIMIT_EXCEEDED",
        details: {
          energy_kwh: raw.energy_kwh,
          energy_limit: constraints.max_kwh,
        },
      });
    }
    if (
      constraints.max_co2_g !== undefined &&
      raw.co2_g > constraints.max_co2_g
    ) {
      throw new SustainAIError({
        code: "RESOURCE_LIMIT_EXCEEDED",
        details: { co2_g: raw.co2_g, co2_limit: constraints.max_co2_g },
      });
    }
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const {
      model,
      provider: providerName,
      messages,
      mode = "balanced",
      constraints,
      expectedOutputTokens = DEFAULT_EXPECTED_OUTPUT_TOKENS,
      baselineModel = this.baselineModel,
      cacheNamespace = "",
    } = options;
    void mode;

    assertNonEmptyIdentifier(model, "model");
    if (!PROVIDER_NAME_PATTERN.test(providerName)) {
      throw new SustainAIError({
        code: "CONFIG_ERROR",
        message: "provider has an invalid name.",
      });
    }
    validateMessages(messages);
    assertNonEmptyIdentifier(baselineModel, "baselineModel");
    if (typeof cacheNamespace !== "string" || cacheNamespace.length > 256) {
      throw new SustainAIError({
        code: "CONFIG_ERROR",
        message:
          "cacheNamespace must be a string no longer than 256 characters.",
      });
    }
    if (!Number.isInteger(expectedOutputTokens) || expectedOutputTokens < 0) {
      throw new SustainAIError({
        code: "CONFIG_ERROR",
        message: "expectedOutputTokens must be a non-negative integer.",
      });
    }
    validateConstraints(constraints);
    const semanticScope = JSON.stringify([cacheNamespace, providerName, model]);

    this.providerCounts[providerName] =
      (this.providerCounts[providerName] ?? 0) + 1;

    // ── 1. Exact-match cache (cheap; no embedding required) ────────────────
    const cacheKey = this.cache
      ? this.cache.hash(model, messages, providerName, cacheNamespace)
      : null;
    if (this.cache && cacheKey && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      this.recordCacheHit(cached, "exact");
      return this.buildCacheHitResponse(cached, "exact", null);
    }

    // ── 2. Semantic cache (requires embedder) ──────────────────────────────
    let queryEmbedding: number[] | null = null;
    if (this.semanticCache && this.embedder) {
      try {
        const candidate = await this.embedder(canonicalizeMessages(messages));
        queryEmbedding = isValidEmbedding(candidate) ? candidate : null;
      } catch (err) {
        // Embedder failures degrade to "no semantic hit" rather than break the call.
        queryEmbedding = null;
        void err;
      }
      if (queryEmbedding && queryEmbedding.length > 0) {
        const hit = this.semanticCache.findSimilar(
          queryEmbedding,
          this.semanticCacheThreshold,
          semanticScope,
        );
        if (hit) {
          this.recordCacheHit(hit.response, "semantic");
          return this.buildCacheHitResponse(
            hit.response,
            "semantic",
            hit.similarity,
          );
        }
      }
    }

    // ── 3. Real call ───────────────────────────────────────────────────────
    const estimatedInputTokens = estimateTokensFromMessages(messages);
    const estimatedUsage: TokenUsage = {
      prompt_tokens: estimatedInputTokens,
      completion_tokens: expectedOutputTokens,
      total_tokens: estimatedInputTokens + expectedOutputTokens,
    };
    const estimatedRaw = this.createRawMetrics(
      model,
      estimatedUsage,
      "estimated",
      baselineModel,
    );
    this.enforceConstraints(estimatedRaw, constraints);

    const result = await this.executeChat(
      model,
      providerName,
      messages,
      estimatedRaw,
      constraints,
      baselineModel,
    );

    if (this.cache && cacheKey) this.cache.set(cacheKey, result);
    if (this.semanticCache && queryEmbedding && queryEmbedding.length > 0) {
      this.semanticCache.add(
        queryEmbedding,
        result,
        `${providerName}:${model}`,
        semanticScope,
      );
    }

    return result;
  }

  private recordCacheHit(
    cached: ChatResponse,
    kind: "exact" | "semantic",
  ): void {
    this.cacheSavings.requests += 1;
    if (kind === "exact")
      this.cacheSavings.exact_hits = (this.cacheSavings.exact_hits ?? 0) + 1;
    else
      this.cacheSavings.semantic_hits =
        (this.cacheSavings.semantic_hits ?? 0) + 1;
    this.cacheSavings.energy_wh += cached.metrics.energy_kwh * 1000;
    this.cacheSavings.water_ml += cached.metrics.water_ml;
    this.cacheSavings.co2_g += cached.metrics.co2_g;
  }

  private buildCacheHitResponse(
    cached: ChatResponse,
    kind: "exact" | "semantic",
    similarity: number | null,
  ): ChatResponse {
    const cacheRaw = this.createRawMetrics(
      cached.metrics.model,
      cached.metrics.token_usage,
      "cache",
      cached.metrics.baseline_model,
    );
    const cacheMetrics = this.buildMetrics({
      ...cacheRaw,
      energy_kwh: 0,
      energy_low_wh: 0,
      energy_high_wh: 0,
      baseline_energy_kwh: cached.metrics.baseline_energy_kwh,
      water_ml: 0,
      direct_water_ml: 0,
      electricity_water_ml: 0,
      water_low_ml: 0,
      water_high_ml: 0,
      co2_g: 0,
      baseline_water_ml: cached.metrics.baseline_water_ml,
      baseline_co2_g: cached.metrics.baseline_co2_g,
      cache_hit: true,
      cache_hit_type: kind,
      cache_similarity: similarity,
    });
    return {
      output: cached.output,
      metrics: cacheMetrics,
      footnote: generateFootnote(cacheMetrics),
    };
  }

  /**
   * Tiered routing: try the smallest tier first; escalate to the next tier
   * only if the previous response's confidence falls below
   * `router.confidenceThreshold`. The returned response is whichever tier
   * answered confidently, or the largest tier if nothing crossed the bar.
   *
   * `metrics.router` on the returned response describes what happened, and
   * cumulative router stats land in `getStats().router` and
   * `metrics.session.router`.
   */
  async chatWithRouting(options: RoutedChatOptions): Promise<ChatResponse> {
    const { router, messages, mode, constraints, cacheNamespace } = options;
    const tiers = router.tiers ?? [];
    if (tiers.length === 0) {
      throw new SustainAIError({
        code: "CONFIG_ERROR",
        message: "chatWithRouting requires at least one tier in router.tiers.",
      });
    }
    const threshold =
      router.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    const confidenceFn: ConfidenceFn =
      router.confidenceFn ?? defaultConfidenceFn;

    let chosen: ChatResponse | null = null;
    let chosenTierIndex = 0;
    let chosenConfidence = 0;
    let attempts = 0;
    let totalEnergyKwh = 0;
    let totalWaterMl = 0;
    let totalCo2G = 0;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i]!;
      attempts += 1;
      const remaining = getRemainingConstraints(
        constraints,
        totalEnergyKwh,
        totalWaterMl,
        totalCo2G,
      );
      const response = await this.chat({
        model: tier.model,
        provider: tier.provider,
        messages,
        ...(mode !== undefined ? { mode } : {}),
        ...(remaining !== undefined ? { constraints: remaining } : {}),
        ...(cacheNamespace !== undefined ? { cacheNamespace } : {}),
      });

      totalEnergyKwh += response.metrics.energy_kwh;
      totalWaterMl += response.metrics.water_ml;
      totalCo2G += response.metrics.co2_g;

      const rawConfidence = await confidenceFn(
        {
          text: response.output,
          ...(response.metrics.tokens_estimated > 0
            ? { usage: { total_tokens: response.metrics.tokens_estimated } }
            : {}),
        },
        { tier, tierIndex: i, messages },
      );

      // Clamp untrusted confidence output before it affects routing or counters.
      // NaN, ±Infinity, and out-of-range values collapse into [0, 1].
      let confidence: number;
      if (
        typeof rawConfidence !== "number" ||
        !Number.isFinite(rawConfidence)
      ) {
        confidence = 0;
      } else if (rawConfidence < 0) {
        confidence = 0;
      } else if (rawConfidence > 1) {
        confidence = 1;
      } else {
        confidence = rawConfidence;
      }

      chosen = response;
      chosenTierIndex = i;
      chosenConfidence = confidence;

      if (confidence >= threshold) break;
    }

    // chosen is non-null because tiers.length > 0 and we always enter the loop
    const finalResponse = chosen!;
    const finalTier = tiers[chosenTierIndex]!;

    // ── Compute "vs largest tier" savings using the actual response token
    // count as the basis for what the largest tier *would* have used.
    const largestTier = tiers[tiers.length - 1]!;
    const largestKwh = estimateEnergyDetailed(
      finalResponse.metrics.token_usage,
      largestTier.model,
      {
        ...(this.customEstimator
          ? { customEstimator: this.customEstimator }
          : {}),
        tokenSource: finalResponse.metrics.token_source,
      },
    ).energy_kwh;
    const largestWaterMl =
      this.legacyRegionFactor !== undefined
        ? largestKwh * this.legacyRegionFactor
        : computeOperationalWater(largestKwh, this.waterAccounting).water_ml;
    const largestCo2G = largestKwh * this.gridIntensityG;

    const energy_saved_vs_largest_kwh = largestKwh - totalEnergyKwh;
    const water_saved_vs_largest_ml = largestWaterMl - totalWaterMl;
    const co2_saved_vs_largest_g = largestCo2G - totalCo2G;

    const routerMetrics: RouterMetrics = {
      tier_used: chosenTierIndex,
      tiers_attempted: attempts,
      confidence: chosenConfidence,
      escalated: chosenTierIndex > 0,
      model_chosen: finalTier.model,
      provider_chosen: finalTier.provider,
      energy_saved_vs_largest_kwh,
      water_saved_vs_largest_ml,
      co2_saved_vs_largest_g,
    };

    // Update router session totals
    if (!this.routerSession) {
      this.routerSession = {
        routed_requests: 0,
        escalations: 0,
        tier_usage: new Array(tiers.length).fill(0),
        energy_saved_vs_largest_kwh: 0,
        water_saved_vs_largest_ml: 0,
        co2_saved_vs_largest_g: 0,
      };
    }
    // Grow tier_usage if the caller used a longer tier ladder than before
    while (this.routerSession.tier_usage.length <= chosenTierIndex) {
      this.routerSession.tier_usage.push(0);
    }
    this.routerSession.routed_requests += 1;
    this.routerSession.tier_usage[chosenTierIndex] =
      (this.routerSession.tier_usage[chosenTierIndex] ?? 0) + 1;
    if (chosenTierIndex > 0) this.routerSession.escalations += 1;
    this.routerSession.energy_saved_vs_largest_kwh +=
      energy_saved_vs_largest_kwh;
    this.routerSession.water_saved_vs_largest_ml += water_saved_vs_largest_ml;
    this.routerSession.co2_saved_vs_largest_g += co2_saved_vs_largest_g;

    // Attach router metadata. Re-snapshot the session so the returned
    // metrics reflect the updated routerSession totals.
    const enriched: ResourceMetrics = {
      ...finalResponse.metrics,
      router: routerMetrics,
      session: this.buildSessionSummaryWithoutSideEffects(),
    };
    return {
      output: finalResponse.output,
      metrics: enriched,
      footnote: finalResponse.footnote,
    };
  }

  /**
   * Compose a session summary without mutating any session counters. Used
   * after an inner `chat()` call has accumulated every counter.
   */
  private buildSessionSummaryWithoutSideEffects(): SessionSummary {
    return this.buildSessionSummary();
  }

  private async executeChat(
    model: string,
    providerName: string,
    messages: ChatOptions["messages"],
    rawMetrics: RawMetricsInput,
    constraints?: Constraints,
    baselineModel = this.baselineModel,
  ): Promise<ChatResponse> {
    const adapter = this.resolveProvider(providerName);

    try {
      const providerResponse = await adapter.generate({ model, messages });

      const usage = providerResponse.usage;
      const hasProviderUsage =
        usage !== undefined &&
        (usage.total_tokens !== undefined ||
          usage.prompt_tokens !== undefined ||
          usage.completion_tokens !== undefined);
      const finalRaw = hasProviderUsage
        ? this.createRawMetrics(model, usage, "provider", baselineModel)
        : rawMetrics;
      this.enforceConstraints(finalRaw, constraints);

      const metrics = this.buildMetrics(finalRaw);

      return {
        output: providerResponse.text,
        metrics,
        footnote: generateFootnote(metrics),
      };
    } catch (err) {
      if (err instanceof SustainAIError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new SustainAIError({
        code: "PROVIDER_ERROR",
        message: msg,
        provider: providerName,
      });
    }
  }

  getStats() {
    const { unit, bottleSizeMl, bottleSizeDisplay, system } = this.unitCtx;
    const session = this.buildSessionSummary();

    return {
      total_requests: session.requests,
      cache_hits: session.cache_hits,
      cache_hit_rate: session.cache_hit_rate,

      total_energy_kwh: session.energy_kwh,
      total_energy_wh: session.energy_kwh * 1000,

      total_water_ml: session.water_ml,
      total_water_saved_ml: session.water_saved_ml,
      total_water_display: mlToDisplay(session.water_ml, system),
      total_water_saved_display: mlToDisplay(session.water_saved_ml, system),
      avg_water_per_request:
        session.requests > 0
          ? mlToDisplay(session.water_ml / session.requests, system)
          : 0,

      total_co2_g: session.co2_g,
      total_co2_saved_g: session.co2_saved_g,
      region: this.region,
      grid_intensity_g_per_kwh: this.gridIntensityG,
      baseline_grid_intensity_g_per_kwh: this.baselineGridIntensityG,

      bottles_saved_session: session.bottles_saved,
      bottle_size_display: bottleSizeDisplay,
      bottle_size_ml: bottleSizeMl,
      unit,

      cache_savings: { ...session.cache_savings },
      semantic_cache_size: this.semanticCache?.size() ?? 0,
      equivalents_used: session.equivalents_used,
      equivalents_saved: session.equivalents_saved,

      router: session.router,

      provider_distribution: { ...this.providerCounts },
    };
  }

  /** Number of entries in the semantic cache. */
  getSemanticCacheSize(): number {
    return this.semanticCache?.size() ?? 0;
  }

  resetSession(): void {
    this.sessionRequests = 0;
    this.sessionCacheHits = 0;
    this.sessionEnergyKwh = 0;
    this.sessionWaterMl = 0;
    this.sessionCo2G = 0;
    this.sessionWaterSavedMl = 0;
    this.sessionCo2SavedG = 0;
    this.sessionBottlesSaved = 0;
    this.cacheSavings.requests = 0;
    this.cacheSavings.exact_hits = 0;
    this.cacheSavings.semantic_hits = 0;
    this.cacheSavings.energy_wh = 0;
    this.cacheSavings.water_ml = 0;
    this.cacheSavings.co2_g = 0;
    this.routerSession = null;
    Object.keys(this.providerCounts).forEach(
      (k) => delete this.providerCounts[k],
    );
  }

  clearCache(): void {
    this.cache?.clear();
    this.semanticCache?.clear();
  }
}

function assertNonEmptyIdentifier(value: string, label: string): void {
  if (typeof value !== "string" || value.trim() === "" || value.length > 256) {
    throw new TypeError(
      `${label} must be a non-empty string no longer than 256 characters.`,
    );
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${label} must be a finite, non-negative number.`);
  }
}

function validateMessages(messages: ChatOptions["messages"]): void {
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    messages.length > MAX_MESSAGE_COUNT
  ) {
    throw new TypeError(
      `messages must contain 1 to ${MAX_MESSAGE_COUNT} entries.`,
    );
  }
  let characters = 0;
  for (const message of messages) {
    if (
      !message ||
      (message.role !== "user" &&
        message.role !== "assistant" &&
        message.role !== "system") ||
      typeof message.content !== "string"
    ) {
      throw new TypeError(
        "Each message must have a valid role and string content.",
      );
    }
    characters += message.content.length;
    if (characters > MAX_MESSAGE_CHARACTERS) {
      throw new RangeError(
        `Message content exceeds the ${MAX_MESSAGE_CHARACTERS}-character safety limit.`,
      );
    }
  }
}

function validateConstraints(constraints?: Constraints): void {
  if (!constraints) return;
  for (const [name, value] of Object.entries(constraints)) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
      throw new TypeError(`${name} must be a finite, non-negative number.`);
    }
  }
}

function isValidEmbedding(value: number[]): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_EMBEDDING_DIMENSIONS &&
    value.every((component) => Number.isFinite(component))
  );
}

function getRemainingConstraints(
  constraints: Constraints | undefined,
  energyKwh: number,
  waterMl: number,
  co2G: number,
): Constraints | undefined {
  if (!constraints) return undefined;
  return {
    ...(constraints.max_kwh !== undefined
      ? { max_kwh: Math.max(0, constraints.max_kwh - energyKwh) }
      : {}),
    ...(constraints.max_water_ml !== undefined
      ? { max_water_ml: Math.max(0, constraints.max_water_ml - waterMl) }
      : {}),
    ...(constraints.max_co2_g !== undefined
      ? { max_co2_g: Math.max(0, constraints.max_co2_g - co2G) }
      : {}),
  };
}
