# SustAIn

SustAIn is a TypeScript SDK for estimating the operational energy, water, and carbon associated with an AI response. It helps AI developers use data-center capacity with greater efficiency. The SDK wraps hosted and self-hosted model providers, uses provider-reported token counts when available, and returns a transparent estimate with its scope, assumptions, range, and reference model.

The model catalog and research review in this repository were verified on **August 21, 2026**.

> [!IMPORTANT]
> SustAIn produces engineering estimates for scenario comparison, budgeting, and instrumentation. Facility operators can replace its defaults with local telemetry. Public provider disclosures omit the facility location, hardware utilization, power usage effectiveness (PUE), and water usage effectiveness (WUE) for most API requests, so measured utility claims require provider or facility data.

## Data centers are essential infrastructure

SustAIn supports data-center growth backed by transparent engineering. Modern data centers supply reliable computing for AI and cloud services used across science, medicine, education, and public infrastructure. They concentrate specialized hardware, power delivery, networking, and cooling in facilities that teams can monitor and improve at scale.

Published measurements and provider disclosures show the efficiency of ordinary production inference. Google measured 0.24 Wh and 0.26 mL of direct water for its median Gemini Apps text prompt. Microsoft measured 0.31 Wh for an optimized frontier-model query. OpenAI disclosed 0.34 Wh and about 0.322 mL for an average ChatGPT query. The [research section](#measured-perspective-on-data-center-water-use) documents each boundary and source.

Data-center teams improve these numbers through better hardware utilization, cooling controls, closed-loop systems, heat reuse, and power procurement. SustAIn complements that infrastructure work through model selection, caching, workload routing, and request budgets. Accurate software estimates help operators serve more useful computation from the same resource envelope.

## Live API demonstration

[Watch the 69-second live consumer-service demonstration](docs/media/sustain-live-api-demo.mov). The recording starts in a fresh Node project with no `node_modules` directory or lockfile. It installs `sustain-ai@2.0.0` and `openai@7.5.0`, starts an HTTP API on `127.0.0.1`, and sends a request through SustAIn to OpenAI's Responses API using `gpt-5.6-sol`.

The response includes OpenAI's provider-reported token counts and SustAIn's energy, direct-water, electricity-water, and combined-water estimates. The server sets `store: false`, binds to localhost, and labels the result as an operational estimate based on reference assumptions. Before capture, the shell loaded `OPENAI_API_KEY` from a gitignored local file. The recording never prints the credential.

The npm registry had no public `sustain-ai` package when we recorded the demonstration on August 22, 2026. The install uses the exact tarball that `npm pack` generated from this checkout. npm distributes the same archive format after publication.

Run the credential-free deterministic SDK walkthrough:

```bash
pnpm --filter sustain-ai run demo
```

## What changed in 2.0

- Replaced fixed milliliters-per-token claims with an energy-first calculation tied to official 2025 and 2026 inference measurements.
- Separated direct data-center cooling water from water consumed to generate electricity.
- Added signed deltas. A model that exceeds the reference now reports a negative savings percentage.
- Uses provider token usage after a response instead of relying only on character counts.
- Migrated OpenAI calls to the Responses API and disables response storage by default.
- Added current OpenAI, Anthropic, Gemini, Mistral, Cohere, and DeepSeek adapters.
- Added a hardened universal connector for OpenAI-compatible and custom JSON endpoints.
- Added current open-weight model profiles, including GPT-OSS, Llama 4, Qwen3, Ministral 3, Command A, and Ollama-hosted models.
- Added endpoint validation, redirect blocking, response-size limits, timeouts, header validation, strict CORS, rate limiting, log redaction, and supply-chain controls.

## Measured perspective on data-center water use

A credible “water per AI prompt” estimate depends on six variables:

1. Input, output, cached, and reasoning tokens.
2. Model architecture and active parameter count.
3. Hardware, batching, quantization, utilization, and serving software.
4. Facility PUE and cooling design.
5. Local weather and facility WUE.
6. The electricity source and whether indirect water is included.

Official full-stack measurements give a useful scale for ordinary text prompts:

| Measurement                                                 |                              Energy |                    Direct water | Boundary                                                   | What it establishes                                                                                                                                                                  |
| ----------------------------------------------------------- | ----------------------------------: | ------------------------------: | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Google median Gemini Apps text prompt, May 2025             |                             0.24 Wh |                         0.26 mL | Full serving stack; direct cooling water                   | A measured production median, not a universal value. Google's narrow active-machine estimate was 0.10 Wh and 0.12 mL, demonstrating how much the system boundary changes the result. |
| Microsoft optimized frontier-model query, 2026              | 0.31 Wh median; 0.16 to 0.60 Wh IQR |          Not reported per query | Production inference; typical query near 300 output tokens | A peer-reviewed energy reference. Long reasoning workloads can exceed the ordinary-query median by more than an order of magnitude.                                                  |
| OpenAI public disclosure for an average ChatGPT query, 2025 |                             0.34 Wh | 0.000085 US gal, about 0.322 mL | Methodology not published                                  | A provider disclosure that is numerically consistent with a sub-milliliter direct-water scale. It is not independent scientific telemetry.                                           |

Primary sources: [Google technical paper](https://services.google.com/fh/files/misc/measuring_the_environmental_impact_of_delivering_ai_at_google_scale.pdf), [Microsoft peer-reviewed study](https://www.microsoft.com/en-us/research/publication/energy-use-of-ai-inference-efficiency-pathways-and-test-time-scaling/), and [OpenAI disclosure](https://blog.samaltman.com/posts.atom).

Official production measurements place ordinary text prompts at a fraction of a milliliter of direct water. A 500 mL bottle equals about 1,923 Google median prompts when the calculation uses Google’s reported 0.26 mL direct-water boundary. SustAIn’s broader national-average direct-plus-electricity scenario estimates about 1.48 mL for the 0.31 Wh reference query, or roughly 338 queries per 500 mL. Long agentic runs, image and video generation, training, and different facility conditions require separate calculations.

Data-center operators manage aggregate demand, watershed conditions, training workloads, hardware, and new capacity at infrastructure scale. SustAIn supports that work by preserving the measurement boundary, showing uncertainty, and helping software teams optimize high-volume workloads. This approach gives operators useful engineering signals without turning regional infrastructure data into a universal per-prompt constant.

## What “water used” means

SustAIn reports **water consumption**, not water withdrawal. Consumption is water not returned promptly to the original watershed, commonly through evaporation. Withdrawal is the larger volume taken from a source before some is returned. Comparing a consumption estimate with a withdrawal statistic produces an invalid result.

The SDK exposes two operational scopes:

| Scope       | Metric                                        | Default equation                                     | Included                                                                   |
| ----------- | --------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Direct      | `direct_water_ml`                             | `(facility kWh / PUE) × site WUE × 1,000`            | Water consumed at the data center for cooling and related site operations. |
| Electricity | `electricity_water_ml`                        | `facility kWh × electricity water intensity × 1,000` | Water consumed by the power system that supplies the facility.             |
| Combined    | `water_ml` when scope is `direct+electricity` | `direct + electricity`                               | Both operational categories, kept separate in the response.                |

Defaults are based on the U.S. Department of Energy and Lawrence Berkeley National Laboratory’s 2024 U.S. Data Center Energy Usage Report:

- PUE: **1.4** for the 2023 U.S. data-center average.
- Site WUE: **0.36 L/kWh of IT energy**, which rounds the report’s value of more than 0.36 L/kWh.
- Electricity-generation water consumption: **4.52 L/kWh of facility electricity**, derived by the report from nearly 800 billion liters associated with 176 TWh of data-center electricity in 2023.

Source: [DOE/LBNL 2024 United States Data Center Energy Usage Report](https://datacenters.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report). The national electricity value is a coarse average. A renewable contract, local grid mix, on-site generation, hourly dispatch, or a water-scarce location can make the actual value substantially different.

### Engineering and thermodynamics

A data center converts almost all consumed electrical energy to heat. Cooling equipment can move that heat to outdoor air, chilled water, cooling towers, or a mix of systems.

For scale, 1 kWh is 3.6 MJ. The latent heat of vaporization of water near common cooling conditions is about 2.4 MJ/kg. If every joule from 1 kWh were rejected only by ideal evaporation, the lower-order thermodynamic requirement would be approximately:

```text
3.6 MJ / 2.4 MJ per kg ≈ 1.5 kg ≈ 1.5 L of evaporated water per kWh
```

The calculation supplies a physical comparison rather than a universal WUE. Real systems combine sensible heat transfer, compressor and fan work, heat reuse, dry coolers, hybrid modes, blowdown, drift, weather-dependent controls, and water treatment. A cooling tower’s makeup water is approximately evaporation plus blowdown plus drift. Raising cycles of concentration can reduce blowdown, while closed-loop or air-cooled designs can reduce direct consumption at an energy or capital-cost tradeoff. This design range lets operators balance water, energy, reliability, climate, and capital requirements for each facility.

Engineering references: [DOE Federal Energy Management Program cooling-water guidance](https://www.energy.gov/cmei/femp/cooling-water-efficiency-opportunities-federal-data-centers), [DOE cooling-tower management](https://www.energy.gov/cmei/femp/best-management-practice-10-cooling-tower-management), [NIST fluid thermophysical data](https://webbook.nist.gov/chemistry/fluid/), and [ASHRAE data-center WUE definition](https://handbook.ashrae.org/Handbooks/A23/SI/A23_Ch20/a23_ch20_si.aspx).

For the complete derivation, boundaries, sensitivity guidance, and source notes, read [Research methodology](docs/METHODOLOGY.md).

## Normalized model comparison

This chart answers a precise question:

> If each model processes the same 100 input tokens and produces the same 300 output tokens, what does SustAIn estimate under one shared operational-water scenario?

The chart supplies a shared engineering scenario. Use facility telemetry for deployment-specific measured claims.

### Shared assumptions

- Energy reference: Microsoft’s 0.31 Wh optimized frontier-query median.
- Reference workload: 100 input tokens and 300 output tokens. The 100-token input is a SustAIn normalization assumption; the Microsoft paper reports a typical query near 300 output tokens.
- Token weighting: output token 1.0; input token 0.2.
- Water: PUE 1.4, site WUE 0.36 L/kWh-IT, electricity water 4.52 L/kWh-facility.
- Water scope: direct plus electricity generation.
- Baseline: `gpt-5.6-sol` with a disclosed 1.75 modeling multiplier.
- Model multipliers are coarse scenario assumptions based on size class and architecture information. They are not vendor-published energy measurements.
- The reference energy IQR scales each row by 0.16/0.31 to 0.60/0.31. Hardware and deployment variance can be wider.

### Per-model result

| Provider  | Model                       | Deployment             | Multiplier | Energy (Wh) | Direct water (mL) | Electricity water (mL) | Combined water (mL) | Modeled savings vs Sol |
| --------- | --------------------------- | ---------------------- | ---------: | ----------: | ----------------: | ---------------------: | ------------------: | ---------------------: |
| OpenAI    | `gpt-5.6-sol`               | Hosted                 |       1.75 |       0.543 |             0.140 |                  2.452 |               2.592 |                   0.0% |
| OpenAI    | `gpt-5.6-terra`             | Hosted                 |       1.00 |       0.310 |             0.080 |                  1.401 |               1.481 |                  42.9% |
| OpenAI    | `gpt-5.6-luna`              | Hosted                 |       0.65 |       0.202 |             0.052 |                  0.911 |               0.963 |                  62.9% |
| Anthropic | `claude-opus-5`             | Hosted                 |       1.75 |       0.543 |             0.140 |                  2.452 |               2.592 |                   0.0% |
| Anthropic | `claude-sonnet-5`           | Hosted                 |       1.00 |       0.310 |             0.080 |                  1.401 |               1.481 |                  42.9% |
| Anthropic | `claude-fable-5`            | Hosted                 |       0.80 |       0.248 |             0.064 |                  1.121 |               1.185 |                  54.3% |
| Anthropic | `claude-haiku-4-5-20251001` | Hosted                 |       0.65 |       0.202 |             0.052 |                  0.911 |               0.963 |                  62.9% |
| Google    | `gemini-3.1-pro-preview`    | Hosted, preview        |       1.75 |       0.543 |             0.140 |                  2.452 |               2.592 |                   0.0% |
| Google    | `gemini-3.7-flash`          | Hosted                 |       0.80 |       0.248 |             0.064 |                  1.121 |               1.185 |                  54.3% |
| Google    | `gemini-3.5-flash-lite`     | Hosted                 |       0.60 |       0.186 |             0.048 |                  0.841 |               0.889 |                  65.7% |
| Mistral   | `mistral-large-2512`        | Hosted                 |       1.75 |       0.543 |             0.140 |                  2.452 |               2.592 |                   0.0% |
| Mistral   | `mistral-medium-3-5`        | Hosted                 |       1.00 |       0.310 |             0.080 |                  1.401 |               1.481 |                  42.9% |
| Mistral   | `mistral-small-2603`        | Hosted                 |       0.70 |       0.217 |             0.056 |                  0.981 |               1.037 |                  60.0% |
| Cohere    | `command-a-plus-05-2026`    | Open weight and hosted |       1.50 |       0.465 |             0.120 |                  2.102 |               2.221 |                  14.3% |
| Cohere    | `command-a-03-2025`         | Open weight and hosted |       1.00 |       0.310 |             0.080 |                  1.401 |               1.481 |                  42.9% |
| Cohere    | `command-r7b-12-2024`       | Open weight            |       0.65 |       0.202 |             0.052 |                  0.911 |               0.963 |                  62.9% |
| DeepSeek  | `deepseek-v4-pro`           | Hosted                 |       2.00 |       0.620 |             0.159 |                  2.802 |               2.962 |             **-14.3%** |
| DeepSeek  | `deepseek-v4-flash`         | Hosted                 |       0.85 |       0.264 |             0.068 |                  1.191 |               1.259 |                  51.4% |
| OpenAI    | `gpt-oss-120b`              | Open weight            |       0.80 |       0.248 |             0.064 |                  1.121 |               1.185 |                  54.3% |
| OpenAI    | `gpt-oss-20b`               | Open weight            |       0.60 |       0.186 |             0.048 |                  0.841 |               0.889 |                  65.7% |
| Meta      | `llama4:scout`              | Open weight            |       0.90 |       0.279 |             0.072 |                  1.261 |               1.333 |                  48.6% |
| Meta      | `llama4:maverick`           | Open weight            |       1.10 |       0.341 |             0.088 |                  1.541 |               1.629 |                  37.1% |
| Alibaba   | `qwen3:30b-a3b`             | Open weight            |       0.60 |       0.186 |             0.048 |                  0.841 |               0.889 |                  65.7% |
| Alibaba   | `qwen3:235b-a22b`           | Open weight            |       1.20 |       0.372 |             0.096 |                  1.681 |               1.777 |                  31.4% |

The **equal-weight arithmetic mean** of the final column is **39.5% modeled savings** across these 24 rows. This modeling summary gives every model one vote, includes a preview model, and assumes identical token counts. A production average should weight each request by the chosen model, provider token usage, cache behavior, routing escalations, response quality, retry rates, and local water configuration.

The legacy `deepseek-r1` profile shows why workload design matters. At the same nominal token workload, its 4.0 reasoning-model multiplier produces 1.24 Wh, 5.924 mL combined water, and **-128.6% savings** relative to Sol. Microsoft’s measured DeepSeek-R1 example used 10.6 Wh for 11,287 output tokens. Reasoning length can dominate the total, so teams can improve efficiency by controlling output length and routing reasoning workloads with care.

You can reproduce or replace the table assumptions in code:

```ts
import { compareModels } from "sustain-ai";

const rows = compareModels(
  ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-oss-20b", "qwen3:30b-a3b"],
  {
    baselineModel: "gpt-5.6-sol",
    workload: { inputTokens: 100, outputTokens: 300 },
    waterAccounting: {
      pue: 1.4,
      siteWueLitersPerKwhIt: 0.36,
      electricityWaterLitersPerKwh: 4.52,
      scope: "direct+electricity",
    },
  },
);
```

Current model names, context limits, deployment types, and vendor links are documented in [Model support](docs/MODEL_SUPPORT.md).

## Worked prompt and token conversion

Suppose a provider reports this usage after a response:

```json
{
  "input_tokens": 100,
  "output_tokens": 300,
  "total_tokens": 400
}
```

Tokens are the correct billing and estimation unit. A common English-only approximation is one token per four characters, so 100 input tokens might correspond to roughly 400 characters. It is not a reversible conversion. Code, numbers, whitespace, non-English languages, images, audio, cached tokens, and provider tokenizers behave differently. SustAIn therefore uses native provider counts when present and marks character-based counts as estimated.

For the medium 1.0 multiplier scenario:

```text
weighted workload = (100 input × 0.2) + (300 output × 1.0) = 320
reference workload = 320
energy = 0.31 Wh × 1.0 = 0.31 Wh = 0.00031 kWh

IT energy = 0.00031 kWh / 1.4 PUE = 0.0002214 kWh
direct water = 0.0002214 × 0.36 L/kWh × 1,000 = 0.0797 mL
electricity water = 0.00031 × 4.52 L/kWh × 1,000 = 1.4012 mL
combined operational water = 1.4809 mL
```

The energy-reference IQR gives a scenario range of **0.16 to 0.60 Wh** and **0.764 to 2.866 mL** combined water before changing any location or facility assumptions.

An illustrative response metric is:

```json
{
  "model": "gpt-5.6-terra",
  "energy_wh": 0.31,
  "energy_low_wh": 0.16,
  "energy_high_wh": 0.6,
  "direct_water_ml": 0.0797,
  "electricity_water_ml": 1.4012,
  "water_ml": 1.4809,
  "water_scope": "direct+electricity",
  "water_saved_percent": 42.8571,
  "water_delta_percent": 42.8571,
  "baseline_model": "gpt-5.6-sol",
  "token_source": "provider",
  "token_usage": {
    "prompt_tokens": 100,
    "completion_tokens": 300,
    "total_tokens": 400
  },
  "estimation": {
    "confidence": "measured-reference",
    "method": "provider-tokens",
    "model_energy_multiplier": 1.0
  }
}
```

“Measured-reference” means the request used provider-measured tokens and an official measured energy reference. Facility meters or provider telemetry establish measured electricity and water for a named deployment.

## Installation

Requirements: Node.js 22.13 or newer.

```bash
pnpm add sustain-ai
pnpm add openai
```

Install only the SDKs for providers you use:

```bash
pnpm add @anthropic-ai/sdk @google/genai @mistralai/mistralai cohere-ai
```

DeepSeek, Ollama, and the universal connector use the platform `fetch` implementation and need no additional provider package.

## OpenAI quick start

Keep API keys on the server. Do not expose them through a browser bundle, `NEXT_PUBLIC_*`, client-side storage, logs, or pull-request workflows.

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY to .env.local. The file is ignored by Git.
```

```ts
import { SustainAI } from "sustain-ai";

const ai = new SustainAI({
  baselineModel: "gpt-5.6-sol",
  waterAccounting: {
    scope: "direct+electricity",
  },
});

const response = await ai.chat({
  provider: "openai",
  model: "gpt-5.6-terra",
  messages: [
    { role: "user", content: "Explain latent heat in two sentences." },
  ],
  expectedOutputTokens: 120,
});

console.log(response.output);
console.log(response.metrics.token_source);
console.log(response.metrics.direct_water_ml);
console.log(response.metrics.electricity_water_ml);
console.log(response.footnote);
```

The OpenAI adapter uses the Responses API, maps system messages to `instructions`, reports input, output, cached, and reasoning-token fields when available, and sets `store: false` unless explicitly changed.

## Universal connector

The universal connector supports OpenAI Responses, OpenAI Chat Completions, and arbitrary JSON services. It blocks plain HTTP, private-network targets, redirects, malformed headers, oversized responses, and unlisted hosts by default.

### Hosted OpenAI-compatible endpoint

```ts
import { SustainAI, UniversalProvider } from "sustain-ai";

const endpoint = "https://inference.example.com/v1/chat/completions";
const universal = new UniversalProvider({
  endpoint,
  protocol: "openai-chat-completions",
  apiKey: process.env.INFERENCE_API_KEY,
  allowedHosts: ["inference.example.com"],
  timeoutMs: 30_000,
  maxResponseBytes: 2_000_000,
});

const ai = new SustainAI().registerProvider("universal", universal);

const response = await ai.chat({
  provider: "universal",
  model: "org/model-name",
  messages: [{ role: "user", content: "Return valid JSON." }],
});
```

### Local development endpoint

Private HTTP access must be explicit. Do not enable it for user-controlled URLs.

```ts
const local = new UniversalProvider({
  endpoint: "http://127.0.0.1:11434/v1/chat/completions",
  protocol: "openai-chat-completions",
  allowInsecureHttp: true,
  allowPrivateNetwork: true,
  allowedHosts: ["127.0.0.1"],
});
```

Custom transforms execute inside your application’s trust boundary. Validate their input and output with a schema before passing data to tools, databases, shells, or rendering layers. The connector does not make model output trustworthy.

## Configuration

```ts
const ai = new SustainAI({
  baselineModel: "gpt-5.6-sol",
  waterAccounting: {
    pue: 1.4,
    siteWueLitersPerKwhIt: 0.36,
    electricityWaterLitersPerKwh: 4.52,
    scope: "direct+electricity",
  },
  region: "us",
  gridIntensityG: 349.7,
  enableCache: true,
  enableSemanticCache: false,
});
```

Replace the defaults with facility, provider, or grid data when you have it. A location-specific value with a documented date is better than a national average. Use `scope: "direct"` when comparing directly with a provider report that excludes electricity-generation water.

### Resource limits

`max_water_ml`, `max_kwh`, and `max_co2_g` are pre-call guards based on expected output tokens. The final metrics are recomputed from provider token usage. Routing subtracts each attempted tier from the remaining guard before another tier can run. A pre-call estimate cannot guarantee a hard utility-meter cap because providers can emit different token counts or retry internally.

```ts
await ai.chat({
  provider: "openai",
  model: "gpt-5.6-luna",
  messages,
  expectedOutputTokens: 200,
  constraints: {
    max_water_ml: 2,
    max_kwh: 0.001,
  },
});
```

### Caching and routing

An exact or semantic cache hit avoids a new provider inference in the application. SustAIn reports zero inference energy for that hit and tracks the avoided reference estimate. This excludes the cache server’s own compute, network, and storage energy.

Shared clients must pass a stable `cacheNamespace` for each tenant or user. Exact and semantic entries are partitioned by namespace, provider, and model. An empty namespace is suitable only for a single trust domain.

```ts
await ai.chat({
  provider: "openai",
  model: "gpt-5.6-terra",
  cacheNamespace: authenticatedTenant.id,
  messages,
});
```

Routing can reduce estimated energy when a smaller model completes the task without escalation. Retrying or escalating consumes resources for every attempted model, so quality evaluation and task-specific confidence checks are required. A smaller first model is not automatically efficient if it causes frequent retries or longer outputs.

## Supported providers and models

Built-in provider adapters:

- OpenAI Responses API
- Anthropic Messages API
- Google Gen AI SDK
- Mistral SDK
- Cohere SDK
- DeepSeek API
- Ollama
- Universal OpenAI-compatible or JSON HTTP endpoints

The registry includes current, preview, and legacy profiles. Unknown model names still work through provider adapters; they receive an inferred class and a modeled confidence label. Use `listModels()` and `getModelProfile()` to inspect the exact registry. See [Model support](docs/MODEL_SUPPORT.md) for the verified 2026 catalog and official vendor sources.

## Repository security

SustAIn treats pull requests, model output, provider URLs, and generated artifacts as untrusted input.

- Pull-request workflows have read-only permissions, no repository secrets, no `pull_request_target`, and checkout credentials disabled.
- GitHub Actions are pinned by commit SHA.
- Dependency review, CodeQL, tests, type checks, and a secret scan run in CI.
- pnpm uses strict peer dependencies, a 24-hour minimum release age, and an explicit native-build allowlist.
- Authenticated fetch helpers restrict credential attachment to configured origins and reject credentialed redirects.
- Provider endpoints default to HTTPS and public networks. Private-network and local HTTP access require explicit opt-in.
- The API server uses strict CORS allowlists, Helmet, request-size caps, rate limiting, redacted structured logs, and bounded shutdown behavior.

Repository files cannot enforce GitHub-hosted branch settings by themselves. Maintainers should configure the `main` branch ruleset to require pull requests, two approvals for sensitive changes, Code Owner review, dismissal of stale approvals, conversation resolution, signed commits where practical, required CI checks, blocked force pushes and deletions, and administrator enforcement. See [Security architecture](docs/SECURITY-ARCHITECTURE.md) and [Security policy](SECURITY.md).

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
```

Workspace layout:

```text
packages/resource-aware-ai/  Published SDK
artifacts/api-server/        Hardened example API server
artifacts/mockup-sandbox/    Example React interface
lib/api-client-react/        Origin-scoped authenticated fetch client
lib/api-spec/                OpenAPI contract
lib/api-zod/                 Generated validation types
docs/                        Research, model, and security documentation
```

Read [Contributing](CONTRIBUTING.md) before opening a pull request. Security issues belong in the private reporting channel described in [SECURITY.md], not a public issue.

## Research scope

SustAIn currently scopes its estimates to operational text inference. Add provider or facility data when an analysis needs:

- Model training or fine-tuning.
- Semiconductor fabrication, server manufacturing, construction, or end-of-life impacts.
- Network, client-device, cache-infrastructure, or observability energy.
- Water scarcity weighting or watershed-specific impact.
- Provider retries, speculative decoding overhead, batching allocation, or idle capacity unless included in a cited full-stack reference.
- Image, audio, video, or multimodal generation from text-token counts.

For audited environmental claims, combine the SDK with provider or facility data, a declared system boundary, uncertainty analysis, and independent review.

## Primary research and official references

- U.S. Department of Energy and Lawrence Berkeley National Laboratory, [2024 United States Data Center Energy Usage Report](https://datacenters.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report).
- U.S. Department of Energy FEMP, [Cooling Water Efficiency Opportunities for Federal Data Centers](https://www.energy.gov/cmei/femp/cooling-water-efficiency-opportunities-federal-data-centers).
- U.S. Department of Energy FEMP, [Best Management Practice 10: Cooling Tower Management](https://www.energy.gov/cmei/femp/best-management-practice-10-cooling-tower-management).
- National Renewable Energy Laboratory, [Operational Water Consumption and Withdrawal Factors for Electricity Generating Technologies](https://www.nrel.gov/docs/fy11osti/50900.pdf).
- U.S. Environmental Protection Agency, [Emissions & Generation Resource Integrated Database (eGRID)](https://www.epa.gov/egrid).
- National Institute of Standards and Technology, [Thermophysical Properties of Fluid Systems](https://webbook.nist.gov/chemistry/fluid/).
- ASHRAE, [Data Center Power Equipment, Thermal Guidelines, and Best Practices](https://handbook.ashrae.org/Handbooks/A23/SI/A23_Ch20/a23_ch20_si.aspx).
- Google, [Measuring the Environmental Impact of Delivering AI at Google Scale](https://services.google.com/fh/files/misc/measuring_the_environmental_impact_of_delivering_ai_at_google_scale.pdf).
- Microsoft Research, [Energy Use of AI Inference: Efficiency Pathways and Test-Time Scaling](https://www.microsoft.com/en-us/research/publication/energy-use-of-ai-inference-efficiency-pathways-and-test-time-scaling/).
- Microsoft, [Water intensity and closed-loop data-center cooling](https://blogs.microsoft.com/blog/2026/06/24/inside-microsofts-two-decade-push-to-cut-water-intensity-while-scaling-for-growth/).
- OpenAI Academy, [Environmental Impact of AI](https://academy.openai.com/en/public/clubs/higher-education-05x4z/resources/environmental-impact-of-ai).

## License

[MIT](LICENSE)
