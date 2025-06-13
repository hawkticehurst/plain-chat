import { Component, html, StreamingChatService } from "@lib";
import { ChatInput, ChatMessages, notificationService } from "@components";
import type { Message } from "@lib";

export class ChatMain extends Component {
  private _messages: Array<Message> = [];
  private _chatInput: ChatInput | null = null;
  private _chatMessages: ChatMessages | null = null;
  private _currentChatId: string | null = null;
  private _streamingService: StreamingChatService;

  constructor() {
    super();
    this._streamingService = new StreamingChatService();
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
      this._messages = await this._streamingService.loadChatMessages(chatId);
    } catch (error) {
      console.error("Error loading chat:", error);
      this._messages = [
        {
          role: "response",
          content: "❌ Error loading chat. Please try again.",
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
      const createResult =
        await this._streamingService.createChat("New Conversation");

      if (!createResult.success) {
        console.error("Failed to create new chat:", createResult.error);
        notificationService.error(
          "Failed to create new chat. Please try again."
        );
        return;
      }

      this._currentChatId = createResult.chatId;

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
    await this._streamingService.saveUserMessage(this._currentChatId, message);

    // Check if this is the first message and generate a title
    const isFirstMessage =
      this._messages.filter((m) => !m.isLoading).length === 1;

    // Handle the AI response using the streaming service
    await this._handleStreamingResponse(message, isFirstMessage);
  }

  public cancelStreaming() {
    const cancellationMessage = this._streamingService.cancelStreaming();

    if (cancellationMessage) {
      // Add cancellation message to the last response
      const lastMessage = this._messages[this._messages.length - 1];
      if (lastMessage && lastMessage.role === "response") {
        lastMessage.content += "\n\n" + cancellationMessage;
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

  private async _handleStreamingResponse(
    message: string,
    isFirstMessage: boolean
  ) {
    if (!this._currentChatId) return;

    // Remove loading message
    this._messages.pop();

    // Notify input that streaming started
    if (this._chatInput) {
      this._chatInput.streamingStarted();
    }

    // Create callbacks for the streaming service
    const callbacks = {
      onMessageUpdate: (streamingMessage: Message) => {
        // Update the message in our local state
        const lastMessage = this._messages[this._messages.length - 1];
        if (lastMessage && lastMessage.role === "response") {
          lastMessage.content = streamingMessage.content;
          lastMessage.isStreaming = streamingMessage.isStreaming;
        } else {
          this._messages.push(streamingMessage);
        }

        // Update the UI
        this._updateMessages();
      },

      onStreamingComplete: () => {
        // Notify input that streaming ended
        if (this._chatInput) {
          this._chatInput.streamingEnded();
        }

        // Generate title if this is the first message
        if (isFirstMessage) {
          this._handleTitleGeneration(message);
        }

        // Re-enable input
        if (this._chatInput) {
          this._chatInput.messageProcessed();
        }
      },

      onError: (error: string) => {
        // Show error message
        const errorMessage: Message = {
          role: "response",
          content: `❌ ${error}`,
          timestamp: Date.now(),
        };

        this._messages.push(errorMessage);
        this._updateMessages();

        // Also show a user-friendly notification
        if (error.includes("Authentication")) {
          notificationService.warning(
            "Session expired. Please refresh the page to continue."
          );
        } else if (error.includes("Server")) {
          notificationService.error(
            "Server is experiencing issues. Please try again later."
          );
        } else {
          notificationService.error(
            "Failed to get AI response. Please check your connection."
          );
        }

        // Notify input that streaming ended
        if (this._chatInput) {
          this._chatInput.streamingEnded();
          this._chatInput.messageProcessed();
        }
      },
    };

    // Start streaming using the service
    await this._streamingService.startStreamingResponse(
      {
        chatId: this._currentChatId,
        userMessage: message,
        conversationHistory: this._messages
          .slice(-10)
          .filter((m) => !m.isLoading)
          .map((m) => ({
            role: m.role,
            content: m.content,
          })),
        isFirstMessage,
      },
      callbacks
    );
  }

  private async _updateMessages() {
    if (this._chatMessages) {
      this._chatMessages.updateMessages(this._messages);
      await this._chatMessages.render();
    }
  }

  private async _handleTitleGeneration(firstMessage: string) {
    if (!this._currentChatId) return;

    const title = await this._streamingService.generateChatTitle(
      this._currentChatId,
      firstMessage
    );
    if (title) {
      // Notify parent to refresh sidebar with new title
      this.dispatchEvent(
        new CustomEvent("chat-title-updated", {
          detail: { chatId: this._currentChatId, title },
          bubbles: true,
          composed: true,
        })
      );
    }
  }
}

if (!customElements.get("chat-main")) {
  customElements.define("chat-main", ChatMain);
}
