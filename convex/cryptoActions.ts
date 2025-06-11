"use node";

// Server-side crypto actions for Convex
import { v } from "convex/values";
import { action } from "./_generated/server";
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
    // Parse the combined data
    const combined = Buffer.from(encryptedString, "base64");

    if (combined.length < 48) {
      throw new Error("Invalid encrypted data format");
    }

    const salt = combined.subarray(0, 16);
    const iv = combined.subarray(16, 32);
    const authTag = combined.subarray(32, 48);
    const encrypted = combined.subarray(48);

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
 * Perform AI completion using user's stored API key
 */
export const performAICompletion = action({
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

      // Make API request to OpenRouter
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
            model: preferences.defaultModel,
            messages,
            temperature: preferences.temperature,
            max_tokens: preferences.maxTokens,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.error?.message || `API Error: ${response.status}`,
          requestId,
        };
      }

      const data = await response.json();

      if (!data.choices || data.choices.length === 0) {
        return {
          success: false,
          error: "No response from AI model",
          requestId,
        };
      }

      const assistantMessage = data.choices[0].message?.content;
      if (!assistantMessage) {
        return {
          success: false,
          error: "Empty response from AI model",
          requestId,
        };
      }

      // Calculate cost (OpenRouter provides usage data)
      const usage = data.usage || {};
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || promptTokens + completionTokens;

      // Estimate cost (this is a rough estimate, real cost calculation would need model-specific pricing)
      const estimatedCost = totalTokens * 0.000001; // Very rough estimate

      return {
        success: true,
        response: assistantMessage,
        model: preferences.defaultModel,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          cost: estimatedCost,
        },
        requestId,
      };
    } catch (error: any) {
      console.error("AI completion error:", error);
      return {
        success: false,
        error: error.message || "Internal server error",
        requestId: randomBytes(8).toString("hex"),
      };
    }
  },
});
