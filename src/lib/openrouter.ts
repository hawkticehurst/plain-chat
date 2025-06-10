import OpenAI from "openai";

// OpenRouter configuration
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

// OpenRouter client factory function
export function createOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": window.location.origin,
    },
    dangerouslyAllowBrowser: true, // Required for client-side usage
  });
}

// Server-side OpenRouter client factory (for Convex functions)
export function createServerOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://openrouter.ai/docs/community/frameworks",
    },
  });
}

// Available models - we'll expand this based on OpenRouter API response
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  pricing?: {
    prompt: number;
    completion: number;
  };
  context_length?: number;
  architecture?: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
}

// Common OpenRouter models for initial setup
export const COMMON_MODELS = [
  "openai/gpt-4",
  "openai/gpt-3.5-turbo",
  "anthropic/claude-3-haiku",
  "anthropic/claude-3-sonnet",
  "google/gemini-pro",
  "google/gemini-2.5-flash-preview-05-20",
  "meta-llama/llama-3-8b-instruct",
] as const;

export type CommonModel = (typeof COMMON_MODELS)[number];
