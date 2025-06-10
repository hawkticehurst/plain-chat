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
  const pattern = /^sk-or-[A-Za-z0-9+/=_-]{32,}$/;
  return pattern.test(apiKey) && apiKey.length >= 40;
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
        const errorData = await response.json();
        return {
          valid: false,
          error: errorData.error?.message || `HTTP ${response.status}`,
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        error: error.message || "Network error",
      };
    }
  },
});
