"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { decryptApiKey } from "./lib/serverCrypto";

// Node.js action to perform the streaming API call and handle the response
export const performStreamingWithNode = internalAction({
  args: {
    messageId: v.id("messages"),
    apiKeyRecord: v.object({
      _id: v.id("userApiKeys"),
      encryptedApiKey: v.string(),
    }),
    messages: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
      })
    ),
    model: v.string(),
    temperature: v.number(),
    maxTokens: v.number(),
  },
  handler: async (ctx, args) => {
    try {
      // Decrypt the API key
      const apiKey = decryptApiKey(args.apiKeyRecord.encryptedApiKey);

      // Make the streaming API call
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://giant-camel-264.convex.site",
            "X-Title": "Plain Chat",
          },
          body: JSON.stringify({
            model: args.model,
            messages: args.messages,
            temperature: args.temperature,
            max_tokens: args.maxTokens,
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        await ctx.runMutation(internal.aiStreaming.updateMessageWithError, {
          messageId: args.messageId,
          error: `AI API error: ${response.status} ${response.statusText}`,
        });
        return { success: false, error: errorText };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        await ctx.runMutation(internal.aiStreaming.updateMessageWithError, {
          messageId: args.messageId,
          error: "No response stream available",
        });
        return { success: false, error: "No response stream available" };
      }

      const decoder = new TextDecoder();
      let fullContent = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let totalTokens = 0;
      let lastUpdateTime = 0;
      let updateCounter = 0;
      const UPDATE_INTERVAL_MS = 50; // Update database every 50ms for smoother streaming
      const MIN_CHARS_PER_UPDATE = 3; // Minimum characters before forcing an update

      // Stream and update database in real-time
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              break;
            }

            try {
              const parsed = JSON.parse(data);
              const choice = parsed.choices?.[0];

              if (choice?.delta?.content) {
                const content = choice.delta.content;
                fullContent += content;
                updateCounter += content.length;

                // Update database more frequently for smoother streaming
                const now = Date.now();
                const timeSinceLastUpdate = now - lastUpdateTime;
                const shouldUpdate =
                  timeSinceLastUpdate >= UPDATE_INTERVAL_MS ||
                  updateCounter >= MIN_CHARS_PER_UPDATE;

                if (shouldUpdate) {
                  await ctx.runMutation(
                    internal.aiStreaming.updateMessageContent,
                    {
                      messageId: args.messageId,
                      content: fullContent,
                    }
                  );
                  lastUpdateTime = now;
                  updateCounter = 0;
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
      }

      // Mark message as completed
      await ctx.runMutation(internal.aiStreaming.completeMessage, {
        messageId: args.messageId,
        finalContent: fullContent,
        usage: {
          model: args.model,
          promptTokens,
          completionTokens,
          totalTokens,
          cost: totalTokens * 0.000001,
        },
      });

      return {
        success: true,
        fullContent,
        usage: {
          model: args.model,
          promptTokens,
          completionTokens,
          totalTokens,
          cost: totalTokens * 0.000001,
        },
      };
    } catch (error: any) {
      console.error(`[AI Node] Error for message ${args.messageId}:`, error);

      await ctx.runMutation(internal.aiStreaming.updateMessageWithError, {
        messageId: args.messageId,
        error: error.message || "Streaming failed",
      });

      return { success: false, error: error.message || "Streaming failed" };
    }
  },
});
