// Client-side OpenRouter API utilities
import { createOpenRouterClient } from "./openrouter";
import type {
  ChatCompletionMessage,
  AIMessageMetadata,
} from "./types/openrouter";

export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  metadata: AIMessageMetadata;
}

export interface StreamingChatResponse {
  stream: ReadableStream<string>;
  metadata: Promise<AIMessageMetadata>;
}

// Send a chat completion request to OpenRouter
export async function sendChatCompletion(
  apiKey: string,
  messages: ChatCompletionMessage[],
  options: ChatCompletionOptions = {}
): Promise<ChatResponse> {
  const client = createOpenRouterClient(apiKey);

  const startTime = Date.now();

  try {
    const response = await client.chat.completions.create({
      model: options.model || "openai/gpt-3.5-turbo",
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: false,
    });

    const endTime = Date.now();
    const choice = response.choices[0];

    if (!choice?.message?.content) {
      throw new Error("No response content received");
    }

    const metadata: AIMessageMetadata = {
      model: response.model,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      responseTime: endTime - startTime,
      finishReason: choice.finish_reason || undefined,
    };

    return {
      content: choice.message.content,
      metadata,
    };
  } catch (error) {
    throw new Error(
      `OpenRouter API error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Send a streaming chat completion request to OpenRouter
export async function sendStreamingChatCompletion(
  apiKey: string,
  messages: ChatCompletionMessage[],
  options: ChatCompletionOptions = {}
): Promise<StreamingChatResponse> {
  const client = createOpenRouterClient(apiKey);

  const startTime = Date.now();
  let totalContent = "";
  let model = "";
  let finishReason = "";

  try {
    const stream = await client.chat.completions.create({
      model: options.model || "openai/gpt-3.5-turbo",
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });

    const readableStream = new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (choice?.delta?.content) {
              const content = choice.delta.content;
              totalContent += content;
              controller.enqueue(content);
            }

            if (chunk.model) {
              model = chunk.model;
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    const metadataPromise = new Promise<AIMessageMetadata>((resolve) => {
      const checkComplete = () => {
        if (finishReason || totalContent.length > 0) {
          const endTime = Date.now();
          resolve({
            model: model || options.model || "openai/gpt-3.5-turbo",
            promptTokens: 0, // Not available in streaming
            completionTokens: 0, // Not available in streaming
            totalTokens: 0, // Not available in streaming
            responseTime: endTime - startTime,
            finishReason: finishReason || undefined,
          });
        } else {
          setTimeout(checkComplete, 100);
        }
      };
      checkComplete();
    });

    return {
      stream: readableStream,
      metadata: metadataPromise,
    };
  } catch (error) {
    throw new Error(
      `OpenRouter streaming API error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Test API key validity
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await sendChatCompletion(
      apiKey,
      [{ role: "user", content: "Hello" }],
      { model: "openai/gpt-3.5-turbo", maxTokens: 5 }
    );
    return response.content.length > 0;
  } catch (error) {
    return false;
  }
}

// Get available models from OpenRouter
export async function getAvailableModels(apiKey: string): Promise<any[]> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Failed to fetch models:", error);
    return [];
  }
}
