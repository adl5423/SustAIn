# sustain-ai

`sustain-ai` estimates operational energy, water, and carbon for text-model requests. It reports provider token usage when available, keeps direct cooling water separate from electricity-generation water, and exposes the assumptions behind each estimate.

> This package is an estimator, not utility-meter telemetry. Model-specific energy and water values are normalized scenarios unless the response is backed by your custom measured estimator.

The full research explanation, 2026 model chart, thermodynamic derivation, and source list are in the [repository README](../../README.md) and [methodology](../../docs/METHODOLOGY.md).

## Requirements

- Node.js 20.19 or newer
- ESM or CommonJS
- TypeScript declarations included
- Provider packages are optional peer dependencies

## Install

```bash
pnpm add sustain-ai
pnpm add openai
```

Other hosted providers:

```bash
pnpm add @anthropic-ai/sdk @google/genai @mistralai/mistralai cohere-ai
```

## OpenAI example

```ts
import { SustainAI } from "sustain-ai";

const ai = new SustainAI({
  baselineModel: "gpt-5.6-sol",
  waterAccounting: {
    pue: 1.4,
    siteWueLitersPerKwhIt: 0.36,
    electricityWaterLitersPerKwh: 4.52,
    scope: "direct+electricity",
  },
});

const result = await ai.chat({
  provider: "openai",
  model: "gpt-5.6-terra",
  messages: [{ role: "user", content: "Explain PUE in one sentence." }],
  expectedOutputTokens: 80,
});

console.log(result.output);
console.log(result.metrics);
console.log(result.footnote);
```

Set `OPENAI_API_KEY` only in the server environment. The OpenAI adapter uses the Responses API and disables response storage by default.

## Result fields

Important `metrics` fields:

| Field                             | Meaning                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| `energy_wh`                       | Modeled point estimate for facility electricity.                                                    |
| `energy_low_wh`, `energy_high_wh` | Range scaled from the 2026 reference study’s interquartile range.                                   |
| `direct_water_ml`                 | On-site water consumption under the configured PUE and WUE.                                         |
| `electricity_water_ml`            | Power-generation water consumption under the configured intensity.                                  |
| `water_ml`                        | Selected `direct` or `direct+electricity` scope.                                                    |
| `water_delta_percent`             | Signed change against the same workload on `baseline_model`. Positive is lower; negative is higher. |
| `water_saved_percent`             | Backward-compatible savings field clamped at zero.                                                  |
| `token_usage`                     | Provider input, output, cached, reasoning, and total token counts when returned.                    |
| `token_source`                    | `provider`, `estimated`, or `cache`.                                                                |
| `estimation`                      | Method, reference, class, multiplier, and confidence label.                                         |
| `session`                         | Cumulative totals since the client was constructed or reset.                                        |

## Built-in providers

```ts
import {
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  MistralProvider,
  CohereProvider,
  DeepSeekProvider,
  OllamaProvider,
  UniversalProvider,
} from "sustain-ai";
```

The `SustainAI` client creates built-in providers lazily from conventional server-side environment variables. Call `registerProvider()` when you need explicit configuration or a custom name.

```ts
const ai = new SustainAI().registerProvider(
  "openai-private",
  new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY,
    project: process.env.OPENAI_PROJECT_ID,
    store: false,
  }),
);
```

## Universal connector

```ts
const provider = new UniversalProvider({
  endpoint: "https://inference.example.com/v1/chat/completions",
  protocol: "openai-chat-completions",
  apiKey: process.env.INFERENCE_API_KEY,
  allowedHosts: ["inference.example.com"],
  timeoutMs: 30_000,
  maxResponseBytes: 2_000_000,
});

const ai = new SustainAI().registerProvider("universal", provider);
```

Security defaults:

- HTTPS required.
- Private, loopback, link-local, and metadata-network targets blocked.
- Redirects rejected.
- Header names and values validated.
- Response size and timeout bounded.
- Optional exact hostname allowlist.

For a local server, explicitly enable both private-network and insecure HTTP access and restrict `allowedHosts` to the loopback host. Never pass an end-user URL into a credentialed provider.

## Model comparison

```ts
import { compareModels } from "sustain-ai";

const rows = compareModels(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-oss-20b"], {
  workload: { inputTokens: 100, outputTokens: 300 },
  baselineModel: "gpt-5.6-sol",
});
```

Every row is labeled `normalized-model-estimate`. Do not relabel it as measured provider water use.

## Custom measured estimator

```ts
const ai = new SustainAI({
  customEstimator: (totalTokens, model) => {
    const kwhPerToken = measuredFactors.get(model);
    if (kwhPerToken === undefined) throw new Error(`No factor for ${model}`);
    return kwhPerToken * totalTokens;
  },
});
```

The callback must return finite, non-negative kWh. Document how the factor was measured and which facility boundary it covers.

## Constraints

```ts
await ai.chat({
  provider: "openai",
  model: "gpt-5.6-luna",
  messages,
  expectedOutputTokens: 200,
  constraints: {
    max_water_ml: 2,
    max_kwh: 0.001,
    max_co2_g: 0.5,
  },
});
```

Constraints run before the provider call using expected output tokens. Final metrics are recomputed from provider-native usage. Routing carries the remaining budget across attempted tiers. Treat the guard as an estimate, not a utility-meter cutoff.

## Routing

```ts
const response = await ai.chatWithRouting({
  messages,
  router: {
    tiers: [
      { provider: "openai", model: "gpt-5.6-luna" },
      { provider: "openai", model: "gpt-5.6-terra" },
      { provider: "openai", model: "gpt-5.6-sol" },
    ],
    confidenceThreshold: 0.8,
  },
});
```

Every attempted tier consumes resources. Use a task-specific confidence function and evaluate false acceptances, retries, output length, and escalation rate before claiming routing savings.

## Exact and semantic cache

```ts
const ai = new SustainAI({
  enableCache: true,
  enableSemanticCache: true,
  embedder: async (text) => embed(text),
  semanticCacheThreshold: 0.95,
  semanticCacheMaxSize: 1_000,
});
```

A cache hit reports zero new inference energy. It does not claim that cache lookup, storage, networking, or client rendering uses zero energy.

Pass `cacheNamespace` on every `chat()` or `chatWithRouting()` call when one client instance serves more than one tenant or user. Cache entries are partitioned by namespace, provider, and model.

```ts
await ai.chat({
  provider: "openai",
  model: "gpt-5.6-terra",
  cacheNamespace: authenticatedTenant.id,
  messages,
});
```

## Catalog inspection

```ts
import { getModelProfile, listModels } from "sustain-ai";

console.log(getModelProfile("gpt-oss-20b"));
console.log(listModels("anthropic"));
```

See [model support](../../docs/MODEL_SUPPORT.md) for source URLs and the August 21, 2026 verification status.

## Development

From the repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter sustain-ai run typecheck
corepack pnpm --filter sustain-ai run test
corepack pnpm --filter sustain-ai run build
```

## Security

Report vulnerabilities through the private process in [SECURITY.md](../../SECURITY.md). Do not include credentials, exploit secrets, or private deployment data in a public issue.

## License

[MIT](LICENSE)
