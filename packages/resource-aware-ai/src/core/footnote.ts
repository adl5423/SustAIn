import type { ResourceMetrics } from "../types.js";

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 100) return value.toFixed(1);
  if (absolute >= 1) return value.toFixed(2);
  if (absolute >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}

function formatCarbon(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(2)} kg CO₂e`;
  return `${formatNumber(grams)} g CO₂e`;
}

export function generateFootnote(metrics: ResourceMetrics): string {
  const bottleLabel = `${formatNumber(metrics.bottle_size_display)} ${metrics.unit} bottle`;
  const cacheLine =
    metrics.session.cache_savings.requests > 0
      ? `Cache avoided ${formatNumber(metrics.session.cache_savings.water_ml)} ml water, ${formatNumber(metrics.session.cache_savings.energy_wh)} Wh, and ${formatCarbon(metrics.session.cache_savings.co2_g)} across ${metrics.session.cache_savings.requests} hit${metrics.session.cache_savings.requests === 1 ? "" : "s"}.`
      : "";

  if (metrics.cache_hit) {
    const lines = [
      `Cache hit: model inference was skipped; estimated inference energy, water, and carbon are zero.`,
      `Avoided reference impact: ${formatNumber(metrics.baseline_water_ml)} ${metrics.unit} and ${formatCarbon(metrics.baseline_co2_g)}.`,
    ];
    if (cacheLine) lines.push(cacheLine);
    return lines.join("\n");
  }

  const comparison =
    metrics.water_delta_percent >= 0
      ? `${formatNumber(metrics.water_saved_display)} ${metrics.unit} lower (${formatNumber(metrics.water_delta_percent)}%)`
      : `${formatNumber(Math.abs(metrics.water_delta_ml))} ml higher (${formatNumber(Math.abs(metrics.water_delta_percent))}%)`;
  const tokenLabel =
    metrics.token_source === "provider"
      ? "provider-reported"
      : "character-estimated";
  const selectedScope =
    metrics.water_scope === "direct"
      ? "direct cooling only"
      : "direct cooling plus electricity generation";

  const lines = [
    `Model: ${metrics.model} | tokens: ${metrics.token_usage.prompt_tokens ?? 0} input + ${metrics.token_usage.completion_tokens ?? 0} output (${tokenLabel})`,
    `Energy estimate: ${formatNumber(metrics.energy_wh)} Wh (modeled range ${formatNumber(metrics.energy_low_wh)} to ${formatNumber(metrics.energy_high_wh)} Wh)`,
    `Water (${selectedScope}): ${formatNumber(metrics.water_display)} ${metrics.unit}`,
    `  Direct cooling: ${formatNumber(metrics.direct_water_ml)} ml | electricity generation: ${formatNumber(metrics.electricity_water_ml)} ml`,
    `Reference ${metrics.baseline_model}: ${formatNumber(metrics.baseline_display)} ${metrics.unit} | difference: ${comparison}`,
    `Carbon (${metrics.region}): ${formatCarbon(metrics.co2_g)} | reference ${formatCarbon(metrics.baseline_co2_g)}`,
    `Accounting: PUE ${formatNumber(metrics.pue)}, site WUE ${formatNumber(metrics.site_wue_l_per_kwh_it)} L/kWh-IT, electricity water ${formatNumber(metrics.electricity_water_l_per_kwh)} L/kWh`,
    `Estimate status: ${metrics.estimation.confidence}; model multiplier ${formatNumber(metrics.estimation.model_energy_multiplier)}. This is an operational estimate, not facility telemetry.`,
    `Session avoided water: ${formatNumber(metrics.bottles_saved_session)} × ${bottleLabel}.`,
  ];
  if (cacheLine) lines.push(cacheLine);
  return lines.join("\n");
}

export function generateInlineFootnote(metrics: ResourceMetrics): string {
  if (metrics.cache_hit) {
    return `Cache hit; inference skipped. Reference water avoided: ${metrics.baseline_display.toFixed(4)} ${metrics.unit}.`;
  }

  const direction = metrics.water_delta_percent >= 0 ? "lower" : "higher";
  return (
    `${metrics.model}: ${metrics.energy_wh.toFixed(4)} Wh; ` +
    `${metrics.water_display.toFixed(4)} ${metrics.unit} ${metrics.water_scope}; ` +
    `${Math.abs(metrics.water_delta_percent).toFixed(1)}% ${direction} than ${metrics.baseline_model}; ` +
    `${metrics.co2_g.toFixed(4)} g CO₂e; ${metrics.estimation.confidence}.`
  );
}
