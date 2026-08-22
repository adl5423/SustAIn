import type { ChatResponse, Message } from "../types.js";
import { createHash } from "node:crypto";

export class ResponseCache {
  private readonly store = new Map<string, ChatResponse>();

  hash(
    model: string,
    messages: Message[],
    provider?: string,
    namespace?: string,
  ): string {
    const payload = JSON.stringify({
      namespace: namespace ?? "",
      provider: provider ?? "",
      model,
      messages,
    });
    return createHash("sha256").update(payload).digest("hex");
  }

  get(key: string): ChatResponse | undefined {
    const value = this.store.get(key);
    return value ? structuredClone(value) : undefined;
  }

  set(key: string, value: ChatResponse): void {
    this.store.set(key, structuredClone(value));
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }
}
