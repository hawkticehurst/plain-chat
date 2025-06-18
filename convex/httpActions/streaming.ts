import { httpAction } from "../_generated/server";
import { api } from "../_generated/api";
import { getStreamingCorsHeaders, isDevelopment } from "../lib/corsConfig";

// Extract route parameters from custom header set by Hono
function getRouteParams(request: Request): Record<string, string> {
  const paramsHeader = request.headers.get("x-route-params");
  return paramsHeader ? JSON.parse(paramsHeader) : {};
}

// Helper function to check authentication
async function checkAuth(ctx: any, request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const identity = await ctx.auth.getUserIdentity();
    return identity;
  } catch (error) {
    console.error("Auth error:", error);
    return null;
  }
}

export const streamChat = httpAction(async (ctx, request) => {
  const isDev = isDevelopment();

  // Handle preflight OPTIONS request
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: getStreamingCorsHeaders(isDev),
    });
  }

  // Check authentication
  const identity = await checkAuth(ctx, request);
  if (!identity) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        ...getStreamingCorsHeaders(isDev),
      },
    });
  }

  const userId = identity.subject;

  // Extract chatId from route parameters
  const params = getRouteParams(request);
  const chatId = params.chatId;

  if (!chatId) {
    return new Response(JSON.stringify({ error: "Chat ID is required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...getStreamingCorsHeaders(isDev),
      },
    });
  }

  try {
    const body = await request.json();
    const { message, conversation = [] } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...getStreamingCorsHeaders(isDev),
        },
      });
    }

    // Get user's AI preferences
    const preferences = await ctx.runQuery(api.aiKeys.getUserAIPreferences);

    // Handle model name migration from old to new
    if (
      preferences &&
      preferences.defaultModel === "google/gemini-2.0-flash-exp"
    ) {
      preferences.defaultModel = "google/gemini-2.5-flash-preview-05-20";
    }

    const hasValidKey = await ctx.runQuery(api.aiKeys.hasValidApiKey);

    if (!hasValidKey) {
      return new Response(
        JSON.stringify({
          error:
            "No valid API key configured. Please set up your AI API key in Settings.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...getStreamingCorsHeaders(isDev),
          },
        }
      );
    }

    // Get streaming preparation data
    const streamData = await ctx.runAction(
      api.cryptoActions.performStreamingAICompletion,
      {
        message,
        conversation: conversation.slice(-10), // Keep last 10 messages for context
        preferences: preferences
          ? {
              defaultModel: preferences.defaultModel,
              systemPrompt: preferences.systemPrompt,
            }
          : {
              defaultModel: "google/gemini-2.5-flash-preview-05-20",
              systemPrompt: "",
            },
      }
    );

    if (!streamData.success) {
      return new Response(JSON.stringify({ error: streamData.error }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...getStreamingCorsHeaders(isDev),
        },
      });
    }

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        let promptTokens = 0;
        let completionTokens = 0;
        let totalTokens = 0;
        let streamFinished = false;

        try {
          // Make streaming request to OpenRouter
          const response = await fetch(
            "https://openrouter.ai/api/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${streamData.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer":
                  process.env.SITE_URL || "https://localhost:5173",
                "X-Title": "Chat App - Streaming",
              },
              body: JSON.stringify({
                model:
                  streamData.preferences?.defaultModel ||
                  "google/gemini-2.5-flash-preview-05-20",
                messages: streamData.messages,
                temperature: 0.7, // Use default temperature
                max_tokens: 2000, // Use default max tokens
                stream: true,
              }),
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = `AI API error: ${
              errorData.error?.message || `HTTP ${response.status}`
            }`;

            controller.enqueue(
              `data: ${JSON.stringify({
                type: "error",
                error: errorMessage,
                requestId: streamData.requestId,
              })}\n\n`
            );
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: "error",
                error: "No response stream available",
                requestId: streamData.requestId,
              })}\n\n`
            );
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let contentBuffer = "";
          let lastSentTime = Date.now();
          const BATCH_INTERVAL = 75; // Send batched content every 75ms

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              streamFinished = true;
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);

                if (data === "[DONE]") {
                  streamFinished = true;
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  const choice = parsed.choices?.[0];

                  if (choice?.delta?.content) {
                    const content = choice.delta.content;
                    fullResponse += content;
                    contentBuffer += content;

                    // Send batched content to reduce jitter
                    const now = Date.now();
                    if (
                      now - lastSentTime >= BATCH_INTERVAL ||
                      contentBuffer.length >= 10
                    ) {
                      controller.enqueue(
                        `data: ${JSON.stringify({
                          type: "content",
                          content: contentBuffer,
                          requestId: streamData.requestId,
                        })}\n\n`
                      );
                      contentBuffer = "";
                      lastSentTime = now;
                    }
                  }

                  // Track usage data
                  if (parsed.usage) {
                    promptTokens = parsed.usage.prompt_tokens || 0;
                    completionTokens = parsed.usage.completion_tokens || 0;
                    totalTokens = parsed.usage.total_tokens || 0;
                  }
                } catch (parseError) {
                  // Ignore parse errors for individual chunks
                  continue;
                }
              }
            }

            if (streamFinished) break;
          }

          // Send any remaining buffered content
          if (contentBuffer.length > 0) {
            controller.enqueue(
              `data: ${JSON.stringify({
                type: "content",
                content: contentBuffer,
                requestId: streamData.requestId,
              })}\n\n`
            );
          }

          // Send completion message
          controller.enqueue(
            `data: ${JSON.stringify({
              type: "complete",
              content: fullResponse,
              usage: {
                promptTokens,
                completionTokens,
                totalTokens,
                cost: totalTokens * 0.000001, // Rough estimate
              },
              requestId: streamData.requestId,
            })}\n\n`
          );

          // Record successful usage
          try {
            await ctx.runMutation(api.usage.recordUsage, {
              model:
                streamData.preferences?.defaultModel ||
                "google/gemini-2.5-flash-preview-05-20",
              promptTokens,
              completionTokens,
              totalTokens,
              cost: totalTokens * 0.000001,
              success: true,
              requestId: streamData.requestId,
            });
          } catch (usageError) {
            console.error("Error recording usage:", usageError);
          }
        } catch (error) {
          console.error("Streaming error:", error);

          controller.enqueue(
            `data: ${JSON.stringify({
              type: "error",
              error: error.message || "Streaming failed",
              requestId: streamData.requestId,
            })}\n\n`
          );

          // Record failed usage
          try {
            await ctx.runMutation(api.usage.recordUsage, {
              model:
                streamData.preferences?.defaultModel ||
                "google/gemini-2.5-flash-preview-05-20",
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              cost: 0,
              success: false,
              errorMessage: error.message || "Streaming failed",
              requestId: streamData.requestId,
            });
          } catch (usageError) {
            console.error("Error recording failed usage:", usageError);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...getStreamingCorsHeaders(isDev),
      },
    });
  } catch (error) {
    console.error("Error in streaming AI chat:", error);
    return new Response(
      JSON.stringify({ error: "Failed to start streaming" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...getStreamingCorsHeaders(isDev),
        },
      }
    );
  }
});
