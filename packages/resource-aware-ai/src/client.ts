import type {
  ChatOptions,
  ChatResponse,
  EstimatorFn,
  ProviderAdapter,
  ResourceAwareAIConfig,
  ResourceMetrics,
  SessionSummary,
  CacheSavingsTotals,
} from "./types.js";
import { ResourceAwareAIError } from "./types.js";
import { estimateTokensFromMessages, estimateEnergy } from "./core/estimator.js";
import { computeWaterMetrics, calculateSavings } from "./core/calculator.js";
import { computeCarbonMetrics } from "./core/carbon.js";
import { generateFootnote } from "./core/footnote.js";
import { ResponseCache } from "./core/cache.js";
import { makeUnitContext, mlToDisplay, mlToBottles } from "./core/units.js";
import type { UnitContext } from "./core/units.js";
import {
  BASELINE_GRID_G_PER_KWH,
  DEFAULT_REGION,
  getGridIntensity,
} from "./core/regions.js";
import { computeEquivalents, ZERO_EQUIVALENTS } from "./core/equivalents.js";
import type { Equivalents } from "./core/equivalents.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GeminiProvider } from "./providers/gemini.js";
import { MistralProvider } from "./providers/mistral.js";
import { CohereProvider } from "./providers/cohere.js";
import { OllamaProvider } from "./providers/ollama.js";

const DEFAULT_REGION_FACTOR = 2000;
const DEFAULT_BASELINE_FACTOR = 4500;

type BuiltinProviderName = "openai" | "anthropic" | "gemini" | "mistral" | "cohere" | "ollama";

const BUILTIN_PROVIDER_FACTORIES: Record<BuiltinProviderName, () => ProviderAdapter> = {
  openai: () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
  gemini: () => new GeminiProvider(),
  mistral: () => new MistralProvider(),
  cohere: () => new CohereProvider(),
  ollama: () => new OllamaProvider(),
};

interface RawMetricsInput {
  energy_kwh: number;
  water_ml: number;
  co2_g: number;
  baseline_water_ml: number;
  baseline_co2_g: number;
  tokens_estimated: number;
  cache_hit: boolean;
}

export class ResourceAwareAI {
  private readonly regionFactor: number;
  private readonly baselineFactor: number;
  private readonly cache: ResponseCache | null;
  private customEstimator?: EstimatorFn;
  private readonly providers: Map<string, ProviderAdapter>;
  private readonly unitCtx: UnitContext;

  private readonly region: string;
  private readonly gridIntensityG: number;
  private readonly baselineGridIntensityG: number;

  // ── Session state (full-precision floats, only rounded at display) ─────────
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
    energy_wh: 0,
    water_ml: 0,
    co2_g: 0,
  };
  private readonly providerCounts: Record<string, number> = {};

  constructor(config: ResourceAwareAIConfig = {}) {
    this.regionFactor = config.regionFactor ?? DEFAULT_REGION_FACTOR;
    this.baselineFactor = config.baselineFactor ?? DEFAULT_BASELINE_FACTOR;
    this.cache = config.enableCache !== false ? new ResponseCache() : null;
    this.customEstimator = config.customEstimator;
    this.providers = new Map();
    this.unitCtx = makeUnitContext(config.unitSystem ?? "metric", config.bottleSizeMl);

    this.region = config.region ?? DEFAULT_REGION;
    this.gridIntensityG = config.gridIntensityG ?? getGridIntensity(this.region);
    this.baselineGridIntensityG = config.baselineGridIntensityG ?? BASELINE_GRID_G_PER_KWH;
  }

  registerProvider(name: string, adapter: ProviderAdapter): this {
    this.providers.set(name.toLowerCase(), adapter);
    return this;
  }

  setEstimator(fn: EstimatorFn): this {
    this.customEstimator = fn;
    return this;
  }

  private resolveProvider(providerName: string): ProviderAdapter {
    const key = providerName.toLowerCase();
    if (this.providers.has(key)) return this.providers.get(key)!;
    const factory = BUILTIN_PROVIDER_FACTORIES[key as BuiltinProviderName];
    if (factory) return factory();

    throw new ResourceAwareAIError({
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
      this.sessionRequests > 0 ? (this.sessionCacheHits / this.sessionRequests) * 100 : 0;

    const equivalents_used: Equivalents = computeEquivalents({
      energy_wh: this.sessionEnergyKwh * 1000,
      water_ml: this.sessionWaterMl,
      co2_g: this.sessionCo2G,
    });
    const equivalents_saved: Equivalents = computeEquivalents({
      energy_wh: this.cacheSavings.energy_wh, // direct energy avoided via cache
      water_ml: this.sessionWaterSavedMl,
      co2_g: this.sessionCo2SavedG,
    });

    return {
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
  }

  private buildMetrics(raw: RawMetricsInput): ResourceMetrics {
    const {
      energy_kwh,
      water_ml,
      co2_g,
      baseline_water_ml,
      baseline_co2_g,
      tokens_estimated,
      cache_hit,
    } = raw;

    const { system, unit, bottleSizeMl, bottleSizeDisplay } = this.unitCtx;

    const water_saved_ml = Math.max(0, baseline_water_ml - water_ml);
    const water_saved_percent = calculateSavings(water_ml, baseline_water_ml);
    const co2_saved_g = Math.max(0, baseline_co2_g - co2_g);
    const co2_saved_percent = calculateSavings(co2_g, baseline_co2_g);
    const bottles_saved = mlToBottles(water_saved_ml, bottleSizeMl);

    // Update session totals BEFORE composing the snapshot so the metrics
    // include the contribution from this very request.
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
      energy_kwh,
      energy_wh: energy_kwh * 1000,

      water_ml,
      baseline_water_ml,
      water_saved_ml,
      water_saved_percent,
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
      cache_hit,
      session: this.buildSessionSummary(),
    };
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const { model, provider: providerName, messages, mode = "balanced", constraints } = options;
    void mode;

    this.providerCounts[providerName] = (this.providerCounts[providerName] ?? 0) + 1;

    // Check cache FIRST so cache hits (which consume zero resources) cannot
    // be incorrectly rejected by `constraints`.
    const cacheKey = this.cache ? this.cache.hash(model, messages, providerName) : null;
    if (this.cache && cacheKey && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;

      this.cacheSavings.requests += 1;
      this.cacheSavings.energy_wh += cached.metrics.energy_kwh * 1000;
      this.cacheSavings.water_ml += cached.metrics.water_ml;
      this.cacheSavings.co2_g += cached.metrics.co2_g;

      const cacheMetrics = this.buildMetrics({
        energy_kwh: 0,
        water_ml: 0,
        co2_g: 0,
        baseline_water_ml: cached.metrics.baseline_water_ml,
        baseline_co2_g: cached.metrics.baseline_co2_g,
        tokens_estimated: cached.metrics.tokens_estimated,
        cache_hit: true,
      });
      return {
        output: cached.output,
        metrics: cacheMetrics,
        footnote: generateFootnote(cacheMetrics),
      };
    }

    const tokens = estimateTokensFromMessages(messages);
    const kwh = estimateEnergy(tokens, model, this.customEstimator);
    const water = computeWaterMetrics(kwh, this.regionFactor, this.baselineFactor);
    const carbon = computeCarbonMetrics(kwh, this.gridIntensityG, this.baselineGridIntensityG);

    if (constraints) {
      if (constraints.max_water_ml !== undefined && water.water_ml > constraints.max_water_ml) {
        throw new ResourceAwareAIError({
          code: "RESOURCE_LIMIT_EXCEEDED",
          details: { water_ml: water.water_ml, water_limit: constraints.max_water_ml },
        });
      }
      if (constraints.max_kwh !== undefined && kwh > constraints.max_kwh) {
        throw new ResourceAwareAIError({
          code: "RESOURCE_LIMIT_EXCEEDED",
          details: { energy_kwh: kwh, energy_limit: constraints.max_kwh },
        });
      }
      if (constraints.max_co2_g !== undefined && carbon.co2_g > constraints.max_co2_g) {
        throw new ResourceAwareAIError({
          code: "RESOURCE_LIMIT_EXCEEDED",
          details: { co2_g: carbon.co2_g, co2_limit: constraints.max_co2_g },
        });
      }
    }

    const result = await this.executeChat(model, providerName, messages, {
      energy_kwh: kwh,
      water_ml: water.water_ml,
      co2_g: carbon.co2_g,
      baseline_water_ml: water.baseline_water_ml,
      baseline_co2_g: carbon.baseline_co2_g,
      tokens_estimated: tokens,
      cache_hit: false,
    });

    if (this.cache && cacheKey) {
      this.cache.set(cacheKey, result);
    }

    return result;
  }

  private async executeChat(
    model: string,
    providerName: string,
    messages: ChatOptions["messages"],
    rawMetrics: RawMetricsInput,
  ): Promise<ChatResponse> {
    const adapter = this.resolveProvider(providerName);

    try {
      const providerResponse = await adapter.generate({ model, messages });

      let finalRaw = rawMetrics;

      if (providerResponse.usage?.total_tokens) {
        const realTokens = providerResponse.usage.total_tokens;
        const realKwh = estimateEnergy(realTokens, model, this.customEstimator);
        const refinedWater = computeWaterMetrics(realKwh, this.regionFactor, this.baselineFactor);
        const refinedCarbon = computeCarbonMetrics(
          realKwh,
          this.gridIntensityG,
          this.baselineGridIntensityG,
        );
        finalRaw = {
          energy_kwh: realKwh,
          water_ml: refinedWater.water_ml,
          co2_g: refinedCarbon.co2_g,
          baseline_water_ml: refinedWater.baseline_water_ml,
          baseline_co2_g: refinedCarbon.baseline_co2_g,
          tokens_estimated: realTokens,
          cache_hit: false,
        };
      }

      const metrics = this.buildMetrics(finalRaw);

      return {
        output: providerResponse.text,
        metrics,
        footnote: generateFootnote(metrics),
      };
    } catch (err) {
      if (err instanceof ResourceAwareAIError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new ResourceAwareAIError({
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
        session.requests > 0 ? mlToDisplay(session.water_ml / session.requests, system) : 0,

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
      equivalents_used: session.equivalents_used,
      equivalents_saved: session.equivalents_saved,

      provider_distribution: { ...this.providerCounts },
    };
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
    this.cacheSavings.energy_wh = 0;
    this.cacheSavings.water_ml = 0;
    this.cacheSavings.co2_g = 0;
    Object.keys(this.providerCounts).forEach((k) => delete this.providerCounts[k]);
  }

  clearCache(): void {
    this.cache?.clear();
  }
}

void ZERO_EQUIVALENTS;
