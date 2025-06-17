import { authService, config } from "@lib";

interface TitleGenerationRequest {
  chatId: string;
  firstMessage: string;
  apiBaseUrl: string;
  authToken: string;
}

interface TitleGenerationResponse {
  success: boolean;
  chatId: string;
  title?: string;
  error?: string;
}

/**
 * Service for managing chat title generation using web workers
 * Allows title generation to happen in parallel with AI responses
 */
export class TitleGenerationService {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (title: string | null) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Create the worker from the TypeScript file
      // Vite will handle the compilation and bundling
      this.worker = new Worker(
        new URL("../workers/titleGenerator.worker.ts", import.meta.url),
        { type: "module" }
      );

      this.worker.addEventListener(
        "message",
        this.handleWorkerMessage.bind(this)
      );

      this.worker.addEventListener("error", (error) => {
        console.error("❌ Title generation worker error:", error);
        // Reject all pending requests
        for (const [, { reject }] of this.pendingRequests) {
          reject(new Error("Worker error occurred"));
        }
        this.pendingRequests.clear();
      });
    } catch (error) {
      console.error("❌ Failed to initialize title generation worker:", error);
    }
  }

  private handleWorkerMessage(event: MessageEvent<TitleGenerationResponse>) {
    const { success, chatId, title, error } = event.data;

    const pending = this.pendingRequests.get(chatId);
    if (!pending) {
      console.warn(`⚠️ Received title response for unknown chat: ${chatId}`);
      return;
    }

    this.pendingRequests.delete(chatId);

    if (success && title) {
      pending.resolve(title);
    } else {
      console.error(`❌ Title generation failed for chat ${chatId}:`, error);
      pending.resolve(null); // Resolve with null instead of rejecting
    }
  }

  /**
   * Generates a chat title in a web worker
   * Returns a promise that resolves when the title is ready
   */
  public async generateTitle(
    chatId: string,
    firstMessage: string
  ): Promise<string | null> {
    if (!this.worker) {
      console.warn(
        "⚠️ Title generation worker not available, falling back to main thread"
      );
      return this.fallbackTitleGeneration(chatId, firstMessage);
    }

    if (this.pendingRequests.has(chatId)) {
      console.warn(
        `⚠️ Title generation already in progress for chat ${chatId}`
      );
      return null;
    }

    return new Promise(async (resolve, reject) => {
      this.pendingRequests.set(chatId, { resolve, reject });

      const authToken = await authService.getToken();
      if (!authToken) {
        this.pendingRequests.delete(chatId);
        reject(new Error("No authentication token available"));
        return;
      }

      const request: TitleGenerationRequest = {
        chatId,
        firstMessage,
        apiBaseUrl: config.apiBaseUrl,
        authToken,
      };

      this.worker!.postMessage(request);

      // Set a timeout to prevent hanging requests
      setTimeout(() => {
        if (this.pendingRequests.has(chatId)) {
          this.pendingRequests.delete(chatId);
          console.warn(`⏰ Title generation timeout for chat ${chatId}`);
          resolve(null); // Resolve with null instead of rejecting
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Fallback title generation in the main thread if worker is not available
   */
  private async fallbackTitleGeneration(
    chatId: string,
    firstMessage: string
  ): Promise<string | null> {
    try {
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/chats/${chatId}/generate-title`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstMessage,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.success ? data.title : null;
      }

      return null;
    } catch (error) {
      console.error("Error in fallback title generation:", error);
      return null;
    }
  }

  /**
   * Cleanup method to terminate the worker
   */
  public cleanup() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reject all pending requests
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error("Service is being cleaned up"));
    }
    this.pendingRequests.clear();
  }
}

// Create a singleton instance
export const titleGenerationService = new TitleGenerationService();
