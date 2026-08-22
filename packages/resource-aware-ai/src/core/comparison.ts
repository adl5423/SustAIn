import type { ModelProfile, WaterAccountingConfig } from "../types.js";
import {
  computeOperationalWater,
  resolveWaterAccounting,
} from "./calculator.js";
import { estimateEnergyDetailed } from "./estimator.js";
import { getModelProfile } from "./models.js";

export interface ModelComparisonWorkload {
  inputTokens: number;
  outputTokens: number;
}

export interface ModelComparisonRow {
  model: string;
  provider: string;
  class: ModelProfile["class"];
  deployment?: ModelProfile["deployment"];
  energy_wh: number;
  energy_low_wh: number;
  energy_high_wh: number;
  direct_water_ml: number;
  electricity_water_ml: number;
  water_ml: number;
  water_saved_vs_baseline_ml: number;
  water_saved_vs_baseline_percent: number;
  baseline_model: string;
  methodology: "normalized-model-estimate";
}

export interface CompareModelsOptions {
  baselineModel?: string;
  workload?: Partial<ModelComparisonWorkload>;
  waterAccounting?: Partial<WaterAccountingConfig>;
}

export function compareModels(
  modelIds: string[],
  options: CompareModelsOptions = {},
): ModelComparisonRow[] {
  const workload: ModelComparisonWorkload = {
    inputTokens: options.workload?.inputTokens ?? 100,
    outputTokens: options.workload?.outputTokens ?? 300,
  };
  assertTokenCount(workload.inputTokens, "workload.inputTokens");
  assertTokenCount(workload.outputTokens, "workload.outputTokens");

  const baselineModel = options.baselineModel ?? "gpt-5.6-sol";
  const accounting = resolveWaterAccounting(options.waterAccounting);
  const usage = {
    prompt_tokens: workload.inputTokens,
    completion_tokens: workload.outputTokens,
    total_tokens: workload.inputTokens + workload.outputTokens,
  };
  const baselineEnergy = estimateEnergyDetailed(usage, baselineModel, {
    tokenSource: "estimated",
  });
  const baselineWater = computeOperationalWater(
    baselineEnergy.energy_kwh,
    accounting,
  );

  return modelIds.map((model) => {
    const profile = getModelProfile(model);
    const energy = estimateEnergyDetailed(usage, model, {
      tokenSource: "estimated",
    });
    const water = computeOperationalWater(energy.energy_kwh, accounting);
    const savedMl = baselineWater.water_ml - water.water_ml;
    const savedPercent =
      baselineWater.water_ml > 0 ? (savedMl / baselineWater.water_ml) * 100 : 0;

    return {
      model,
      provider: profile.provider,
      class: profile.class,
      ...(profile.deployment ? { deployment: profile.deployment } : {}),
      energy_wh: energy.energy_wh,
      energy_low_wh: energy.low_wh,
      energy_high_wh: energy.high_wh,
      direct_water_ml: water.direct_water_ml,
      electricity_water_ml: water.electricity_water_ml,
      water_ml: water.water_ml,
      water_saved_vs_baseline_ml: savedMl,
      water_saved_vs_baseline_percent: savedPercent,
      baseline_model: baselineModel,
      methodology: "normalized-model-estimate",
    };
  });
}

function assertTokenCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer.`);
  }
}
