/**
 * Embedding Providers for Memory Search
 *
 * Supports OpenAI, Gemini, and Voyage embedding APIs.
 */

import type { EmbeddingProvider, EmbeddingProviderResult } from "./types.js";

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_OPENAI_MODEL = "text-embedding-3-small";
const DEFAULT_GEMINI_MODEL = "gemini-embedding-001";
const DEFAULT_VOYAGE_MODEL = "voyage-4-large";

const OPENAI_DIMENSIONS: Record<string, number> = {
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
};

const GEMINI_DIMENSIONS: Record<string, number> = {
  "gemini-embedding-001": 768,
};

const VOYAGE_DIMENSIONS: Record<string, number> = {
  "voyage-4-large": 1024,
  "voyage-3-large": 1024,
  "voyage-3": 1024,
  "voyage-2": 1024,
};

// ─── API Response Types ───────────────────────────────────────

interface OpenAIEmbeddingResponse {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
}

interface GeminiEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

interface VoyageEmbeddingResponse {
  data: Array<{
    index: number;
    embedding: number[];
  }>;
}

// ─── OpenAI Embedding Provider ───────────────────────────────

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly id = "openai";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_OPENAI_MODEL;
    this.baseUrl = options.baseUrl ?? "https://api.openai.com/v1";
  }

  getDimensions(): number {
    return OPENAI_DIMENSIONS[this.model] ?? 1536;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/0`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI embedding failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as OpenAIEmbeddingResponse;
    const embeddings: number[][] = data.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    return embeddings;
  }
}

// ─── Gemini Embedding Provider ────────────────────────────────

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly id = "gemini";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_GEMINI_MODEL;
    this.baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  getDimensions(): number {
    return GEMINI_DIMENSIONS[this.model] ?? 768;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Gemini API takes one text at a time for embeddings
    const embeddings: number[][] = [];

    for (const text of texts) {
      const response = await fetch(
        `${this.baseUrl}/models/${this.model}:embedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: {
              parts: [{ text }],
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini embedding failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      embeddings.push(data.embedding.values);
    }

    return embeddings;
  }
}

// ─── Voyage Embedding Provider ────────────────────────────────

export class VoyageEmbeddingProvider implements EmbeddingProvider {
  readonly id = "voyage";
  readonly model: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(options: { apiKey: string; model?: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_VOYAGE_MODEL;
    this.baseUrl = options.baseUrl ?? "https://api.voyageai.com/v1";
  }

  getDimensions(): number {
    return VOYAGE_DIMENSIONS[this.model] ?? 1024;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: this.model,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Voyage embedding failed: ${response.status} - ${error}`);
    }

    const data = await response.json() as VoyageEmbeddingResponse;
    const embeddings: number[][] = data.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    return embeddings;
  }
}

// ─── Provider Factory ─────────────────────────────────────────

export interface CreateEmbeddingProviderOptions {
  provider: "openai" | "gemini" | "voyage" | "auto";
  model?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  geminiApiKey?: string;
  geminiBaseUrl?: string;
  voyageApiKey?: string;
  voyageBaseUrl?: string;
}

export function createEmbeddingProvider(
  options: CreateEmbeddingProviderOptions
): EmbeddingProviderResult {
  const { provider, model } = options;

  // Auto-select: prefer OpenAI, then Gemini, then Voyage
  if (provider === "auto") {
    if (options.openaiApiKey) {
      return {
        provider: new OpenAIEmbeddingProvider({
          apiKey: options.openaiApiKey,
          model,
          baseUrl: options.openaiBaseUrl,
        }),
        requestedProvider: "auto",
      };
    }
    if (options.geminiApiKey) {
      return {
        provider: new GeminiEmbeddingProvider({
          apiKey: options.geminiApiKey,
          model,
          baseUrl: options.geminiBaseUrl,
        }),
        requestedProvider: "auto",
        fallbackFrom: "openai",
        fallbackReason: "OpenAI API key not available",
      };
    }
    if (options.voyageApiKey) {
      return {
        provider: new VoyageEmbeddingProvider({
          apiKey: options.voyageApiKey,
          model,
          baseUrl: options.voyageBaseUrl,
        }),
        requestedProvider: "auto",
        fallbackFrom: "openai",
        fallbackReason: "OpenAI and Gemini API keys not available",
      };
    }
    throw new Error("No embedding API key available for auto selection");
  }

  // Explicit provider selection
  if (provider === "openai") {
    if (!options.openaiApiKey) {
      throw new Error("OpenAI API key required for openai embedding provider");
    }
    return {
      provider: new OpenAIEmbeddingProvider({
        apiKey: options.openaiApiKey,
        model,
        baseUrl: options.openaiBaseUrl,
      }),
      requestedProvider: "openai",
    };
  }

  if (provider === "gemini") {
    if (!options.geminiApiKey) {
      throw new Error("Gemini API key required for gemini embedding provider");
    }
    return {
      provider: new GeminiEmbeddingProvider({
        apiKey: options.geminiApiKey,
        model,
        baseUrl: options.geminiBaseUrl,
      }),
      requestedProvider: "gemini",
    };
  }

  if (provider === "voyage") {
    if (!options.voyageApiKey) {
      throw new Error("Voyage API key required for voyage embedding provider");
    }
    return {
      provider: new VoyageEmbeddingProvider({
        apiKey: options.voyageApiKey,
        model,
        baseUrl: options.voyageBaseUrl,
      }),
      requestedProvider: "voyage",
    };
  }

  throw new Error(`Unknown embedding provider: ${provider}`);
}
