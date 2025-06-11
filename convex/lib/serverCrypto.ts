"use node";

// Server-side crypto utilities for Convex actions
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
export function encryptApiKey(apiKey: string): {
  encrypted: string;
  hash: string;
} {
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
export function decryptApiKey(encryptedString: string): string {
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
 * Validate API key hash without exposing the key
 */
export function validateApiKeyHash(
  apiKey: string,
  expectedHash: string
): boolean {
  try {
    const computedHash = createHash("sha256")
      .update(apiKey)
      .digest("hex")
      .substring(0, 16);
    return computedHash === expectedHash;
  } catch (error) {
    return false;
  }
}

/**
 * Validate OpenRouter API key format
 */
export function validateOpenRouterKeyFormat(apiKey: string): boolean {
  // OpenRouter keys start with "sk-or-" followed by base64-like characters
  const pattern = /^sk-or-[A-Za-z0-9+/=_-]{32,}$/;
  return pattern.test(apiKey) && apiKey.length >= 40;
}

/**
 * Generate secure random tokens for session management
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString("hex");
}

/**
 * Hash sensitive data for comparison
 */
export function hashSensitiveData(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}
