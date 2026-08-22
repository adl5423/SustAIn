# Model support

Verified on August 21, 2026.

SustAIn separates provider support from model profiling:

- A provider adapter determines how a request is authenticated, sent, and parsed.
- A model profile supplies catalog metadata and a disclosed energy-scenario multiplier.
- An unknown model can still run through a registered adapter. SustAIn infers a size class and marks the result as modeled.

Model names and limits change. Pin production model IDs rather than `latest` aliases when reproducibility matters.

## Built-in providers

| Provider key | Transport              | Token usage                                   | Authentication source                | Notes                                                                                      |
| ------------ | ---------------------- | --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `openai`     | OpenAI Responses API   | Input, output, cached input, reasoning, total | `OPENAI_API_KEY` or server config    | `store: false` by default. Custom base URLs pass endpoint validation.                      |
| `anthropic`  | Anthropic Messages API | Provider-native usage                         | `ANTHROPIC_API_KEY` or server config | Custom base URLs require a secure endpoint policy.                                         |
| `gemini`     | Google Gen AI SDK      | Provider-native usage when returned           | `GEMINI_API_KEY` or server config    | Uses `@google/genai`.                                                                      |
| `mistral`    | Mistral SDK            | Provider-native usage when returned           | `MISTRAL_API_KEY` or server config   | Custom server URLs pass endpoint validation.                                               |
| `cohere`     | Cohere SDK             | Provider-native usage when returned           | `COHERE_API_KEY` or server config    | Current Command catalog supported.                                                         |
| `deepseek`   | HTTPS JSON             | Prompt, completion, total                     | `DEEPSEEK_API_KEY` or server config  | Current V4 API profiles; discontinued chat/reasoner aliases are not advertised as current. |
| `ollama`     | Local JSON             | Prompt and evaluation counts                  | No key by default                    | Loopback HTTP is allowed only by the dedicated local adapter.                              |
| Custom name  | Universal connector    | Protocol-dependent                            | Explicit server-side config          | Responses, Chat Completions, or custom transforms.                                         |

## Current hosted catalog

| Provider  | Model IDs represented                                                                                                          | Status and limits                                                                                                        | Official source                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| OpenAI    | `gpt-5.6`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`                                                                      | Sol and Terra: about 1.05M context, 128K output. Luna: 400K context, 128K output.                                        | [OpenAI model documentation](https://developers.openai.com/api/docs/models)                  |
| Anthropic | `claude-opus-5`, `claude-sonnet-5`, `claude-fable-5`, `claude-haiku-4-5-20251001`                                              | Opus, Sonnet, and Fable: 1M context, 128K output. Haiku: 200K context, 64K output.                                       | [Anthropic model overview](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Google    | `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, preview profiles | Gemini 3.7 Flash: 1,048,576 input and 65,536 output tokens. Preview profiles are marked separately.                      | [Gemini models](https://ai.google.dev/gemini-api/docs/models)                                |
| Mistral   | `mistral-medium-3-5`, `mistral-small-2603`, `mistral-large-2512`, `latest` aliases                                             | Versioned IDs are preferred for repeatability.                                                                           | [Mistral model catalog](https://docs.mistral.ai/models)                                      |
| Cohere    | `command-a-plus-05-2026`, `command-a-03-2025`, `command-r7b-12-2024`                                                           | Command A+ has 128K context, 64K output, 218B total and 25B active parameters. Command A and R7B also have open weights. | [Cohere model overview](https://docs.cohere.com/docs/models)                                 |
| DeepSeek  | `deepseek-v4-pro`, `deepseek-v4-flash`                                                                                         | V4 current profiles. Previous `deepseek-chat` and `deepseek-reasoner` service aliases were discontinued July 24, 2026.   | [DeepSeek API updates](https://api-docs.deepseek.com/updates/)                               |

## Open-weight profiles

| Family              | Registry examples                                                                     | Deployment note                                                                                                         | Official source                                                                   |
| ------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| OpenAI GPT-OSS      | `gpt-oss-120b`, `gpt-oss-20b`                                                         | 117B total/5.1B active and 21B total/3.6B active profiles. Run through a universal endpoint or compatible local server. | [Introducing GPT-OSS](https://openai.com/index/introducing-gpt-oss/)              |
| Meta Llama 4        | `llama4:scout`, `llama4:maverick`                                                     | Mixture-of-experts open weights represented with total and active parameters. Ollama-style IDs are included.            | [Llama 4 announcement](https://ai.meta.com/blog/llama-4-multimodal-intelligence/) |
| Alibaba Qwen3       | `qwen3:0.6b`, `qwen3:4b`, `qwen3:8b`, `qwen3:32b`, `qwen3:30b-a3b`, `qwen3:235b-a22b` | Dense and mixture-of-experts variants.                                                                                  | [Qwen3 announcement](https://qwenlm.github.io/blog/qwen3/)                        |
| Mistral Ministral 3 | `ministral-3-3b`, `ministral-3-8b`, `ministral-3-14b`                                 | Compact open-weight profiles.                                                                                           | [Mistral model catalog](https://docs.mistral.ai/models)                           |
| Cohere Command      | `command-a-plus-05-2026`, `command-a-03-2025`, `command-r7b-12-2024`                  | Hosted APIs and open weights are represented by the same model profiles.                                                | [Cohere model overview](https://docs.cohere.com/docs/models)                      |

An open-weight license is not automatically an OSI-approved open-source license. Review each model’s license, acceptable-use terms, and redistribution restrictions before deployment.

## Universal connector protocols

### OpenAI Responses

```ts
const provider = new UniversalProvider({
  endpoint: "https://gateway.example.com/v1/responses",
  protocol: "openai-responses",
  apiKey: process.env.GATEWAY_API_KEY,
  allowedHosts: ["gateway.example.com"],
});
```

Expected response fields include `output_text` or Responses-style `output` content and `usage.input_tokens`, `usage.output_tokens`, and `usage.total_tokens`.

### OpenAI Chat Completions

```ts
const provider = new UniversalProvider({
  endpoint: "https://inference.example.com/v1/chat/completions",
  protocol: "openai-chat-completions",
  apiKey: process.env.INFERENCE_API_KEY,
  allowedHosts: ["inference.example.com"],
});
```

Expected response fields include `choices[0].message.content` and Chat Completions-style usage.

### Custom JSON

```ts
import { z } from "zod";

const ResponseSchema = z.object({
  answer: z.string().max(100_000),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});

const provider = new UniversalProvider({
  endpoint: "https://models.example.com/generate",
  protocol: "generic-json",
  allowedHosts: ["models.example.com"],
  headers: { "X-API-Key": process.env.MODEL_API_KEY ?? "" },
  transformRequest: (model, messages) => ({ model, messages }),
  transformResponse: (raw) => {
    const parsed = ResponseSchema.parse(raw);
    return {
      text: parsed.answer,
      usage: {
        prompt_tokens: parsed.inputTokens,
        completion_tokens: parsed.outputTokens,
        total_tokens: parsed.inputTokens + parsed.outputTokens,
      },
    };
  },
});
```

Do not put arbitrary end-user URLs into `endpoint`. Maintain an exact host allowlist, keep credentials server-side, reject redirects, and validate custom responses before downstream execution.

## Updating the catalog

A model-catalog change must include:

1. A vendor-owned source URL.
2. The verification date.
3. Current, preview, or legacy status.
4. Context and output limits when the vendor publishes an unambiguous value.
5. Total and active parameters separately for mixture-of-experts models.
6. A test covering lookup and inference behavior.
7. A statement that any energy multiplier remains modeled unless a compatible measurement is cited.
