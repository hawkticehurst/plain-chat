"use node";

// Server-side crypto actions for Convex
import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  scryptSync,
} from "crypto";

// Environment variable for encryption key (set in Convex dashboard)
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "default-key-please-change-in-production";

/**
 * Server-side API key encryption using AES-256-GCM
 */
function encryptApiKey(apiKey: string): { encrypted: string; hash: string } {
  try {
    // Generate random salt and IV
    const salt = randomBytes(16);
    const iv = randomBytes(16);

    // Derive key from password using scrypt
    const key = scryptSync(ENCRYPTION_KEY, salt, 32);

    // Create cipher
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    // Encrypt the API key
    let encrypted = cipher.update(apiKey, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag();

    // Combine salt, iv, authTag, and encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, "hex"),
    ]);

    const encryptedString = combined.toString("base64");

    // Create hash for verification without exposing the key
    const hash = createHash("sha256")
      .update(apiKey)
      .digest("hex")
      .substring(0, 16);

    return { encrypted: encryptedString, hash };
  } catch (error: any) {
    throw new Error(`Failed to encrypt API key: ${error.message}`);
  }
}

/**
 * Server-side API key decryption
 */
function decryptApiKey(encryptedString: string): string {
  try {
    console.log(
      `[Decrypt] Starting decryption, encrypted string length: ${encryptedString.length}`
    );
    console.log(
      `[Decrypt] ENCRYPTION_KEY available: ${!!ENCRYPTION_KEY}, length: ${ENCRYPTION_KEY.length}`
    );

    // Parse the combined data
    const combined = Buffer.from(encryptedString, "base64");

    if (combined.length < 48) {
      throw new Error("Invalid encrypted data format");
    }

    const salt = combined.subarray(0, 16);
    const iv = combined.subarray(16, 32);
    const authTag = combined.subarray(32, 48);
    const encrypted = combined.subarray(48);

    console.log(
      `[Decrypt] Parsed data - salt: ${salt.length}, iv: ${iv.length}, authTag: ${authTag.length}, encrypted: ${encrypted.length}`
    );

    // Derive key from password using same parameters
    const key = scryptSync(ENCRYPTION_KEY, salt, 32);

    // Create decipher
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt the data
    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error: any) {
    throw new Error(`Failed to decrypt API key: ${error.message}`);
  }
}

/**
 * Validate OpenRouter API key format
 */
function validateOpenRouterKeyFormat(apiKey: string): boolean {
  // OpenRouter keys start with "sk-or-" followed by base64-like characters
  // Updated pattern to be more flexible with characters
  const pattern = /^sk-or-[A-Za-z0-9+/=_-]{20,}$/;
  return pattern.test(apiKey) && apiKey.length >= 32;
}

// Store or update user's OpenRouter API key (server-side action for security)
export const setUserApiKey = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, { apiKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    // Validate API key format
    if (!validateOpenRouterKeyFormat(apiKey)) {
      throw new Error("Invalid OpenRouter API key format");
    }

    // Encrypt the API key server-side
    const { encrypted, hash } = encryptApiKey(apiKey);

    // Use internal queries and mutations to handle database operations
    const existingKey = await ctx.runQuery(
      internal.aiKeys.getUserApiKeyRecord,
      {
        userId: identity.subject,
      }
    );

    const now = Date.now();

    if (existingKey) {
      // Update existing key
      await ctx.runMutation(internal.aiKeys.updateUserApiKey, {
        keyId: existingKey._id,
        encryptedApiKey: encrypted,
        keyHash: hash,
        isValid: true,
        lastValidated: now,
      });
    } else {
      // Create new key record
      await ctx.runMutation(internal.aiKeys.createUserApiKey, {
        userId: identity.subject,
        encryptedApiKey: encrypted,
        keyHash: hash,
        isValid: true,
        lastValidated: now,
      });
    }

    return { success: true };
  },
});

// Action to get decrypted API key (server-side for security)
export const getUserApiKey = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    const apiKeyRecord = await ctx.runQuery(
      internal.aiKeys.getUserApiKeyRecord,
      {
        userId: identity.subject,
      }
    );

    if (!apiKeyRecord || !apiKeyRecord.isValid) {
      throw new Error("No valid API key found");
    }

    try {
      // Server-side decryption
      const decryptedKey = decryptApiKey(apiKeyRecord.encryptedApiKey);
      return decryptedKey;
    } catch (error) {
      // Mark key as invalid if decryption fails
      await ctx.runMutation(internal.aiKeys.markApiKeyInvalid, {
        keyId: apiKeyRecord._id,
      });
      throw new Error("Failed to decrypt API key");
    }
  },
});

// Test API key validity by making a small request to OpenRouter
export const testApiKey = action({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, { apiKey }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    // Validate format first
    if (!validateOpenRouterKeyFormat(apiKey)) {
      return { valid: false, error: "Invalid API key format" };
    }

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.SITE_URL || "https://localhost:3000",
            "X-Title": "Chat App",
          },
          body: JSON.stringify({
            model: "openai/gpt-3.5-turbo",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 5,
          }),
        }
      );

      if (response.ok) {
        return { valid: true };
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: `HTTP ${response.status}` } }));
        console.error("OpenRouter API error:", response.status, errorData);
        return {
          valid: false,
          error:
            errorData.error?.message ||
            `API returned status ${response.status}`,
        };
      }
    } catch (error: any) {
      console.error("Network error testing API key:", error);
      return {
        valid: false,
        error: error.message || "Network error - please check your connection",
      };
    }
  },
});

/**
 * Generate a chat title using AI based on the first message
 */
export const generateChatTitle = action({
  args: {
    firstMessage: v.string(),
  },
  handler: async (ctx, { firstMessage }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    try {
      // Get user's encrypted API key
      const apiKeyRecord = await ctx.runQuery(
        internal.aiKeys.getUserApiKeyRecord,
        {
          userId: identity.subject,
        }
      );
      if (!apiKeyRecord) {
        return {
          success: false,
          error: "No API key found",
          title: "New Conversation",
        };
      }

      // Decrypt the API key
      const apiKey = decryptApiKey(apiKeyRecord.encryptedApiKey);

      // Use a fast model for title generation
      const titlePrompt = `Generate a concise, descriptive title (3-5 words max) for a conversation that starts with this message: "${firstMessage.slice(0, 200)}". Only return the title, nothing else.`;

      // Make API request to OpenRouter with a fast model
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.SITE_URL || "https://localhost:3000",
            "X-Title": "Chat App - Title Generation",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-preview-05-20", // Fast, cheap model for titles
            messages: [
              {
                role: "user",
                content: titlePrompt,
              },
            ],
            temperature: 0.3, // Lower temperature for more consistent titles
            max_tokens: 20, // Short titles only
          }),
        }
      );

      if (!response.ok) {
        console.error("Title generation API error:", response.status);
        return {
          success: false,
          error: `API error: ${response.status}`,
          title: "New Conversation",
        };
      }

      const data = await response.json();
      const generatedTitle = data.choices?.[0]?.message?.content?.trim();

      if (generatedTitle && generatedTitle.length > 0) {
        return {
          success: true,
          title: generatedTitle.slice(0, 50), // Limit title length
        };
      } else {
        return {
          success: false,
          error: "No title generated",
          title: "New Conversation",
        };
      }
    } catch (error: any) {
      console.error("Error generating chat title:", error);
      return {
        success: false,
        error: error.message || "Unknown error",
        title: "New Conversation",
      };
    }
  },
});

/**
 * Perform streaming AI completion using user's stored API key
 * This is used by the SSE endpoint to stream responses
 */
export const performStreamingAICompletion = action({
  args: {
    message: v.string(),
    conversation: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        timestamp: v.optional(v.number()),
      })
    ),
    preferences: v.object({
      defaultModel: v.string(),
      temperature: v.number(),
      maxTokens: v.number(),
      systemPrompt: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { message, conversation, preferences }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User must be authenticated");
    }

    try {
      // Get user's encrypted API key
      const apiKeyRecord = await ctx.runQuery(
        internal.aiKeys.getUserApiKeyRecord,
        {
          userId: identity.subject,
        }
      );
      if (!apiKeyRecord) {
        return {
          success: false,
          error: "No API key found. Please configure your API key in Settings.",
        };
      }

      // Decrypt the API key
      const apiKey = decryptApiKey(apiKeyRecord.encryptedApiKey);

      // Prepare messages for AI API
      const messages: Array<{ role: string; content: string }> = [];

      // Add system prompt if provided
      if (preferences.systemPrompt && preferences.systemPrompt.trim()) {
        messages.push({
          role: "system",
          content: preferences.systemPrompt.trim(),
        });
      }

      // Add conversation history
      conversation.forEach((msg) => {
        messages.push({
          role: msg.role === "prompt" ? "user" : "assistant",
          content: msg.content,
        });
      });

      // Add current message
      messages.push({
        role: "user",
        content: message,
      });

      const requestId = randomBytes(8).toString("hex");

      // Return the necessary data for streaming instead of making the API call here
      // The server will handle the actual streaming API call
      return {
        success: true,
        apiKey,
        messages,
        preferences,
        requestId,
      };
    } catch (error: any) {
      console.error("Streaming AI completion error:", error);
      return {
        success: false,
        error: error.message || "Internal server error",
        requestId: randomBytes(8).toString("hex"),
      };
    }
  },
});

/**
 * Internal version of AI completion for background streaming
 * Used by internal actions that already have verified user context
 */
export const performStreamingAICompletionInternal = internalAction({
  args: {
    userId: v.string(),
    messageId: v.id("messages"), // For audit logging and security verification
    message: v.string(),
    conversation: v.array(
      v.object({
        role: v.string(),
        content: v.string(),
        timestamp: v.optional(v.number()),
      })
    ),
    preferences: v.object({
      defaultModel: v.string(),
      temperature: v.number(),
      maxTokens: v.number(),
      systemPrompt: v.optional(v.string()),
    }),
  },
  handler: async (
    ctx,
    { userId, messageId, message, conversation, preferences }
  ) => {
    console.log(
      `[AI Internal] Starting streaming completion for user ${userId}, message ${messageId}`
    );

    try {
      // SECURITY: Verify the message actually belongs to this user
      const messageRecord = await ctx.runQuery(
        internal.messages.getMessageByIdInternal,
        {
          messageId,
        }
      );

      if (!messageRecord || messageRecord.userId !== userId) {
        throw new Error("Message access denied - user mismatch");
      }

      console.log(`[AI Internal] Security check passed for user ${userId}`);

      // Get user's encrypted API key using the verified userId
      const apiKeyRecord = await ctx.runQuery(
        internal.aiKeys.getUserApiKeyRecord,
        {
          userId,
        }
      );

      if (!apiKeyRecord) {
        return {
          success: false,
          error: "No API key found. Please configure your API key in Settings.",
        };
      }

      console.log(`[AI Internal] API key found for user ${userId}`);

      // Debug encryption key availability
      console.log(
        `[AI Internal] Encryption key available: ${!!process.env.ENCRYPTION_KEY}`
      );
      console.log(
        `[AI Internal] Encryption key length: ${process.env.ENCRYPTION_KEY?.length || 0}`
      );

      // Decrypt the API key
      const apiKey = decryptApiKey(apiKeyRecord.encryptedApiKey);

      // Prepare messages for AI API
      const messages: Array<{ role: string; content: string }> = [];

      // Add system prompt if provided
      if (preferences.systemPrompt && preferences.systemPrompt.trim()) {
        messages.push({
          role: "system",
          content: preferences.systemPrompt.trim(),
        });
      }

      // Add conversation history
      for (const msg of conversation) {
        messages.push({
          role: msg.role === "prompt" ? "user" : "assistant",
          content: msg.content,
        });
      }

      // Add current user message
      messages.push({
        role: "user",
        content: message,
      });

      console.log(
        `[AI Internal] Prepared ${messages.length} messages for API call`
      );

      // Make API call to OpenRouter
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
            model: preferences.defaultModel,
            messages,
            temperature: preferences.temperature,
            max_tokens: preferences.maxTokens,
            stream: true, // Enable streaming
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[AI Internal] API error for user ${userId}:`, errorText);
        return {
          success: false,
          error: `AI API error: ${response.status} ${response.statusText}`,
        };
      }

      console.log(
        `[AI Internal] Streaming response started for user ${userId}`
      );

      // We can't return a Response object from Convex actions
      // Instead, return success status and model info
      return {
        success: true,
        model: preferences.defaultModel,
        streamReady: true,
      };
    } catch (error: any) {
      console.error(`[AI Internal] Error for user ${userId}:`, error);
      return {
        success: false,
        error: error.message || "Unknown error occurred",
      };
    }
  },
});

/**
 * This is used by the SSE endpoint to stream responses
 */
