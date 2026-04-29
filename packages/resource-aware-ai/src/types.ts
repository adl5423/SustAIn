export type Role = "user" | "system" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export type Mode = "performance" | "balanced" | "water_saver";

export interface Constraints {
  max_water_ml?: number;
  max_kwh?: number;
}

export interface ChatOptions {
  model: string;
  provider: string;
  messages: Message[];
  mode?: Mode;
  constraints?: Constraints;
}

export interface ResourceMetrics {
  energy_kwh: number;
  water_ml: number;
  baseline_water_ml: number;
  water_saved_percent: number;
  tokens_estimated: number;
  cache_hit: boolean;
}

export interface ChatResponse {
  output: string;
  metrics: ResourceMetrics;
  footnote: string;
}

export interface ProviderResponse {
  text: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface ProviderAdapter {
  generate(options: { model: string; messages: Message[] }): Promise<ProviderResponse>;
}

export type EstimatorFn = (tokens: number, model: string) => number;

export interface ResourceAwareAIConfig {
  regionFactor?: number;
  baselineFactor?: number;
  enableCache?: boolean;
  customEstimator?: EstimatorFn;
}

export interface ResourceLimitError {
  code: "RESOURCE_LIMIT_EXCEEDED";
  details: {
    water_ml?: number;
    water_limit?: number;
    energy_kwh?: number;
    energy_limit?: number;
  };
}

export interface ProviderError {
  code: "PROVIDER_ERROR";
  message: string;
  provider: string;
}

export interface UnknownProviderError {
  code: "UNKNOWN_PROVIDER";
  message: string;
  provider: string;
  availableProviders: string[];
}

export type SDKError = ResourceLimitError | ProviderError | UnknownProviderError;

export class ResourceAwareAIError extends Error {
  public readonly sdkError: SDKError;

  constructor(sdkError: SDKError) {
    const msg =
      sdkError.code === "RESOURCE_LIMIT_EXCEEDED"
        ? `Resource limit exceeded: ${JSON.stringify(sdkError.details)}`
        : sdkError.code === "UNKNOWN_PROVIDER"
          ? sdkError.message
          : sdkError.message;
    super(msg);
    this.name = "ResourceAwareAIError";
    this.sdkError = sdkError;
  }
}

export interface ModelProfile {
  id: string;
  provider: string;
  class: "small" | "medium" | "large";
  parametersBillions?: number;
  contextWindow?: number;
}
