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
 * This is intentionally tolerant so a misconfigured embedder degrades to
 * "no semantic hits" instead of crashing the whole request path.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
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
  /** Free-form provenance string — useful for debugging / introspection. */
  source: string;
}

export interface SemanticCacheHit {
  response: ChatResponse;
  similarity: number;
  source: string;
}

/**
 * In-memory semantic cache. Stores `(embedding, response)` pairs and serves
 * a previously computed response when a new query's embedding is "close
 * enough" (cosine similarity ≥ threshold) to a stored one.
 *
 * Eviction is FIFO once `maxSize` entries are stored. Lookup is a linear
 * scan, which is fine for the typical few-hundred-to-few-thousand entry
 * caches this is designed for. For larger workloads, plug in your own
 * vector store via `findSimilar` / `add`.
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

  add(embedding: number[], response: ChatResponse, source = ""): void {
    if (embedding.length === 0) return;
    if (this.entries.length >= this.maxSize) this.entries.shift();
    this.entries.push({ embedding, response, source });
  }

  /**
   * Find the closest stored entry whose cosine similarity to `embedding`
   * meets or exceeds `threshold`. Returns `null` if nothing qualifies.
   */
  findSimilar(embedding: number[], threshold: number): SemanticCacheHit | null {
    if (embedding.length === 0) return null;
    let best: SemanticCacheHit | null = null;
    for (const entry of this.entries) {
      const sim = cosineSimilarity(embedding, entry.embedding);
      if (sim >= threshold && (best === null || sim > best.similarity)) {
        best = { response: entry.response, similarity: sim, source: entry.source };
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
