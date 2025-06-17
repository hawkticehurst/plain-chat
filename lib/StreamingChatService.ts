import { authService, config } from "@lib";

export interface Message {
  role: "prompt" | "response";
  content: string;
  timestamp?: number;
  isLoading?: boolean;
  isStreaming?: boolean;
}

export interface StreamingChatCallbacks {
  onMessageUpdate: (message: Message) => void;
  onStreamingComplete: () => void;
  onError: (error: string) => void;
}

export interface CreateChatResult {
  chatId: string;
  success: boolean;
  error?: string;
}

export interface StreamMessageOptions {
  chatId: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  isFirstMessage: boolean;
  model?: string; // Selected model from the UI
}

export class StreamingChatService {
  private _activePollingInterval: number | null = null;
  private _isStreaming: boolean = false;

  constructor() {}

  public get isStreaming(): boolean {
    return this._isStreaming;
  }

  /**
   * Creates a new chat and returns the chat ID
   */
  public async createChat(
    title: string = "New Conversation"
  ): Promise<CreateChatResult> {
    try {
      const response = await authService.fetchWithAuthRetry(
        `${config.apiBaseUrl}/chats`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          chatId: data.chatId,
          success: true,
        };
      } else {
        return {
          chatId: "",
          success: false,
          error: `Failed to create chat: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        chatId: "",
        success: false,
        error: `Network error creating chat: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Saves a user message to the database
   */
  public async saveUserMessage(
    chatId: string,
    content: string
  ): Promise<boolean> {
    try {
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/chats/${chatId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "prompt",
            content,
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error("Error saving user message:", error);
      return false;
    }
  }

  /**
   * Initiates streaming response and manages the polling for updates
   */
  public async startStreamingResponse(
    options: StreamMessageOptions,
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    if (this._isStreaming) {
      callbacks.onError("Already streaming a response");
      return;
    }

    this._isStreaming = true;

    try {
      // Create AI message with scheduled streaming
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/chats/${options.chatId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: options.userMessage,
            conversation: options.conversationHistory,
            useConvexStreaming: true,
            model: options.model, // Pass the selected model
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Message post failed:", errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const messageId = data.messageId;

      if (!messageId) {
        throw new Error("No message ID returned from server");
      }

      // Create initial streaming message
      const streamingMessage: Message = {
        role: "response",
        content: "...",
        timestamp: Date.now(),
        isStreaming: true,
      };

      // Notify callback immediately with initial message
      callbacks.onMessageUpdate(streamingMessage);

      // Start polling for updates
      await this._startPolling(messageId, streamingMessage, options, callbacks);
    } catch (error) {
      this._isStreaming = false;
      const errorMsg = `Streaming error: ${error instanceof Error ? error.message : "Unknown error"}`;
      callbacks.onError(errorMsg);
    }
  }

  /**
   * Cancels active streaming operation
   */
  public cancelStreaming(): string | null {
    if (!this._isStreaming) {
      return null;
    }

    if (this._activePollingInterval) {
      clearInterval(this._activePollingInterval);
      this._activePollingInterval = null;
    }

    this._isStreaming = false;
    return "❌ *Response cancelled by user*";
  }

  /**
   * Generates a title for the chat based on the first message
   */
  public async generateChatTitle(
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
      console.error("Error generating chat title:", error);
      return null;
    }
  }

  /**
   * Loads messages for a specific chat
   */
  public async loadChatMessages(chatId: string): Promise<Message[]> {
    try {
      const response = await authService.fetchWithAuthRetry(
        `${config.apiBaseUrl}/chats/${chatId}/messages`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages && Array.isArray(data.messages)) {
          return data.messages.map((msg: any) => ({
            role: msg.role || "response",
            content: msg.content || "No content",
            timestamp: msg.createdAt,
          }));
        }
      } else {
        console.error("Failed to load chat messages:", response.status);
        return [
          {
            role: "response",
            content:
              response.status === 401
                ? "❌ Authentication error. Please refresh the page and try again."
                : "❌ Failed to load chat messages. Please try refreshing the page.",
            timestamp: Date.now(),
          },
        ];
      }
    } catch (error) {
      console.error("Error loading chat messages:", error);
      return [
        {
          role: "response",
          content:
            "❌ Network error loading messages. Please check your connection.",
          timestamp: Date.now(),
        },
      ];
    }

    return [];
  }

  /**
   * Deletes a chat and all its messages
   */
  public async deleteChat(chatId: string): Promise<boolean> {
    try {
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/chats/${chatId}`,
        {
          method: "DELETE",
        }
      );

      return response.ok;
    } catch (error) {
      console.error("Error deleting chat:", error);
      return false;
    }
  }

  /**
   * Private method to handle the polling mechanism
   */
  private async _startPolling(
    messageId: string,
    streamingMessage: Message,
    _options: StreamMessageOptions, // Prefix with underscore to indicate unused
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    let isComplete = false;
    let pollErrorCount = 0;
    const maxPollErrors = 5; // Stop polling after 5 consecutive errors

    this._activePollingInterval = window.setInterval(async () => {
      try {
        const updateResponse = await authService.fetchWithAuth(
          `${config.apiBaseUrl}/messages/${messageId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (updateResponse.ok) {
          const messageData = await updateResponse.json();

          // Reset error count on successful response
          pollErrorCount = 0;

          // Update the message content
          streamingMessage.content = messageData.content || "...";

          // Check if streaming is complete
          if (!messageData.isStreaming) {
            isComplete = true;
            streamingMessage.isStreaming = false;
            this._isStreaming = false;

            // Clear the polling interval
            if (this._activePollingInterval) {
              clearInterval(this._activePollingInterval);
              this._activePollingInterval = null;
            }

            // Note: Title generation is now handled by ChatMain in parallel with the response
            callbacks.onStreamingComplete();
          }

          // Always update the UI with current content
          callbacks.onMessageUpdate(streamingMessage);
        } else {
          pollErrorCount++;
          const errorText = await updateResponse.text();
          console.error(
            `❌ Poll error response (${pollErrorCount}/${maxPollErrors}):`,
            updateResponse.status,
            errorText
          );

          // If we hit too many errors, stop polling and show error
          if (pollErrorCount >= maxPollErrors) {
            if (this._activePollingInterval) {
              clearInterval(this._activePollingInterval);
              this._activePollingInterval = null;
            }

            streamingMessage.content += `\n\n❌ Streaming failed after ${maxPollErrors} errors. Server response: ${updateResponse.status}`;
            streamingMessage.isStreaming = false;
            this._isStreaming = false;

            callbacks.onMessageUpdate(streamingMessage);
            callbacks.onStreamingComplete();
            return;
          }

          // For auth errors (401), try to show a more helpful message
          if (updateResponse.status === 401) {
            streamingMessage.content +=
              "\n\n⚠️ Authentication error - you may need to refresh the page";
            callbacks.onMessageUpdate(streamingMessage);
          }
        }
      } catch (pollError) {
        pollErrorCount++;
        console.error(
          `❌ Error polling for message updates (${pollErrorCount}/${maxPollErrors}):`,
          pollError
        );

        // If we hit too many errors, stop polling
        if (pollErrorCount >= maxPollErrors) {
          if (this._activePollingInterval) {
            clearInterval(this._activePollingInterval);
            this._activePollingInterval = null;
          }

          streamingMessage.content += `\n\n❌ Streaming failed due to network errors. Please check your connection.`;
          streamingMessage.isStreaming = false;
          this._isStreaming = false;

          callbacks.onMessageUpdate(streamingMessage);
          callbacks.onStreamingComplete();
          return;
        }
      }
    }, 200); // Increase polling interval to 200ms to reduce server load

    // Safety timeout to stop polling after 2 minutes
    setTimeout(() => {
      if (!isComplete && this._activePollingInterval) {
        clearInterval(this._activePollingInterval);
        this._activePollingInterval = null;

        streamingMessage.content +=
          "\n\n⚠️ Streaming timed out after 2 minutes";
        streamingMessage.isStreaming = false;
        this._isStreaming = false;

        callbacks.onMessageUpdate(streamingMessage);
        callbacks.onStreamingComplete();
      }
    }, 120000);
  }
}
