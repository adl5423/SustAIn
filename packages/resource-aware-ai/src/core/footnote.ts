import type { ResourceMetrics } from "../types.js";

export function generateFootnote(metrics: ResourceMetrics): string {
  const { water_ml, baseline_water_ml, water_saved_percent, energy_kwh, cache_hit } = metrics;

  if (cache_hit) {
    return `This response was served from cache, using approximately 0 ml of water (−100% vs baseline of ${baseline_water_ml.toFixed(2)} ml).`;
  }

  const savedNote =
    water_saved_percent > 0
      ? `−${water_saved_percent.toFixed(1)}% vs baseline of ${baseline_water_ml.toFixed(2)} ml`
      : `+${Math.abs(water_saved_percent).toFixed(1)}% above baseline`;

  return (
    `This response used ~${water_ml.toFixed(2)} ml of water and ${(energy_kwh * 1000).toFixed(3)} Wh of energy (${savedNote}).`
  );
}
