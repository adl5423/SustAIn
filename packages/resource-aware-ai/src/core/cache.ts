import type { ChatResponse, Message } from "../types.js";
import { createHash } from "node:crypto";

export class ResponseCache {
  private readonly store = new Map<string, ChatResponse>();

  hash(model: string, messages: Message[]): string {
    const payload = JSON.stringify({ model, messages });
    return createHash("sha256").update(payload).digest("hex");
  }

  get(key: string): ChatResponse | undefined {
    return this.store.get(key);
  }

  set(key: string, value: ChatResponse): void {
    this.store.set(key, value);
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
