import type { EstimatorFn, ModelProfile } from "../types.js";
import { getModelProfile } from "./models.js";

export const MODEL_ENERGY_FACTORS: Record<"small" | "medium" | "large", number> = {
  small: 0.0004,
  medium: 0.0012,
  large: 0.0025,
};

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateTokensFromMessages(
  messages: Array<{ role: string; content: string }>
): number {
  return estimateTokens(JSON.stringify(messages));
}

export function getEnergyFactor(model: string): number {
  const profile: ModelProfile | undefined = getModelProfile(model);
  if (!profile) return MODEL_ENERGY_FACTORS.medium;
  return MODEL_ENERGY_FACTORS[profile.class];
}

export function estimateEnergy(tokens: number, model: string, customEstimator?: EstimatorFn): number {
  if (customEstimator) return customEstimator(tokens, model);
  const factor = getEnergyFactor(model);
  return (tokens / 1000) * factor;
}
