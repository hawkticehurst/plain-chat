import { Component, config, authService } from "../lib/index";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";

export interface Message {
  role: "prompt" | "response";
  content: string;
  timestamp?: number;
  isLoading?: boolean;
}

export class ChatMain extends Component {
  private _messages: Array<Message> = [];
  private _loading = true;
  private _chatInput: ChatInput | null = null;
  private _chatMessages: ChatMessages | null = null;
  private _currentChatId: string | null = null;

  constructor() {
    super();
    // Start with empty new chat state
    this._loading = false;
    this.startNewChat();
  }

  public async loadChat(chatId: string | null) {
    this._currentChatId = chatId;
    this._loading = true;
    this.render();

    if (!chatId) {
      // Show empty state for new chat
      this._messages = [];
      this._loading = false;
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
      this._loading = false;
      this.render();
    }
  }

  public startNewChat() {
    this._currentChatId = null;
    this._messages = [];
    this._loading = false;
    this.render();
  }

  async render() {
    if (this._loading) {
      this.innerHTML = '<div class="loading">Loading messages...</div>';
      return;
    }

    // Show empty state if no chat is selected
    if (!this._currentChatId) {
      this.innerHTML = `
        <div class="empty-state">
          <h2>Start a New Conversation</h2>
          <p>Type your first message below to begin a new chat. Your conversation will be saved automatically.</p>
        </div>
      `;

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

    try {
      // Send request to AI API
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/ai/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            conversation: this._messages.slice(-10).filter((m) => !m.isLoading), // Send last 10 non-loading messages
          }),
        }
      );

      // Remove loading message
      this._messages.pop();

      if (response.ok) {
        const data = await response.json();

        if (data.success) {
          // Add AI response
          const aiMessage: Message = {
            role: "response",
            content: data.response,
            timestamp: Date.now(),
          };

          this._messages.push(aiMessage);

          // Save AI response to database
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
                  content: data.response,
                  aiMetadata: data.metadata,
                }),
              }
            );
          } catch (error) {
            console.error("Error saving AI message:", error);
          }

          // Generate title for first message (don't await to avoid blocking UI)
          if (isFirstMessage) {
            this._generateChatTitle(message);
          }
        } else {
          // Add error message
          const errorMessage: Message = {
            role: "response",
            content: `❌ Error: ${data.error}`,
            timestamp: Date.now(),
          };

          this._messages.push(errorMessage);
        }
      } else {
        // Add error message for HTTP errors
        const errorMessage: Message = {
          role: "response",
          content: `❌ Failed to send message. Please try again.`,
          timestamp: Date.now(),
        };

        this._messages.push(errorMessage);
      }
    } catch (error) {
      // Remove loading message if still there
      if (this._messages[this._messages.length - 1]?.isLoading) {
        this._messages.pop();
      }

      // Add error message
      const errorMessage: Message = {
        role: "response",
        content: `❌ Network error. Please check your connection and try again.`,
        timestamp: Date.now(),
      };

      this._messages.push(errorMessage);
    }

    // Re-render with final messages and enable input
    await this._updateMessages();
    if (this._chatInput) {
      this._chatInput.messageProcessed();
    }
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
}

if (!customElements.get("chat-main")) {
  customElements.define("chat-main", ChatMain);
}
