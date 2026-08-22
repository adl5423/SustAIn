import type {
  EstimateConfidence,
  EstimatorFn,
  ModelProfile,
  TokenSource,
  TokenUsage,
} from "../types.js";
import { getModelProfile } from "./models.js";

/**
 * Reference workload from Microsoft's 2026 production-inference study:
 * 0.31 Wh median for an optimized frontier query with about 300 output tokens.
 * The input-token value is an explicit normalization assumption, not a result
 * reported by the paper.
 */
export const REFERENCE_QUERY_ENERGY_WH = 0.31;
export const REFERENCE_INPUT_TOKENS = 100;
export const REFERENCE_OUTPUT_TOKENS = 300;

/** Microsoft reported a 0.16 to 0.60 Wh interquartile range around the median. */
export const REFERENCE_ENERGY_LOW_MULTIPLIER = 0.16 / REFERENCE_QUERY_ENERGY_WH;
export const REFERENCE_ENERGY_HIGH_MULTIPLIER = 0.6 / REFERENCE_QUERY_ENERGY_WH;

/** Output generation receives five times the weight of cached/input processing. */
export const INPUT_TOKEN_WEIGHT = 0.2;
export const OUTPUT_TOKEN_WEIGHT = 1;

export const MODEL_ENERGY_MULTIPLIERS: Record<ModelProfile["class"], number> = {
  small: 0.65,
  medium: 1,
  large: 1.75,
};

/**
 * Backward-compatible kWh-per-1,000-token factors at the default 25/75
 * input/output split. New code should call estimateEnergyDetailed().
 */
export const MODEL_ENERGY_FACTORS: Record<ModelProfile["class"], number> = {
  small: 0.00050375,
  medium: 0.000775,
  large: 0.00135625,
};

export interface EnergyEstimate {
  energy_kwh: number;
  energy_wh: number;
  low_wh: number;
  high_wh: number;
  usage: Required<
    Pick<TokenUsage, "prompt_tokens" | "completion_tokens" | "total_tokens">
  > &
    Pick<TokenUsage, "cached_input_tokens" | "reasoning_tokens">;
  token_source: TokenSource;
  confidence: EstimateConfidence;
  model_class: ModelProfile["class"];
  model_energy_multiplier: number;
  method: "provider-tokens" | "character-approximation" | "custom-estimator";
}

export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateTokensFromMessages(
  messages: Array<{ role: string; content: string }>,
): number {
  if (messages.length === 0) return 0;
  const contentTokens = messages.reduce(
    (total, message) =>
      total + estimateTokens(message.role) + estimateTokens(message.content),
    0,
  );
  return contentTokens + messages.length * 4 + 2;
}

export function getEnergyMultiplier(model: string): number {
  const profile = getModelProfile(model);
  return profile.energyMultiplier ?? MODEL_ENERGY_MULTIPLIERS[profile.class];
}

export function getEnergyFactor(model: string): number {
  const profile = getModelProfile(model);
  const classFactor = MODEL_ENERGY_FACTORS[profile.class];
  const classMultiplier = MODEL_ENERGY_MULTIPLIERS[profile.class];
  return classFactor * (getEnergyMultiplier(model) / classMultiplier);
}

function normalizeUsage(usage: TokenUsage): EnergyEstimate["usage"] {
  const explicitInput = finiteNonNegative(usage.prompt_tokens);
  const explicitOutput = finiteNonNegative(usage.completion_tokens);
  const explicitTotal = finiteNonNegative(usage.total_tokens);

  let promptTokens = explicitInput ?? 0;
  let completionTokens = explicitOutput ?? 0;

  if (
    explicitTotal !== undefined &&
    explicitInput === undefined &&
    explicitOutput === undefined
  ) {
    promptTokens = Math.round(explicitTotal * 0.25);
    completionTokens = explicitTotal - promptTokens;
  } else if (explicitTotal !== undefined && explicitInput === undefined) {
    promptTokens = Math.max(0, explicitTotal - completionTokens);
  } else if (explicitTotal !== undefined && explicitOutput === undefined) {
    completionTokens = Math.max(0, explicitTotal - promptTokens);
  }

  const totalTokens = explicitTotal ?? promptTokens + completionTokens;
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    ...(usage.cached_input_tokens !== undefined
      ? {
          cached_input_tokens:
            finiteNonNegative(usage.cached_input_tokens) ?? 0,
        }
      : {}),
    ...(usage.reasoning_tokens !== undefined
      ? { reasoning_tokens: finiteNonNegative(usage.reasoning_tokens) ?? 0 }
      : {}),
  };
}

function finiteNonNegative(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

export function estimateEnergyDetailed(
  usage: TokenUsage,
  model: string,
  options: { customEstimator?: EstimatorFn; tokenSource?: TokenSource } = {},
): EnergyEstimate {
  const normalized = normalizeUsage(usage);
  const profile = getModelProfile(model);
  const modelMultiplier = getEnergyMultiplier(model);
  const tokenSource = options.tokenSource ?? "estimated";

  if (options.customEstimator) {
    const energyKwh = options.customEstimator(normalized.total_tokens, model);
    if (!Number.isFinite(energyKwh) || energyKwh < 0) {
      throw new TypeError(
        "customEstimator must return a finite, non-negative kWh value.",
      );
    }
    return {
      energy_kwh: energyKwh,
      energy_wh: energyKwh * 1000,
      low_wh: energyKwh * 1000,
      high_wh: energyKwh * 1000,
      usage: normalized,
      token_source: tokenSource,
      confidence: "custom",
      model_class: profile.class,
      model_energy_multiplier: modelMultiplier,
      method: "custom-estimator",
    };
  }

  const referenceWeightedTokens =
    REFERENCE_INPUT_TOKENS * INPUT_TOKEN_WEIGHT +
    REFERENCE_OUTPUT_TOKENS * OUTPUT_TOKEN_WEIGHT;
  const workloadWeightedTokens =
    normalized.prompt_tokens * INPUT_TOKEN_WEIGHT +
    normalized.completion_tokens * OUTPUT_TOKEN_WEIGHT;
  const energyWh =
    REFERENCE_QUERY_ENERGY_WH *
    modelMultiplier *
    (workloadWeightedTokens / referenceWeightedTokens);

  return {
    energy_kwh: energyWh / 1000,
    energy_wh: energyWh,
    low_wh: energyWh * REFERENCE_ENERGY_LOW_MULTIPLIER,
    high_wh: energyWh * REFERENCE_ENERGY_HIGH_MULTIPLIER,
    usage: normalized,
    token_source: tokenSource,
    confidence: tokenSource === "provider" ? "measured-reference" : "modeled",
    model_class: profile.class,
    model_energy_multiplier: modelMultiplier,
    method:
      tokenSource === "provider"
        ? "provider-tokens"
        : "character-approximation",
  };
}

export function estimateEnergy(
  tokens: number,
  model: string,
  customEstimator?: EstimatorFn,
): number {
  return estimateEnergyDetailed({ total_tokens: tokens }, model, {
    ...(customEstimator ? { customEstimator } : {}),
  }).energy_kwh;
}
