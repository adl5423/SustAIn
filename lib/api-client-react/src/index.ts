export * from "./generated/api";
export * from "./generated/api.schemas";
export {
  setBaseUrl,
  setAuthTokenGetter,
  setAuthTokenOrigins,
  setRequestOrigins,
} from "./custom-fetch";
export type {
  AuthTokenGetter,
  BaseUrlOptions,
  RequestOriginOptions,
} from "./custom-fetch";
