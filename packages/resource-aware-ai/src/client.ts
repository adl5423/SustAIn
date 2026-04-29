import type {
  ChatOptions,
  ChatResponse,
  EstimatorFn,
  ProviderAdapter,
  ResourceAwareAIConfig,
  ResourceMetrics,
} from "./types.js";
import { ResourceAwareAIError } from "./types.js";
import { estimateTokensFromMessages, estimateEnergy } from "./core/estimator.js";
import { computeWaterMetrics } from "./core/calculator.js";
import { generateFootnote } from "./core/footnote.js";
import { ResponseCache } from "./core/cache.js";
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

export class ResourceAwareAI {
  private readonly regionFactor: number;
  private readonly baselineFactor: number;
  private readonly cache: ResponseCache | null;
  private customEstimator?: EstimatorFn;
  private readonly providers: Map<string, ProviderAdapter>;
  private readonly observabilityStats = {
    total_requests: 0,
    cache_hits: 0,
    total_water_ml: 0,
    total_water_saved_ml: 0,
    provider_counts: {} as Record<string, number>,
  };

  constructor(config: ResourceAwareAIConfig = {}) {
    this.regionFactor = config.regionFactor ?? DEFAULT_REGION_FACTOR;
    this.baselineFactor = config.baselineFactor ?? DEFAULT_BASELINE_FACTOR;
    this.cache = config.enableCache !== false ? new ResponseCache() : null;
    this.customEstimator = config.customEstimator;
    this.providers = new Map();
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

    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

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

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const { model, provider: providerName, messages, mode = "balanced", constraints } = options;

    const tokens = estimateTokensFromMessages(messages);
    const kwh = estimateEnergy(tokens, model, this.customEstimator);
    const { water_ml, baseline_water_ml, water_saved_percent } = computeWaterMetrics(
      kwh,
      this.regionFactor,
      this.baselineFactor
    );

    if (constraints) {
      if (constraints.max_water_ml !== undefined && water_ml > constraints.max_water_ml) {
        throw new ResourceAwareAIError({
          code: "RESOURCE_LIMIT_EXCEEDED",
          details: { water_ml, water_limit: constraints.max_water_ml },
        });
      }
      if (constraints.max_kwh !== undefined && kwh > constraints.max_kwh) {
        throw new ResourceAwareAIError({
          code: "RESOURCE_LIMIT_EXCEEDED",
          details: { energy_kwh: kwh, energy_limit: constraints.max_kwh },
        });
      }
    }

    this.observabilityStats.total_requests++;
    this.observabilityStats.provider_counts[providerName] =
      (this.observabilityStats.provider_counts[providerName] ?? 0) + 1;

    if (this.cache) {
      const cacheKey = this.cache.hash(model, messages);
      if (this.cache.has(cacheKey)) {
        this.observabilityStats.cache_hits++;
        const cached = this.cache.get(cacheKey)!;
        return {
          ...cached,
          metrics: { ...cached.metrics, cache_hit: true },
          footnote: generateFootnote({ ...cached.metrics, cache_hit: true }),
        };
      }

      const result = await this.executeChat(model, providerName, messages, mode, {
        energy_kwh: kwh,
        water_ml,
        baseline_water_ml,
        water_saved_percent,
        tokens_estimated: tokens,
        cache_hit: false,
      });

      this.cache.set(cacheKey, result);
      this.observabilityStats.total_water_ml += water_ml;
      this.observabilityStats.total_water_saved_ml += baseline_water_ml - water_ml;
      return result;
    }

    const result = await this.executeChat(model, providerName, messages, mode, {
      energy_kwh: kwh,
      water_ml,
      baseline_water_ml,
      water_saved_percent,
      tokens_estimated: tokens,
      cache_hit: false,
    });

    this.observabilityStats.total_water_ml += water_ml;
    this.observabilityStats.total_water_saved_ml += baseline_water_ml - water_ml;
    return result;
  }

  private async executeChat(
    model: string,
    providerName: string,
    messages: ChatOptions["messages"],
    _mode: string,
    metrics: Omit<ResourceMetrics, "cache_hit"> & { cache_hit: false }
  ): Promise<ChatResponse> {
    let adapter: ProviderAdapter;
    try {
      adapter = this.resolveProvider(providerName);
    } catch (err) {
      throw err;
    }

    try {
      const providerResponse = await adapter.generate({ model, messages });

      let finalMetrics: ResourceMetrics = { ...metrics };

      if (providerResponse.usage?.total_tokens) {
        const realTokens = providerResponse.usage.total_tokens;
        const { computeWaterMetrics: cwm, calculateWater } = await import("./core/calculator.js");
        const { estimateEnergy: ee } = await import("./core/estimator.js");
        const realKwh = ee(realTokens, model, this.customEstimator);
        const { water_ml, baseline_water_ml, water_saved_percent } = cwm(
          realKwh,
          this.regionFactor,
          this.baselineFactor
        );
        void calculateWater;
        finalMetrics = {
          energy_kwh: realKwh,
          water_ml,
          baseline_water_ml,
          water_saved_percent,
          tokens_estimated: realTokens,
          cache_hit: false,
        };
      }

      return {
        output: providerResponse.text,
        metrics: finalMetrics,
        footnote: generateFootnote(finalMetrics),
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
    const { total_requests, cache_hits, total_water_ml, total_water_saved_ml, provider_counts } =
      this.observabilityStats;
    return {
      total_requests,
      cache_hits,
      cache_hit_rate: total_requests > 0 ? (cache_hits / total_requests) * 100 : 0,
      total_water_ml: parseFloat(total_water_ml.toFixed(4)),
      total_water_saved_ml: parseFloat(total_water_saved_ml.toFixed(4)),
      avg_water_ml_per_request:
        total_requests > 0 ? parseFloat((total_water_ml / total_requests).toFixed(4)) : 0,
      provider_distribution: { ...provider_counts },
    };
  }

  clearCache(): void {
    this.cache?.clear();
  }
}
