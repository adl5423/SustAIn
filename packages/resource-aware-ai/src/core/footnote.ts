import type { ResourceMetrics } from "../types.js";

function fmt(n: number, unit: string): string {
  return `${n.toFixed(4).replace(/\.?0+$/, (m, o, s) => (s.indexOf(".") === -1 ? m : ""))} ${unit}`;
}

function fmtN(n: number): string {
  return n >= 1 ? n.toFixed(2) : n.toFixed(4);
}

export function generateFootnote(metrics: ResourceMetrics): string {
  const {
    water_display,
    baseline_display,
    water_saved_display,
    water_saved_percent,
    unit,
    energy_kwh,
    cache_hit,
    bottles_saved,
    bottles_saved_session,
    bottle_size_display,
  } = metrics;

  const bottleUnit = unit;
  const bottleLabel = `${fmtN(bottle_size_display)} ${bottleUnit} bottle`;

  if (cache_hit) {
    const sessionSentence =
      bottles_saved_session >= 1
        ? `You've saved the equivalent of ${fmtN(bottles_saved_session)} ${bottleLabel}s of water in this conversation so far.`
        : `You've saved ${fmtN(bottles_saved_session)} of a ${bottleLabel} of water in this conversation so far.`;
    return (
      `Served from cache — 0 ${unit} used (vs baseline ${fmtN(baseline_display)} ${unit}).\n\n` +
      sessionSentence
    );
  }

  const saved_sign = water_saved_percent >= 0 ? "−" : "+";
  const saved_abs = Math.abs(water_saved_percent).toFixed(1);

  const sessionSentence =
    bottles_saved_session >= 1
      ? `You've saved the equivalent of ${fmtN(bottles_saved_session)} ${bottleLabel}s of water in this conversation so far.`
      : `You've saved ${fmtN(bottles_saved_session)} of a ${bottleLabel} of water in this conversation so far.`;

  const lines = [
    `Water used:      ${fmtN(water_display)} ${unit}`,
    `Without system:  ${fmtN(baseline_display)} ${unit}  (worst-case baseline)`,
    `Water saved:     ${fmtN(water_saved_display)} ${unit}  (${saved_sign}${saved_abs}%)`,
    `Energy:          ${(energy_kwh * 1000).toFixed(4)} Wh`,
    `Bottles saved:   ${fmtN(bottles_saved)} × ${bottleLabel}  |  session total: ${fmtN(bottles_saved_session)}`,
    ``,
    sessionSentence,
  ];

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
  } = metrics;

  if (cache_hit) {
    return `Cache hit — 0 ${unit} used (baseline ${baseline_display.toFixed(4)} ${unit}). Session: ${bottles_saved_session.toFixed(4)} bottles saved.`;
  }

  const sign = water_saved_percent >= 0 ? "−" : "+";
  return (
    `Used ${water_display.toFixed(4)} ${unit} | Baseline ${baseline_display.toFixed(4)} ${unit} | ` +
    `Saved ${water_saved_display.toFixed(4)} ${unit} (${sign}${Math.abs(water_saved_percent).toFixed(1)}%) | ` +
    `Session: ${bottles_saved_session.toFixed(4)} × ${bottle_size_display.toFixed(1)} ${unit} bottles saved`
  );
}

void fmt;
