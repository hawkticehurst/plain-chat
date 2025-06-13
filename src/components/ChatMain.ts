import { Component, config, authService, html } from "@lib";
import { ChatInput, ChatMessages } from "@components";

export interface Message {
  role: "prompt" | "response";
  content: string;
  timestamp?: number;
  isLoading?: boolean;
  isStreaming?: boolean;
}

export class ChatMain extends Component {
  private _messages: Array<Message> = [];
  private _chatInput: ChatInput | null = null;
  private _chatMessages: ChatMessages | null = null;
  private _currentChatId: string | null = null;
  private _currentEventSource: EventSource | null = null;
  private _isStreaming: boolean = false;

  constructor() {
    super();
    // Start with empty new chat state
    this.startNewChat();
  }

  public async loadChat(chatId: string | null) {
    this._currentChatId = chatId;
    this.render();

    if (!chatId) {
      // Show empty state for new chat
      this._messages = [];
      this.render();
      return;
    }

    try {
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/chats/${chatId}/messages`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages && Array.isArray(data.messages)) {
          this._messages = data.messages.map((msg: any) => ({
            role: msg.role || "response",
            content: msg.content || "No content",
            timestamp: msg.createdAt,
          }));
        } else {
          this._messages = [];
        }
      } else {
        console.error("Failed to load chat messages:", response.status);
        this._messages = [
          {
            role: "response",
            content:
              "❌ Failed to load chat messages. Please try refreshing the page.",
            timestamp: Date.now(),
          },
        ];
      }
    } catch (error) {
      console.error("Error loading chat messages:", error);
      this._messages = [
        {
          role: "response",
          content:
            "❌ Network error loading messages. Please check your connection.",
          timestamp: Date.now(),
        },
      ];
    } finally {
      this.render();
    }
  }

  public startNewChat() {
    this._currentChatId = null;
    this._messages = [];
    this.render();
  }

  async render() {
    // Show empty state if no chat is selected
    if (!this._currentChatId) {
      this.innerHTML = String(html`
        <div class="empty-state">
          <h2>Start a New Conversation</h2>
          <p>
            Type your first message below to begin a new chat. Your conversation
            will be saved automatically.
          </p>
        </div>
      `);

      // Still need to create the input for new chats
      this._chatInput = new ChatInput();
      this._chatInput.render();
      this.appendChild(this._chatInput);

      // Listen for send-message events from ChatInput
      this._chatInput.addEventListener(
        "send-message",
        this._handleSendMessage.bind(this)
      );
      return;
    }

    this._chatMessages = new ChatMessages(this._messages);
    this._chatInput = new ChatInput();

    await this._chatMessages.render();
    this._chatInput.render();

    // Clear previous content
    this.innerHTML = "";

    this.insert(this, this._chatMessages, null);
    this.insert(this, this._chatInput, null);

    // Listen for send-message events from ChatInput
    this._chatInput.addEventListener(
      "send-message",
      this._handleSendMessage.bind(this)
    );

    // Listen for cancel-streaming events from ChatInput
    this._chatInput.addEventListener(
      "cancel-streaming",
      this._handleCancelStreaming.bind(this)
    );
  }

  public hello() {
    // Method can be used for testing purposes
  }

  private async _handleSendMessage(event: Event) {
    const customEvent = event as CustomEvent;
    const { message } = customEvent.detail;

    // If no chat is selected, create a new one first
    if (!this._currentChatId) {
      try {
        const response = await authService.fetchWithAuth(
          `${config.apiBaseUrl}/chats`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: "New Conversation",
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          this._currentChatId = data.chatId;

          // Re-render immediately to switch from empty state to chat interface
          await this.render();

          // Notify parent to update sidebar
          this.dispatchEvent(
            new CustomEvent("chat-created", {
              detail: { chatId: this._currentChatId },
              bubbles: true,
              composed: true,
            })
          );
        } else {
          console.error("Failed to create new chat:", response.status);
          return;
        }
      } catch (error) {
        console.error("Error creating new chat:", error);
        return;
      }
    }

    // Add user message to conversation (local state)
    const userMessage: Message = {
      role: "prompt",
      content: message,
      timestamp: Date.now(),
    };

    this._messages.push(userMessage);

    // Add loading message for AI response
    const loadingMessage: Message = {
      role: "response",
      content: "Thinking...",
      timestamp: Date.now(),
      isLoading: true,
    };

    this._messages.push(loadingMessage);

    // Re-render to show the messages
    await this._updateMessages();

    // Save user message to database
    try {
      await authService.fetchWithAuth(
        `${config.apiBaseUrl}/chats/${this._currentChatId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "prompt",
            content: message,
          }),
        }
      );
    } catch (error) {
      console.error("Error saving user message:", error);
    }

    // Check if this is the first message and generate a title
    const isFirstMessage =
      this._messages.filter((m) => !m.isLoading).length === 1;

    // Handle the AI response using Convex reactivity pattern
    await this._handleConvexStreamingResponse(message, isFirstMessage);
  }

  private async _generateChatTitle(firstMessage: string) {
    if (!this._currentChatId) return;

    try {
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/chats/${this._currentChatId}/generate-title`,
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
        if (data.success) {
          // Notify parent to refresh sidebar with new title
          this.dispatchEvent(
            new CustomEvent("chat-title-updated", {
              detail: { chatId: this._currentChatId, title: data.title },
              bubbles: true,
              composed: true,
            })
          );
        }
      }
    } catch (error) {
      console.error("Error generating chat title:", error);
    }
  }

  private async _updateMessages() {
    if (this._chatMessages) {
      this._chatMessages.updateMessages(this._messages);
      await this._chatMessages.render();
    }
  }

  public cancelStreaming() {
    if (this._currentEventSource) {
      this._currentEventSource.close();
      this._currentEventSource = null;
    }

    if (this._isStreaming) {
      this._isStreaming = false;

      // Add cancellation message
      const lastMessage = this._messages[this._messages.length - 1];
      if (lastMessage && lastMessage.role === "response") {
        lastMessage.content += "\n\n❌ *Response cancelled by user*";
        lastMessage.isStreaming = false;
      }

      this._updateMessages();

      // Notify input that streaming ended
      if (this._chatInput) {
        this._chatInput.streamingEnded();
      }
    }
  }

  private _handleCancelStreaming() {
    this.cancelStreaming();
  }

  private async _handleConvexStreamingResponse(
    message: string,
    isFirstMessage: boolean
  ) {
    this._isStreaming = true;

    // Notify input that streaming started
    if (this._chatInput) {
      this._chatInput.streamingStarted();
    }

    // Remove loading message
    this._messages.pop();

    try {
      // Create AI message with scheduled streaming (following Convex pattern)
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/chats/${this._currentChatId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            conversation: this._messages
              .slice(-10)
              .filter((m) => !m.isLoading)
              .map((m) => ({
                role: m.role,
                content: m.content,
              })),
            useConvexStreaming: true, // Flag to use the new pattern
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

      // Add placeholder streaming message to UI
      const streamingMessage: Message = {
        role: "response",
        content: "...",
        timestamp: Date.now(),
        isStreaming: true,
      };

      this._messages.push(streamingMessage);
      this.render();

      // Now poll for updates using direct database queries
      // This simulates the reactivity that would happen in a React app
      let isComplete = false;
      const pollInterval = setInterval(async () => {
        try {
          // Query for the specific message updates
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

            // Update the content in real-time
            streamingMessage.content = messageData.content || "...";

            // Check if streaming is complete
            if (!messageData.isStreaming) {
              isComplete = true;
              streamingMessage.isStreaming = false;
              this._isStreaming = false;

              // Notify input that streaming ended
              if (this._chatInput) {
                this._chatInput.streamingEnded();
              }

              // Generate title if this is the first message
              if (isFirstMessage) {
                this._generateChatTitle(message);
              }

              clearInterval(pollInterval);
            }

            // Update the UI - only update messages, don't re-render entire component
            if (this._chatMessages) {
              this._chatMessages.updateMessages(this._messages);
              await this._chatMessages.render();
            }
          } else {
            const errorText = await updateResponse.text();
            console.error("❌ Poll error response:", errorText);
          }
        } catch (pollError) {
          console.error("❌ Error polling for message updates:", pollError);
          if (!isComplete) {
            // Continue polling unless there's a persistent error
          }
        }
      }, 100); // Poll every 100ms for very smooth updates

      // Safety timeout to stop polling after 2 minutes
      setTimeout(async () => {
        if (!isComplete) {
          clearInterval(pollInterval);
          streamingMessage.content += "\n\n⚠️ Streaming timed out";
          streamingMessage.isStreaming = false;
          this._isStreaming = false;
          if (this._chatInput) {
            this._chatInput.streamingEnded();
          }
          // Update messages only, don't re-render entire component
          if (this._chatMessages) {
            this._chatMessages.updateMessages(this._messages);
            await this._chatMessages.render();
          }
        }
      }, 120000);
    } catch (error) {
      this._isStreaming = false;
      console.error("Convex streaming error:", error);

      // Show error message
      const errorMessage: Message = {
        role: "response",
        content: `❌ Streaming error: ${error instanceof Error ? error.message : "Unknown error"}`,
        timestamp: Date.now(),
      };

      this._messages.push(errorMessage);
      this.render();

      // Notify input that streaming ended
      if (this._chatInput) {
        this._chatInput.streamingEnded();
      }
    }

    // Re-enable input
    if (this._chatInput) {
      this._chatInput.messageProcessed();
    }
  }
}

if (!customElements.get("chat-main")) {
  customElements.define("chat-main", ChatMain);
}
