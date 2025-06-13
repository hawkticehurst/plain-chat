import { ConvexHttpClient } from "convex/browser";
import { config } from "./config";

// Get the Convex URL in the correct format
const convexUrl = config.apiBaseUrl.includes(".convex.site")
  ? config.apiBaseUrl.replace(".convex.site", ".convex.cloud")
  : config.apiBaseUrl
      .replace("http://", "https://")
      .replace("https://", "https://") + ".convex.cloud";

// Initialize Convex client
const convex = new ConvexHttpClient(convexUrl);

// Type for streaming message updates
export interface StreamingUpdate {
  _id: string;
  chatId: string;
  userId: string;
  requestId: string;
  content: string;
  status: "streaming" | "completed" | "error";
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  createdAt: number;
  updatedAt: number;
}

// Class to handle database-based streaming with polling
export class ConvexStreamingClient {
  private subscribers: Map<string, (update: StreamingUpdate | null) => void> =
    new Map();
  private activePolling: Map<string, NodeJS.Timeout> = new Map();
  private lastUpdatedTimes: Map<string, number> = new Map();

  // Subscribe to streaming updates for a specific request ID using polling
  public subscribeToStream(
    requestId: string,
    onUpdate: (update: StreamingUpdate | null) => void,
    authToken?: string
  ): () => void {
    console.log(`[ConvexStreaming] Subscribing to stream: ${requestId}`);

    // Store the callback
    this.subscribers.set(requestId, onUpdate);

    // Set auth if provided
    if (authToken) {
      convex.setAuth(authToken);
    }

    // Start polling for updates
    const pollInterval = setInterval(async () => {
      try {
        // Use direct HTTP call instead of the client query method
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (authToken) {
          headers["Authorization"] = `Bearer ${authToken}`;
        }

        const response = await fetch(
          `${config.apiBaseUrl}/streamingMessages/watch?requestId=${requestId}`,
          {
            headers,
          }
        );

        if (response.ok) {
          const result = await response.json();

          // Only call update if we have a result and content has changed
          if (result) {
            const lastUpdated = this.lastUpdatedTimes.get(requestId) || 0;
            if (result.updatedAt > lastUpdated) {
              console.log(
                `[ConvexStreaming] Update received for ${requestId}:`,
                {
                  status: result.status,
                  contentLength: result.content?.length || 0,
                  updatedAt: result.updatedAt,
                }
              );
              this.lastUpdatedTimes.set(requestId, result.updatedAt);
              onUpdate(result);

              // Stop polling if completed or errored
              if (result.status === "completed" || result.status === "error") {
                console.log(
                  `[ConvexStreaming] Stream ${result.status} for ${requestId}`
                );
                this.cleanup(requestId);
              }
            }
          }
        } else if (response.status === 401) {
          console.error(`[ConvexStreaming] Auth error for ${requestId}`);
          this.cleanup(requestId);
        } else if (response.status === 404) {
          // Stream not found yet, continue polling
          console.log(
            `[ConvexStreaming] Stream not found yet for ${requestId}, continuing...`
          );
        } else {
          console.warn(
            `[ConvexStreaming] HTTP ${response.status} for ${requestId}`
          );
        }
      } catch (error) {
        console.error(
          `[ConvexStreaming] Polling error for ${requestId}:`,
          error
        );
        // Continue polling unless it's an auth error
        if (error instanceof Error && error.message?.includes("Unauthorized")) {
          this.cleanup(requestId);
        }
      }
    }, 300); // Poll every 300ms for good balance of responsiveness and performance

    // Store the interval ID
    this.activePolling.set(requestId, pollInterval);

    // Return cleanup function
    return () => this.cleanup(requestId);
  }

  // Clean up specific subscription
  private cleanup(requestId: string): void {
    console.log(`[ConvexStreaming] Cleaning up subscription: ${requestId}`);

    this.subscribers.delete(requestId);
    this.lastUpdatedTimes.delete(requestId);

    const interval = this.activePolling.get(requestId);
    if (interval) {
      clearInterval(interval);
      this.activePolling.delete(requestId);
    }
  }

  // Clean up all subscriptions
  public cleanupAll(): void {
    console.log("[ConvexStreaming] Cleaning up all subscriptions");

    for (const [requestId] of this.activePolling) {
      this.cleanup(requestId);
    }
  }

  // Get the Convex client instance for other operations
  public getClient(): ConvexHttpClient {
    return convex;
  }
}

// Export singleton instance
export const streamingClient = new ConvexStreamingClient();
