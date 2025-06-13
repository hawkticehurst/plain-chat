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
        `${config.apiBaseUrl}/api/chats/${chatId}/messages`
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

  private async _handleSendMessage(event: Event) {
    const customEvent = event as CustomEvent;
    const { message } = customEvent.detail;

    // If no chat is selected, create a new one first
    if (!this._currentChatId) {
      try {
        const response = await authService.fetchWithAuth(
          `${config.apiBaseUrl}/api/chats`,
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
        `${config.apiBaseUrl}/api/chats/${this._currentChatId}/messages`,
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

    // Handle the AI response (streaming or non-streaming based on user preference)
    await this._handleStreamingResponse(message, isFirstMessage);
  }

  private async _generateChatTitle(firstMessage: string) {
    if (!this._currentChatId) return;

    try {
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/chats/${this._currentChatId}/generate-title`,
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

  private async _handleStreamingResponse(
    message: string,
    isFirstMessage: boolean
  ) {
    // Check if user has streaming enabled
    let shouldStream = true;
    try {
      const prefsResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/ai/preferences`
      );
      if (prefsResponse.ok) {
        const prefs = await prefsResponse.json();
        shouldStream = prefs.enableStreaming !== false;
      }
    } catch (error) {
      console.error("Error checking streaming preference:", error);
      // Default to streaming if we can't check
    }

    if (!shouldStream) {
      // Use regular non-streaming approach
      return this._handleNonStreamingResponse(message, isFirstMessage);
    }

    this._isStreaming = true;

    // Notify input that streaming started
    if (this._chatInput) {
      this._chatInput.streamingStarted();
    }

    // Replace loading message with streaming message
    this._messages.pop(); // Remove "Thinking..." message

    const streamingMessage: Message = {
      role: "response",
      content: "",
      timestamp: Date.now(),
      isLoading: false,
      isStreaming: true,
    };

    this._messages.push(streamingMessage);
    await this._updateMessages();

    // Get the ChatMessage component for this streaming message
    const streamingMessageElement = this._getLastMessageElement();

    try {
      // Prepare the streaming request
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/ai/chat/stream`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            conversation: this._messages
              .slice(-11, -1)
              .filter((m) => !m.isLoading) // Send last 10 non-loading messages (excluding current streaming message)
              .map((m) => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
              })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Set up EventSource for streaming
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response stream available");
      }

      const decoder = new TextDecoder();
      let fullContent = "";
      let usage: any = null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "content") {
                fullContent += parsed.content;

                // Update the message content
                streamingMessage.content = fullContent;

                // Update the streaming message element
                if (streamingMessageElement) {
                  await streamingMessageElement.updateStreamingContent(
                    fullContent
                  );
                }
              } else if (parsed.type === "complete") {
                fullContent = parsed.content;
                usage = parsed.usage;
                break;
              } else if (parsed.type === "error") {
                throw new Error(parsed.error);
              }
            } catch (parseError) {
              // Ignore individual parsing errors
              continue;
            }
          }
        }
      }

      // Finalize the streaming message
      streamingMessage.content = fullContent;
      streamingMessage.isStreaming = false;
      this._isStreaming = false;

      if (streamingMessageElement) {
        await streamingMessageElement.finalizeStream();
      }

      // Notify input that streaming ended
      if (this._chatInput) {
        this._chatInput.streamingEnded();
      }

      // Save AI response to database
      if (fullContent) {
        try {
          await authService.fetchWithAuth(
            `${config.apiBaseUrl}/api/chats/${this._currentChatId}/messages`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                role: "response",
                content: fullContent,
                aiMetadata: usage
                  ? {
                      model: "streaming",
                      promptTokens: usage.promptTokens,
                      completionTokens: usage.completionTokens,
                      totalTokens: usage.totalTokens,
                      cost: usage.cost,
                    }
                  : undefined,
              }),
            }
          );
        } catch (error) {
          console.error("Error saving AI message:", error);
        }
      }

      // Generate title for first message (don't await to avoid blocking UI)
      if (isFirstMessage) {
        this._generateChatTitle(message);
      }
    } catch (error) {
      this._isStreaming = false;
      console.error("Streaming error:", error);

      // Show error in the streaming message
      if (streamingMessageElement) {
        streamingMessageElement.showStreamingError(
          error instanceof Error ? error.message : "Streaming failed"
        );
      } else {
        // Replace streaming message with error message
        streamingMessage.content = `❌ Streaming error: ${error instanceof Error ? error.message : "Unknown error"}`;
        await this._updateMessages();
      }

      // Notify input that streaming ended
      if (this._chatInput) {
        this._chatInput.streamingEnded();
      }
    }

    // This should not be needed as we handle input state in individual cases above
    // But keeping as fallback
    // Re-enable input
    if (this._chatInput) {
      this._chatInput.messageProcessed();
    }
  }

  private async _handleNonStreamingResponse(
    message: string,
    isFirstMessage: boolean
  ) {
    try {
      // Send request to AI API (existing non-streaming logic)
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/chats/${this._currentChatId}/generate-title`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            conversation: this._messages
              .slice(-10)
              .filter((m) => !m.isLoading) // Send last 10 non-loading messages
              .map((m) => ({
                role: m.role,
                content: m.content,
                timestamp: m.timestamp,
              })),
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

    // Re-render with final messages
    await this._updateMessages();

    // Re-enable input
    if (this._chatInput) {
      this._chatInput.streamingStarted();
    }

  private _getLastMessageElement(): any {
    if (!this._chatMessages) return null;

    // Get the last message element from ChatMessages component
    const messageElements = this._chatMessages.querySelectorAll("chat-message");
    return messageElements[messageElements.length - 1] || null;
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

  private _handleCancelStreaming() {
    this.cancelStreaming();
  }
}

if (!customElements.get("chat-main")) {
  customElements.define("chat-main", ChatMain);
}
