import type { ResourceMetrics } from "../types.js";

function fmtN(n: number): string {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 100) return n.toFixed(1);
  if (abs >= 1) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(3);
  return n.toFixed(4);
}

function fmtG(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg CO₂e`;
  return `${fmtN(g)} g CO₂e`;
}

export function generateFootnote(metrics: ResourceMetrics): string {
  const {
    water_display,
    baseline_display,
    water_saved_display,
    water_saved_percent,
    unit,
    energy_wh,
    energy_kwh,
    cache_hit,
    bottles_saved,
    bottles_saved_session,
    bottle_size_display,
    co2_g,
    baseline_co2_g,
    co2_saved_g,
    co2_saved_percent,
    region,
    equivalents,
    session,
  } = metrics;

  const energyDisplayWh = energy_wh > 0 ? energy_wh : energy_kwh * 1000;
  const bottleLabel = `${fmtN(bottle_size_display)} ${unit} bottle`;

  const sessionSentence =
    bottles_saved_session >= 1
      ? `You've saved the equivalent of ${fmtN(bottles_saved_session)} ${bottleLabel}s of water in this conversation so far.`
      : `You've saved ${fmtN(bottles_saved_session)} of a ${bottleLabel} of water in this conversation so far.`;

  const cacheSavingsLine =
    session.cache_savings.requests > 0
      ? `Cache savings (session): ${fmtN(session.cache_savings.water_ml)} ml water, ${fmtN(session.cache_savings.energy_wh)} Wh, ${fmtG(session.cache_savings.co2_g)} avoided across ${session.cache_savings.requests} hit${session.cache_savings.requests === 1 ? "" : "s"}.`
      : "";

  if (cache_hit) {
    const lines = [
      `Served from cache — 0 ${unit} water, 0 Wh, 0 g CO₂e used (vs baseline ${fmtN(baseline_display)} ${unit} / ${fmtG(baseline_co2_g)}).`,
      ``,
      sessionSentence,
    ];
    if (cacheSavingsLine) lines.push(cacheSavingsLine);
    return lines.join("\n");
  }

  const water_sign = water_saved_percent >= 0 ? "−" : "+";
  const water_abs = Math.abs(water_saved_percent).toFixed(1);
  const co2_sign = co2_saved_percent >= 0 ? "−" : "+";
  const co2_abs = Math.abs(co2_saved_percent).toFixed(1);

  const equivalentsLine =
    `≈ ${fmtN(equivalents.google_searches)} Google searches | ` +
    `${fmtN(equivalents.smartphone_charges)} phone charges | ` +
    `${fmtN(equivalents.km_driven)} km driven | ` +
    `${fmtN(equivalents.shower_seconds)} sec of shower`;

  const lines = [
    `Water used:      ${fmtN(water_display)} ${unit}`,
    `Without system:  ${fmtN(baseline_display)} ${unit}  (worst-case baseline)`,
    `Water saved:     ${fmtN(water_saved_display)} ${unit}  (${water_sign}${water_abs}%)`,
    `Energy:          ${fmtN(energyDisplayWh)} Wh`,
    `Carbon (${region}): ${fmtG(co2_g)}  (baseline ${fmtG(baseline_co2_g)}, saved ${fmtG(co2_saved_g)} ${co2_sign}${co2_abs}%)`,
    `Bottles saved:   ${fmtN(bottles_saved)} × ${bottleLabel}  |  session total: ${fmtN(bottles_saved_session)}`,
    `In human terms: ${equivalentsLine}`,
    ``,
    sessionSentence,
  ];
  if (cacheSavingsLine) lines.push(cacheSavingsLine);

  return lines.join("\n");
}

export function generateInlineFootnote(metrics: ResourceMetrics): string {
  const {
    water_display,
    baseline_display,
    water_saved_display,
    water_saved_percent,
    unit,
    bottles_saved_session,
    bottle_size_display,
    cache_hit,
    co2_g,
    co2_saved_g,
    co2_saved_percent,
    equivalents,
  } = metrics;

  if (cache_hit) {
    return (
      `Cache hit — 0 ${unit}, 0 g CO₂e used ` +
      `(baseline ${baseline_display.toFixed(4)} ${unit}). ` +
      `Session: ${bottles_saved_session.toFixed(4)} bottles saved.`
    );
  }

  const wSign = water_saved_percent >= 0 ? "−" : "+";
  const cSign = co2_saved_percent >= 0 ? "−" : "+";
  return (
    `Used ${water_display.toFixed(4)} ${unit} | Baseline ${baseline_display.toFixed(4)} ${unit} | ` +
    `Saved ${water_saved_display.toFixed(4)} ${unit} (${wSign}${Math.abs(water_saved_percent).toFixed(1)}%) | ` +
    `CO₂ ${co2_g.toFixed(4)} g (saved ${co2_saved_g.toFixed(4)} g, ${cSign}${Math.abs(co2_saved_percent).toFixed(1)}%) | ` +
    `≈ ${equivalents.google_searches.toFixed(2)} Google searches | ` +
    `Session: ${bottles_saved_session.toFixed(4)} × ${bottle_size_display.toFixed(1)} ${unit} bottles saved`
  );
}
