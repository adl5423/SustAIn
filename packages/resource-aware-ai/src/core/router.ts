import type { Message, ProviderResponse } from "../types.js";

/** A single tier in a routing ladder. */
export interface RouterTier {
  /** Model id understood by the chosen provider (e.g. `"gpt-4o-mini"`). */
  model: string;
  /** Provider name (e.g. `"openai"`, `"anthropic"`, or a custom one). */
  provider: string;
  /** Optional human-readable label for dashboards / logs. */
  label?: string;
}

export interface RouterDecisionContext {
  tier: RouterTier;
  tierIndex: number;
  messages: Message[];
}

/**
 * Function that scores how confident we are in a tier's response. Should
 * return a number in `[0, 1]`; values `< confidenceThreshold` will trigger
 * escalation to the next tier.
 */
export type ConfidenceFn = (
  response: ProviderResponse,
  context: RouterDecisionContext,
) => number | Promise<number>;

export interface RouterOptions {
  /** Ordered list of tiers, smallest/cheapest first. Required, non-empty. */
  tiers: RouterTier[];
  /**
   * If a tier's confidence is **below** this value, the router escalates
   * to the next tier. Default: `0.7`.
   */
  confidenceThreshold?: number;
  /**
   * Custom confidence scorer. If omitted, `defaultConfidenceFn` (a heuristic
   * based on text content) is used.
   */
  confidenceFn?: ConfidenceFn;
}

export interface RouterMetrics {
  /** 0-based index of the tier whose response was returned to the caller. */
  tier_used: number;
  /** Total tiers actually executed (>= tier_used + 1). */
  tiers_attempted: number;
  /** Confidence score (0–1) of the returned tier's response. */
  confidence: number;
  /** True when at least one escalation occurred (i.e. `tier_used > 0`). */
  escalated: boolean;
  /** Model that produced the returned response. */
  model_chosen: string;
  /** Provider that produced the returned response. */
  provider_chosen: string;
  /**
   * Energy this routed call would have used if it had gone straight to the
   * largest (last) tier with the same response token count, minus what we
   * actually spent across the attempted tiers. Positive = router saved
   * energy. Negative = escalation cost more than going large directly
   * (rare; happens when tier 0 was unhelpful AND its tokens were nontrivial).
   */
  energy_saved_vs_largest_kwh: number;
  /** Same idea, in ml of water. */
  water_saved_vs_largest_ml: number;
  /** Same idea, in g CO₂e. */
  co2_saved_vs_largest_g: number;
}

export interface RouterSessionTotals {
  /** Number of `chatWithRouting()` calls made this session. */
  routed_requests: number;
  /** Of those, how many escalated past tier 0 at least once. */
  escalations: number;
  /** Per-tier counts of which tier ultimately answered, indexed by tier number. */
  tier_usage: number[];
  /** Cumulative router savings vs always going to the largest tier. */
  energy_saved_vs_largest_kwh: number;
  water_saved_vs_largest_ml: number;
  co2_saved_vs_largest_g: number;
}

/**
 * Phrases that strongly suggest the model isn't actually answering the
 * question — it's deflecting, hedging, or refusing. Each match docks
 * confidence by `LOW_CONFIDENCE_PENALTY`.
 */
export const LOW_CONFIDENCE_PATTERNS: RegExp[] = [
  /\bi (?:don'?t|do not) know\b/i,
  /\bi(?:'?m| am) not (?:sure|certain|familiar)\b/i,
  /\bi (?:cannot|can'?t) (?:answer|help|determine|tell)\b/i,
  /\bi (?:do not|don'?t) have (?:enough|the|sufficient) (?:information|context|details)\b/i,
  /\bunable to (?:answer|determine|provide|verify)\b/i,
  /\bplease (?:provide|clarify|specify)\b/i,
  /\bcould you (?:provide|clarify|tell me|specify)\b/i,
  /\bas an? (?:ai|language model|llm)\b/i,
  /\bI (?:am|'m) (?:just )?an? (?:ai|language model|llm)\b/i,
  /\bit (?:depends|varies)\b/i,
];

/** Outright refusal phrasing — penalised more heavily. */
export const REFUSAL_PATTERNS: RegExp[] = [
  /\bI (?:can'?t|cannot|won'?t) (?:assist|help|provide|do that)\b/i,
  /\bI'?m sorry,? but I (?:can'?t|cannot)\b/i,
  /\bI'?m unable to\b/i,
];

export const LOW_CONFIDENCE_PENALTY = 0.25;
export const REFUSAL_PENALTY = 0.4;
export const SHORT_RESPONSE_PENALTY = 0.3;
export const QUESTION_BACK_PENALTY = 0.15;
export const SHORT_RESPONSE_THRESHOLD = 20;
export const QUESTION_BACK_LENGTH_LIMIT = 200;

/**
 * Heuristic confidence scorer used when no `confidenceFn` is provided.
 *
 * Scoring (each rule independently subtracts from a starting score of 1.0):
 *   • response shorter than 20 chars  → −0.30
 *   • each LOW_CONFIDENCE_PATTERN hit → −0.25
 *   • each REFUSAL_PATTERN hit        → −0.40
 *   • response ends with "?" (length < 200) → −0.15
 * Final score is clamped to [0, 1].
 *
 * Empty text returns 0 (treat as no answer).
 */
export function defaultConfidenceFn(response: ProviderResponse): number {
  const text = (response.text ?? "").trim();
  if (text.length === 0) return 0;

  let confidence = 1.0;
  if (text.length < SHORT_RESPONSE_THRESHOLD) confidence -= SHORT_RESPONSE_PENALTY;
  for (const re of LOW_CONFIDENCE_PATTERNS) {
    if (re.test(text)) confidence -= LOW_CONFIDENCE_PENALTY;
  }
  for (const re of REFUSAL_PATTERNS) {
    if (re.test(text)) confidence -= REFUSAL_PENALTY;
  }
  if (text.length < QUESTION_BACK_LENGTH_LIMIT && /\?\s*$/.test(text)) {
    confidence -= QUESTION_BACK_PENALTY;
  }

  if (confidence < 0) return 0;
  if (confidence > 1) return 1;
  return confidence;
}

export const DEFAULT_CONFIDENCE_THRESHOLD = 0.7;
