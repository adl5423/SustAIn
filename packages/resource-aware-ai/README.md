# resource-aware-ai

> A provider-agnostic TypeScript SDK that wraps any LLM call and returns **energy + water usage metrics** with a human-readable sustainability footnote.

[![npm version](https://img.shields.io/npm/v/resource-aware-ai.svg)](https://www.npmjs.com/package/resource-aware-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Wrap any call to OpenAI, Anthropic, Gemini, Mistral, Cohere, Ollama, or any custom HTTP endpoint and get back not just the text, but the **estimated energy used, water used, baseline comparison, and bottles-of-water saved per session** — ready to render as a footnote in your UI.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Integrating each LLM provider](#integrating-each-llm-provider)
- [Using it in a frontend application](#using-it-in-a-frontend-application)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [How water usage is calculated](#how-water-usage-is-calculated)
- [How carbon emissions are calculated](#how-carbon-emissions-are-calculated)
- [Human-scale equivalents](#human-scale-equivalents)
- [Cache savings tracking](#cache-savings-tracking)
- [Precision and the savings calculator](#precision-and-the-savings-calculator)
- [Understanding AI water consumption — myths vs facts](#understanding-ai-water-consumption--myths-vs-facts)
- [Contributing](#contributing)
- [License](#license)

---

## Why this exists

Every LLM call consumes electricity. That electricity is generated, and the generation + the data center cooling consume water. Most teams never see those numbers.

`resource-aware-ai` makes the cost visible in one line of code: every response comes back with an estimated water and energy footprint, plus a baseline comparison so you can show users (and yourselves) **what the impact would have been on an unoptimized stack** versus what it actually was.

It's not a guilt trip — it's a metrics layer. Use it for transparency dashboards, compliance reports, sustainability-aware routing, or just to show users a small honest footnote under each AI reply.

---

## Installation

```bash
npm install resource-aware-ai
# or
pnpm add resource-aware-ai
# or
yarn add resource-aware-ai
```

Then install only the provider SDKs you actually plan to use — they're optional peer dependencies, so you don't pay the bundle cost for ones you don't need:

```bash
npm install openai                    # for OpenAI
npm install @anthropic-ai/sdk         # for Anthropic
npm install @google/generative-ai     # for Google Gemini
npm install @mistralai/mistralai      # for Mistral
npm install cohere-ai                 # for Cohere
# Ollama and the Generic HTTP provider need no extra packages
```

**Requirements:** Node.js 18+ (uses the global `fetch` API).

---

## Quick Start

```typescript
import { ResourceAwareAI } from "resource-aware-ai";

const ai = new ResourceAwareAI();

const res = await ai.chat({
  model: "gpt-4o-mini",
  provider: "openai",
  messages: [{ role: "user", content: "Explain photosynthesis simply" }],
});

console.log(res.output);    // The AI reply
console.log(res.footnote);  // The sustainability report
```

The footnote you'd render to the user looks like this:

```
Water used:      0.1176 ml
Without system:  0.2646 ml  (worst-case baseline)
Water saved:     0.1470 ml  (−55.6%)
Energy:          0.0588 Wh
Carbon (global): 0.0283 g CO₂e  (baseline 0.0529 g CO₂e, saved 0.0247 g CO₂e −46.6%)
Bottles saved:   0.0003 × 500.00 ml bottle  |  session total: 0.0003
In human terms: ≈ 0.196 Google searches | 0.003 phone charges | 0.0002 km driven | 0.0007 sec of shower

You've saved 0.0003 of a 500.00 ml bottle of water in this conversation so far.
```

After a few cache hits the footnote also gains a final line:

```
Cache savings (session): 0.30 ml water, 0.18 Wh, 0.087 g CO₂e avoided across 3 hits.
```

---

## Integrating each LLM provider

The SDK ships with built-in adapters for the major providers. Each one accepts an API key either from an environment variable or from a config object passed when registering the provider.

### OpenAI

```typescript
import { ResourceAwareAI } from "resource-aware-ai";

// Reads from process.env.OPENAI_API_KEY automatically
const ai = new ResourceAwareAI();

const res = await ai.chat({
  model: "gpt-4o-mini",       // also: gpt-4o, o1, o1-mini, o3, o3-mini, o4-mini, gpt-4-turbo
  provider: "openai",
  messages: [{ role: "user", content: "Hello" }],
});
```

To pass the key explicitly:

```typescript
import { ResourceAwareAI, OpenAIProvider } from "resource-aware-ai";

const ai = new ResourceAwareAI();
ai.registerProvider("openai", new OpenAIProvider({ apiKey: "sk-..." }));
```

### Anthropic

```typescript
import { ResourceAwareAI } from "resource-aware-ai";

// Reads from process.env.ANTHROPIC_API_KEY
const ai = new ResourceAwareAI();

const res = await ai.chat({
  model: "claude-3-5-haiku-20241022",   // or claude-opus-4-5, claude-sonnet-4-5, etc.
  provider: "anthropic",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Google Gemini

```typescript
// Reads from process.env.GEMINI_API_KEY or GOOGLE_API_KEY
const res = await ai.chat({
  model: "gemini-2.0-flash",            // or gemini-2.5-pro, gemini-1.5-flash, etc.
  provider: "gemini",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Mistral

```typescript
// Reads from process.env.MISTRAL_API_KEY
const res = await ai.chat({
  model: "mistral-small-latest",        // or mistral-large-latest, codestral-latest, etc.
  provider: "mistral",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Cohere

```typescript
// Reads from process.env.COHERE_API_KEY
const res = await ai.chat({
  model: "command-r-plus-08-2024",      // or command-a-03-2025, command-r, etc.
  provider: "cohere",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Ollama (local models, no key required)

```typescript
import { ResourceAwareAI, OllamaProvider } from "resource-aware-ai";

const ai = new ResourceAwareAI();
ai.registerProvider("ollama", new OllamaProvider({
  endpoint: "http://localhost:11434",   // default
}));

const res = await ai.chat({
  model: "llama3.2",                    // or phi4, gemma3, qwen2.5, deepseek-r1, etc.
  provider: "ollama",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Custom HTTP endpoint

For self-hosted or proprietary endpoints, use `GenericProvider`:

```typescript
import { ResourceAwareAI, GenericProvider } from "resource-aware-ai";

const ai = new ResourceAwareAI();
ai.registerProvider("my-llm", new GenericProvider({
  endpoint: "https://my-llm.example.com/chat",
  apiKey: process.env.MY_API_KEY,
  headers: { "X-Custom": "value" },
  transformRequest: (model, messages) => ({ model, messages, temperature: 0.7 }),
  transformResponse: (data) => ({ text: data.choices[0].message.content }),
}));

const res = await ai.chat({
  model: "my-model-v1",
  provider: "my-llm",
  messages: [{ role: "user", content: "Hello" }],
});
```

Or implement the full adapter interface yourself for total control:

```typescript
ai.registerProvider("custom", {
  async generate({ model, messages }) {
    const r = await fetch("https://...", { method: "POST", body: JSON.stringify({ model, messages }) });
    const data = await r.json();
    return {
      text: data.output,
      usage: { total_tokens: data.tokens },   // optional but improves accuracy
    };
  },
});
```

---

## Using it in a frontend application

**Important:** The SDK calls LLM provider APIs directly using your API keys. **Never instantiate it in browser code** — your keys would be exposed. Run it on a server (Express, Fastify, Next.js API routes, Hono, Cloudflare Workers, etc.) and have your frontend talk to that server.

### 1. Backend route (Express example)

```typescript
import express from "express";
import { ResourceAwareAI } from "resource-aware-ai";

const app = express();
app.use(express.json());

const ai = new ResourceAwareAI({ unitSystem: "metric" });

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  const result = await ai.chat({
    model: "gpt-4o-mini",
    provider: "openai",
    messages: [{ role: "user", content: message }],
  });

  res.json({
    reply:    result.output,
    footnote: result.footnote,
    metrics:  result.metrics,
  });
});

app.listen(3000);
```

### 2. Next.js App Router (server action / route handler)

```typescript
// app/api/chat/route.ts
import { ResourceAwareAI } from "resource-aware-ai";
import { NextResponse } from "next/server";

const ai = new ResourceAwareAI();

export async function POST(req: Request) {
  const { message } = await req.json();
  const result = await ai.chat({
    model: "gpt-4o-mini",
    provider: "openai",
    messages: [{ role: "user", content: message }],
  });
  return NextResponse.json(result);
}
```

### 3. Frontend rendering

The response shape is designed to map cleanly to UI elements:

```tsx
// React example
function ChatBubble({ reply, footnote, metrics }) {
  return (
    <div className="chat-bubble">
      <p className="reply">{reply}</p>

      {/* Footnote — preserve line breaks */}
      <pre className="footnote">{footnote}</pre>

      {/* Or render individual metrics for a custom UI */}
      <div className="sustainability-bar">
        <span>{metrics.water_display.toFixed(2)} {metrics.unit} used</span>
        <span>vs {metrics.baseline_display.toFixed(2)} {metrics.unit} baseline</span>
        <span>{metrics.water_saved_percent.toFixed(1)}% saved</span>
        <span>{metrics.bottles_saved_session.toFixed(4)} bottles saved this session</span>
      </div>
    </div>
  );
}
```

### Exposing each metric

Every field in `metrics` is plain JSON-safe and ready to render:

| Field | Type | What to do with it |
|---|---|---|
| `water_ml` | number | Raw water used (always ml, internal) |
| `water_display` | number | Water used in your chosen unit (ml or fl oz) — **render this** |
| `baseline_water_ml` | number | Worst-case baseline in ml |
| `baseline_display` | number | Baseline in chosen unit — **render this** |
| `water_saved_ml` | number | Water saved vs baseline (ml) |
| `water_saved_display` | number | Saved in chosen unit — **render this** |
| `water_saved_percent` | number | Percentage saved — show in a progress bar |
| `unit` | string | `"ml"` or `"fl oz"` — append to displayed numbers |
| `energy_kwh` | number | Energy used (multiply by 1000 for Wh) |
| `tokens_estimated` | number | Token count used for the estimate |
| `cache_hit` | boolean | Whether served from cache (show a badge) |
| `bottles_saved` | number | Bottles saved by **this single call** |
| `bottles_saved_session` | number | Cumulative bottles saved this session — **show a counter** |
| `bottle_size_display` | number | Bottle size for the label (500 ml or 16.91 fl oz) |
| `energy_wh` | number | Energy used in Wh (= `energy_kwh × 1000`) — convenient for UI |
| `co2_g` | number | Carbon emissions for this call, in grams CO₂e |
| `baseline_co2_g` | number | Worst-case-grid baseline emissions for this call (grams) |
| `co2_saved_g` | number | Carbon saved vs baseline (grams) |
| `co2_saved_percent` | number | Percentage carbon saved — **render as a progress bar** |
| `co2_saved_session_g` | number | Cumulative CO₂ saved this session — **show as a counter** |
| `region` | string | Grid region used (`"global"`, `"fr"`, `"us_california"`, …) |
| `grid_intensity_g_per_kwh` | number | Carbon intensity used for `co2_g` |
| `baseline_grid_intensity_g_per_kwh` | number | Carbon intensity used for `baseline_co2_g` |
| `equivalents.google_searches` | number | This call's energy expressed as # of Google searches |
| `equivalents.smartphone_charges` | number | Same energy expressed as full smartphone charges |
| `equivalents.km_driven` | number | This call's CO₂ expressed as km driven by an avg car |
| `equivalents.led_bulb_hours` | number | Energy expressed as hours of a 9 W LED bulb |
| `equivalents.shower_seconds` | number | Water expressed as seconds of an average shower |
| `session.requests` | number | Total requests in this session |
| `session.cache_hits` | number | Of those, how many were served from cache |
| `session.cache_hit_rate` | number | Cache hit rate as a percentage (0–100) |
| `session.energy_kwh` | number | Cumulative energy used this session |
| `session.water_ml` | number | Cumulative water used this session |
| `session.co2_g` | number | Cumulative CO₂ emitted this session |
| `session.water_saved_ml` | number | Cumulative water saved vs baseline |
| `session.co2_saved_g` | number | Cumulative CO₂ saved vs baseline |
| `session.bottles_saved` | number | Cumulative bottles saved (same as `bottles_saved_session`) |
| `session.cache_savings.requests` | number | Number of cache hits that avoided a real call |
| `session.cache_savings.energy_wh` | number | Energy avoided **specifically by cache hits** |
| `session.cache_savings.water_ml` | number | Water avoided **specifically by cache hits** |
| `session.cache_savings.co2_g` | number | CO₂ avoided **specifically by cache hits** |
| `session.equivalents_used` | object | Session totals expressed in human-scale units |
| `session.equivalents_saved` | object | Session savings expressed in human-scale units |

The `metrics.session` object is a fresh snapshot on every response, so you can drive a live dashboard from a single response without calling `getStats()` separately.

You can also call `ai.getStats()` to get aggregate session statistics — perfect for a dashboard widget showing total impact across an entire user session.

---

## Configuration

```typescript
const ai = new ResourceAwareAI({
  regionFactor:   1800,        // ml of water per kWh — defaults to 2000 (hybrid cooling)
  baselineFactor: 4500,        // ml/kWh for the worst-case baseline — default 4500
  enableCache:    true,        // cache identical requests — default true
  unitSystem:     "metric",    // "metric" | "imperial" — default "metric"
  bottleSizeMl:   500,         // bottle size used in "bottles saved" math — default 500 ml
  customEstimator: (tokens, model) => tokens * 0.000003,   // override the energy math

  // Carbon
  region:         "fr",        // grid region for CO₂ math — default "global" (~481 g/kWh)
  gridIntensityG: 56,          // optional override (g CO₂e per kWh) — wins over `region`
  baselineGridIntensityG: 900, // worst-case grid (coal-heavy) — default 900
});
```

### Region reference

The `region` config picks a grid intensity from a built-in table. Pass any of these IDs:

| ID | Region | g CO₂e / kWh | Source |
|---|---|---|---|
| `global` | Global average | 481 | Ember 2023 |
| `us` | United States | 369 | EPA eGRID 2022 |
| `us_california` | USA — California (CAISO) | 240 | EPA eGRID 2022 |
| `us_texas` | USA — Texas (ERCOT) | 410 | EPA eGRID 2022 |
| `us_virginia` | USA — Virginia (PJM, data-center heavy) | 268 | EPA eGRID 2022 |
| `us_washington` | USA — Washington (hydro) | 90 | EPA eGRID 2022 |
| `eu` | European Union (avg) | 251 | Ember 2023 |
| `fr` | France (nuclear-heavy) | 56 | Ember 2023 |
| `de` | Germany | 380 | Ember 2023 |
| `uk` | United Kingdom | 207 | Ember 2023 |
| `no` | Norway (hydro) | 28 | Ember 2023 |
| `se` | Sweden | 41 | Ember 2023 |
| `pl` | Poland (coal-heavy) | 661 | Ember 2023 |
| `in` | India | 713 | Ember 2023 |
| `cn` | China | 581 | Ember 2023 |
| `jp` | Japan | 480 | Ember 2023 |
| `br` | Brazil (hydro) | 102 | Ember 2023 |
| `au` | Australia | 549 | Ember 2023 |
| `ca` | Canada (hydro) | 128 | Ember 2023 |
| `za` | South Africa (coal) | 829 | Ember 2023 |
| `ae` | UAE | 469 | Ember 2023 |
| `sg` | Singapore | 408 | Ember 2023 |

If you know the actual grid mix where your traffic lands, set `gridIntensityG` explicitly and skip the lookup. Use `listRegions()` to enumerate the table at runtime.

### Region factor reference

The `regionFactor` should reflect the cooling profile of the data center your traffic actually lands in:

| Cooling type | ml of water per kWh |
|---|---|
| Air-cooled (efficient) | 0–500 |
| Hybrid cooling (typical) | 500–2,000 |
| Evaporative cooling | 2,000–5,000 |

If you don't know, leave it at the default. You can also set it from your own infra dashboard if you have a reliable PUE + WUE measurement.

### Resource constraints

Reject a request before it runs if it would exceed a budget:

```typescript
await ai.chat({
  model: "gpt-4o",
  provider: "openai",
  messages: [...],
  constraints: {
    max_water_ml: 50,
    max_kwh:      0.01,
    max_co2_g:    5,        // also gate on carbon
  },
});
// Throws ResourceAwareAIError with code "RESOURCE_LIMIT_EXCEEDED"
```

### Caching

Identical requests (same model + same messages) are returned instantly from an in-memory cache, with `0 ml` water charged. Useful for retries, common questions, and demos.

```typescript
const ai = new ResourceAwareAI({ enableCache: true });   // default
ai.clearCache();    // flush manually
```

### Imperial units

```typescript
const ai = new ResourceAwareAI({ unitSystem: "imperial" });
// metrics.unit            === "fl oz"
// metrics.water_display   === water_ml / 29.5735
// metrics.bottle_size_display === 16.91   (standard US bottle)
```

---

## API Reference

### `new ResourceAwareAI(config?)`

Returns a client. All config fields are optional (see [Configuration](#configuration)).

### `ai.chat(options) → Promise<ChatResponse>`

Send a chat completion request. Returns:

```typescript
{
  output:   string;            // The LLM's text reply
  metrics:  ResourceMetrics;   // See the metrics table above
  footnote: string;            // Pre-formatted sustainability summary
}
```

### `ai.registerProvider(name, adapter) → this`

Register a custom provider or override a built-in one.

### `ai.setEstimator(fn) → this`

Replace the energy estimation function.

### `ai.getStats()`

Returns cumulative session statistics:

```typescript
{
  total_requests:            number,
  cache_hits:                number,
  cache_hit_rate:            number,   // %

  // Energy
  total_energy_kwh:          number,
  total_energy_wh:           number,

  // Water
  total_water_ml:            number,
  total_water_saved_ml:      number,
  total_water_display:       number,   // in chosen unit
  total_water_saved_display: number,
  avg_water_per_request:     number,

  // Carbon
  total_co2_g:               number,
  total_co2_saved_g:         number,
  region:                    string,   // e.g. "global", "fr"
  grid_intensity_g_per_kwh:           number,
  baseline_grid_intensity_g_per_kwh:  number,

  // Bottles + units
  bottles_saved_session:     number,
  bottle_size_display:       number,
  bottle_size_ml:            number,
  unit:                      string,   // "ml" | "fl oz"

  // Cache savings (session-cumulative, hits only)
  cache_savings: {
    requests:   number,
    energy_wh:  number,
    water_ml:   number,
    co2_g:      number,
  },

  // Human-scale equivalents
  equivalents_used:  { google_searches, smartphone_charges, km_driven, led_bulb_hours, shower_seconds },
  equivalents_saved: { google_searches, smartphone_charges, km_driven, led_bulb_hours, shower_seconds },

  provider_distribution: Record<string, number>,
}
```

### `ai.resetSession()`

Zero out the session counters (useful when starting a new conversation).

### `ai.clearCache()`

Flush the response cache.

### Helper exports

```typescript
import {
  // Models / energy / water
  listModels,
  getModelProfile,
  estimateTokens,
  estimateEnergy,
  computeWaterMetrics,
  calculateSavings,           // the precise savings-percent function

  // Carbon
  computeCarbonMetrics,
  GRID_INTENSITIES,
  BASELINE_GRID_G_PER_KWH,
  getGridIntensity,
  listRegions,

  // Equivalents
  computeEquivalents,
  G_CO2_PER_KM,
  WH_PER_GOOGLE_SEARCH,
  WH_PER_SMARTPHONE_CHARGE,
  W_LED_BULB,
  ML_PER_SHOWER_SECOND,

  // Footnote / units
  generateFootnote,
  generateInlineFootnote,
  mlToDisplay,
  mlToBottles,
} from "resource-aware-ai";
```

---

## How water usage is calculated

The estimate is a transparent two-step calculation. There is no hidden ML model and no telemetry — every number can be reproduced from the inputs.

### Step 1 — Energy

```
tokens  ≈ characters / 4               (or use real token counts when the provider returns them)
kWh     = (tokens / 1000) × model_factor
```

| Model class | kWh per 1,000 tokens |
|---|---|
| Small (≤7B params) | 0.0004 |
| Medium (8B–30B) | 0.0012 |
| Large (≥70B / GPT-4-class) | 0.0025 |

Model class is detected from the registry (`gpt-4o` → large, `gpt-4o-mini` → medium, `phi4` → small, etc.). For unknown model IDs, the SDK infers the class from naming patterns (`mini`, `lite`, `8b`, `70b`, `opus`, `pro`, etc.).

These factors are derived from publicly available benchmarks of LLM inference energy use (see references below). They are **estimates designed to be conservative and comparable**, not exact billing data.

### Step 2 — Water

```
water_ml          = kWh × regionFactor       (default 2,000 ml/kWh — typical hybrid cooling)
baseline_water_ml = kWh × baselineFactor     (default 4,500 ml/kWh — worst-case evaporative cooling)
water_saved_ml    = baseline_water_ml − water_ml
water_saved_%     = water_saved_ml / baseline_water_ml × 100
bottles_saved     = water_saved_ml / bottleSizeMl     (default bottle = 500 ml)
```

The two factors come from peer-reviewed studies of data-center water-usage effectiveness (WUE), which is reported in liters per kWh. Hyperscaler-published WUE numbers cluster between 0.1 and 5 L/kWh depending on cooling tech and climate ([Google 2024 environmental report](https://sustainability.google/reports/), [Microsoft 2024 environmental sustainability report](https://www.microsoft.com/corporate-responsibility/sustainability/report)). The SDK uses the middle of that range as the default and lets you override it with your own infra data.

### What the "baseline" means

The baseline is a **worst-case comparison**, not the global average. It represents what a kWh of inference would cost on an evaporatively cooled data center in a hot region with no efficiency optimizations. The point is to give users a *concrete contrast* — "without the kind of optimization stack we use, this would have cost roughly X" — rather than to claim absolute precision.

### What gets cached

Cache hits are charged **zero water, zero energy, and zero CO₂** because the second call doesn't trigger any inference. The original call is fully accounted for; subsequent identical calls are free, and the avoided cost is added to `session.cache_savings`.

---

## How carbon emissions are calculated

Carbon mirrors the water calculation exactly, so the two metrics stay consistent and comparable.

```
co2_g          = energy_kwh × grid_intensity_g_per_kwh        (your region)
baseline_co2_g = energy_kwh × baseline_grid_intensity_g_per_kwh (worst-case coal-heavy grid, default 900)
co2_saved_g    = max(0, baseline_co2_g − co2_g)
co2_saved_%    = max(0, (baseline_co2_g − co2_g) / baseline_co2_g × 100)
```

The grid-intensity values come from the [Ember Global Electricity Review 2023](https://ember-climate.org/insights/research/global-electricity-review-2023/) and the [EPA eGRID 2022](https://www.epa.gov/egrid) dataset. The baseline of 900 g CO₂e / kWh is a published lifecycle estimate of unabated coal generation — see [IPCC AR5 WG3, Annex III](https://www.ipcc.ch/report/ar5/wg3/).

The same data sources are exposed at runtime via `GRID_INTENSITIES` and `listRegions()` so you can render them in your UI.

---

## Human-scale equivalents

Raw watt-hours and milligrams of CO₂ are hard to feel. The SDK converts them to things people already understand. These show up on every response under `metrics.equivalents`, and aggregated in `metrics.session.equivalents_used` / `equivalents_saved` and `getStats()`.

| Equivalent | Formula | Source |
|---|---|---|
| `google_searches` | `energy_wh / 0.3` | Google's published figure of ~0.3 Wh per search ([Google Official Blog, 2009](https://googleblog.blogspot.com/2009/01/powering-google-search.html)) |
| `smartphone_charges` | `energy_wh / 19` | EPA Energy Star average of ~19 Wh per full charge |
| `km_driven` | `co2_g / 120` | EEA average passenger car: ~120 g CO₂e per km |
| `led_bulb_hours` | `energy_wh / 9` | Typical 9 W LED replacing a 60 W incandescent |
| `shower_seconds` | `water_ml / 158.33` | Average shower 9.5 L/min = 158.33 ml/sec ([WHO/EPA](https://www.epa.gov/watersense/showerheads)) |

All five constants are exported (`WH_PER_GOOGLE_SEARCH`, `G_CO2_PER_KM`, etc.) so you can override them in tests or recompute equivalents from your own numbers.

> Note: `session.equivalents_used` is computed from the session's **actual usage** (`energy_wh`, `water_ml`, `co2_g`). `session.equivalents_saved` is computed from session **savings**: water and CO₂ come from the baseline-vs-actual delta across all calls; the energy field uses cache-only savings (`cache_savings.energy_wh`), since the SDK's energy estimator does not currently produce a separate "baseline energy" figure.

---

## Cache savings tracking

Caching is one of the most impactful sustainability levers — every cache hit avoids a full inference call. The SDK tracks this **separately from the baseline-vs-actual comparison** so you can see the marginal value of your cache.

On every cache hit:
- This request's `energy_kwh`, `water_ml`, and `co2_g` are reported as **0** (nothing actually ran).
- The original cached cost is added to `metrics.session.cache_savings`:

```ts
session.cache_savings = {
  requests:   number,   // # of cache hits so far
  energy_wh:  number,   // energy avoided by cache hits
  water_ml:   number,   // water avoided by cache hits
  co2_g:      number,   // CO₂ avoided by cache hits
}
```

This makes "your cache saved 4.2 g of CO₂ today" trivial to render. The footnote also gains a final `Cache savings (session): …` line as soon as the first cache hit occurs.

---

## Precision and the savings calculator

The "% saved" numbers are the most-watched figures in any sustainability dashboard, so the math is intentionally simple, deterministic, and unit-tested down to the bit.

### Definitions

For any resource `X` (water, CO₂, energy):

```
saved_X    = max(0, baseline_X − actual_X)
saved_X_%  = max(0, (baseline_X − actual_X) / baseline_X × 100)     if baseline_X > 0
saved_X_%  = 0                                                       if baseline_X ≤ 0
```

Implemented in `calculateSavings(actual, baseline)` (exported) and used identically by water, CO₂, and energy.

### Guarantees the test suite enforces

- `calculateSavings(actual, baseline)` returns **exactly** `((baseline − actual) / baseline) × 100` when `0 ≤ actual ≤ baseline` and `baseline > 0` — bit-for-bit, no rounding.
- `calculateSavings(0, baseline)` returns `100` exactly.
- `calculateSavings(actual, 0)` returns `0` (no divide-by-zero).
- `calculateSavings(actual, baseline)` returns `0` whenever `actual > baseline` (never negative).
- The result is **scale-invariant**: `(7, 20)`, `(70, 200)`, and `(0.07, 0.2)` all return the same number.
- `metrics.session.water_ml`, `metrics.session.co2_g`, and `metrics.session.water_saved_ml` equal the **exact sums** of per-request values across all calls in the session — accumulated as full-precision floats, with rounding only happening at display time inside the footnote formatter.
- A cache hit reports `water_saved_percent === 100` and `co2_saved_percent === 100` exactly, and adds the original full cost to `session.cache_savings`.

These invariants are pinned by the [`tests/precision.test.ts`](./tests/precision.test.ts) suite.

### What "absolutely precise" means here

This is precision of the *bookkeeping*, not of the underlying physical estimates. The energy and water/CO₂ factors are still estimates with real-world uncertainty — what the SDK guarantees is that, given those inputs, every derived percentage and every session total is the exact arithmetic result, with no silent rounding, no hidden buckets, no lossy aggregation.

---

## Understanding AI water consumption — myths vs facts

There's a lot of dramatic reporting on AI water use right now. Some of it is grounded; a lot of it conflates very different numbers. Here's a calmer breakdown.

### The truth, in one paragraph

AI inference does use water — primarily through electricity generation (turbines, cooling) and, to a smaller extent, through data-center cooling itself. The amount per query is **small but non-zero**, and it varies wildly by region, cooling system, model size, and time of day. It's worth measuring. It is not a planet-ending crisis per query, but at billion-query scale it adds up enough that transparency matters.

### Common myths

**Myth 1: "ChatGPT uses a bottle of water for every prompt."**
This claim usually traces back to a 2023 University of California Riverside paper that estimated ~500 ml of water per ~20–50 prompts under specific assumptions about training, region, and cooling — not per single prompt, and not for inference alone. A single short inference call with a modern, optimized stack typically uses on the order of **fractions of a milliliter to a few milliliters**, depending on model size and region.

**Myth 2: "AI is poisoning or contaminating the water supply."**
False. Data-center cooling water is typically either:
- Returned to the source at a similar (sometimes slightly warmer) temperature, or
- Evaporated into the atmosphere as part of the water cycle.
It is not chemically polluted by inference workloads. Concerns about *withdrawal* in water-stressed regions are valid; concerns about *contamination* generally are not.

**Myth 3: "Local models use no water."**
Local inference still uses electricity, and that electricity still has a water footprint at the generation source. Running `llama3.2` on a laptop uses less than running `gpt-4o` in a hyperscaler region, but it is not zero. This SDK accounts for that.

**Myth 4: "All providers use the same amount."**
Cooling efficiency varies dramatically: Google reports an average WUE around 1 L/kWh, Microsoft has been improving toward ~0.5 L/kWh, while older or evaporatively cooled facilities can be 4–5× higher. Region factor matters more than provider brand.

**Myth 5: "If I just stop using AI, I save a lot of water."**
Per individual user, the realistic savings are tiny — typically far less than a single shower or a load of laundry per month of normal use. The leverage is at the **infrastructure** layer: choosing efficient regions, using smaller models when appropriate, and caching aggressively. That's exactly what this SDK helps measure and surface.

### What actually moves the needle

| Lever | Approximate impact |
|---|---|
| Choosing a smaller model when adequate | 5–10× less water |
| Routing to an air-cooled region | 3–5× less water |
| Caching repeated queries | Up to 100% less per cache hit |
| Batching short requests | 1.5–3× less overhead per token |
| Avoiding multi-turn re-sending of full history | Linearly less per turn |

The SDK makes the first three measurable. The last two are application-architecture decisions you can validate with `ai.getStats()` over time.

### References

- Li, Yang, Zhao, Ren — *Making AI Less Thirsty* (2023), University of California Riverside
- Google — *2024 Environmental Report* (water-usage effectiveness)
- Microsoft — *2024 Environmental Sustainability Report*
- IEA — *Electricity 2024 — Analysis and forecast to 2026* (data-center energy demand)
- Patterson et al. — *Carbon Emissions and Large Neural Network Training* (Google, 2021)

---

## Contributing

PRs welcome — please open an issue first for non-trivial changes. The SDK is intentionally small and dependency-free at runtime, so changes that add hard dependencies will be discussed carefully.

```bash
git clone <repo>
cd resource-aware-ai
pnpm install
pnpm test
pnpm typecheck
pnpm build
```

---

## License

MIT — see [LICENSE](./LICENSE).
