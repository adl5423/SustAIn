import type { ChatResponse, Message } from "../types.js";

/**
 * Compute cosine similarity between two equal-length numeric vectors.
 *
 * Returns a number in `[-1, 1]`. For typical embedding vectors (which are
 * non-negative or close to it), the practical range is `[0, 1]`.
 *
 * Returns `0` (rather than throwing) when:
 *   - the two vectors have different lengths,
 *   - either vector is empty,
 *   - either vector is all-zeros (undefined cosine).
 *
 * Invalid embedder output returns zero similarity, which prevents a cache hit
 * without failing the request path.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (!Number.isFinite(ai) || !Number.isFinite(bi)) return 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Canonicalize a list of `Message`s into the single string we hand to the
 * embedder. Including roles helps separate "user: weather?" from
 * "assistant: weather?" so they don't get treated as the same query.
 */
export function canonicalizeMessages(messages: Message[]): string {
  return messages.map((m) => `${m.role}: ${m.content}`).join("\n");
}

interface SemanticEntry {
  embedding: number[];
  response: ChatResponse;
  /** Free-form provenance string used for debugging and inspection. */
  source: string;
  /** Exact isolation boundary, such as tenant, provider, and model. */
  scope: string;
}

export interface SemanticCacheHit {
  response: ChatResponse;
  similarity: number;
  source: string;
}

/**
 * In-memory semantic cache. Stores `(embedding, response)` pairs and returns a
 * cached response when cosine similarity meets the configured threshold.
 *
 * Eviction is FIFO once `maxSize` entries are stored. Lookup is a linear
 * scan suited to caches with a few hundred or thousand entries. Larger
 * workloads should provide a vector store through `findSimilar` and `add`.
 */
export class SemanticCache {
  private readonly entries: SemanticEntry[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    if (!Number.isFinite(maxSize) || maxSize <= 0) {
      throw new Error("SemanticCache: maxSize must be a positive number");
    }
    this.maxSize = Math.floor(maxSize);
  }

  add(
    embedding: number[],
    response: ChatResponse,
    source = "",
    scope = source,
  ): void {
    if (embedding.length === 0) return;
    if (this.entries.length >= this.maxSize) this.entries.shift();
    this.entries.push({
      embedding: [...embedding],
      response: structuredClone(response),
      source,
      scope,
    });
  }

  /**
   * Find the closest stored entry whose cosine similarity to `embedding`
   * meets or exceeds `threshold`. Returns `null` if nothing qualifies.
   */
  findSimilar(
    embedding: number[],
    threshold: number,
    scope?: string,
  ): SemanticCacheHit | null {
    if (embedding.length === 0) return null;
    let best: SemanticCacheHit | null = null;
    for (const entry of this.entries) {
      if (scope !== undefined && entry.scope !== scope) continue;
      const sim = cosineSimilarity(embedding, entry.embedding);
      if (sim >= threshold && (best === null || sim > best.similarity)) {
        best = {
          response: structuredClone(entry.response),
          similarity: sim,
          source: entry.source,
        };
      }
    }
    return best;
  }

  size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries.length = 0;
  }
}
