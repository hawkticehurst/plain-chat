import { Component, html, signal, effect, StreamingChatService } from "@lib";
import { ChatInput, ChatMessages, notificationService } from "@components";
import type { Message } from "@lib";
import "./ChatMain.css";

export class ChatMain extends Component {
  // Private reactive state using signals
  #messages = signal<Array<Message>>([]);
  #currentChatId = signal<string | null>(null);
  #isStreaming = signal(false);
  #isLoading = signal(false);

  // Cached DOM references
  #chatInput: ChatInput | null = null;
  #chatMessages: ChatMessages | null = null;
  #emptyStateDiv: HTMLElement | null = null;
  #chatContainer: HTMLElement | null = null;

  // Services
  #streamingService: StreamingChatService;

  constructor() {
    super();
    this.#streamingService = new StreamingChatService();
  }

  init() {
    // Build the DOM structure once
    this.append(html`
      <div class="empty-state" style="display: none;">
        <h2>Start a New Conversation</h2>
        <p>
          Type your first message below to begin a new chat. Your conversation
          will be saved automatically.
        </p>
      </div>
      <div class="chat-container" style="display: none;"></div>
    `);

    // Cache DOM references
    this.#emptyStateDiv = this.querySelector(".empty-state") as HTMLElement;
    this.#chatContainer = this.querySelector(".chat-container") as HTMLElement;

    // Create child components
    this.#chatMessages = new ChatMessages(this.#messages());
    this.#chatInput = new ChatInput();

    // Add components to their initial containers
    if (this.#chatContainer) {
      this.#chatContainer.appendChild(this.#chatMessages);
    }

    this.appendChild(this.#chatInput);

    // Set up event listeners using the component's event system
    this.#setupEventListeners();

    // Update UI based on whether we have a current chat
    effect(() => {
      const hasChat = this.#currentChatId() !== null;
      if (this.#emptyStateDiv && this.#chatContainer) {
        this.#emptyStateDiv.style.display = hasChat ? "none" : "flex";
        this.#chatContainer.style.display = hasChat ? "block" : "none";
      }
    });

    // Update messages when they change
    effect(() => {
      if (this.#chatMessages) {
        this.#chatMessages.updateMessages(this.#messages());
      }
    });

    // Update input states based on loading/streaming
    effect(() => {
      if (this.#chatInput) {
        if (this.#isStreaming()) {
          this.#chatInput.streamingStarted();
        } else if (this.#isLoading()) {
          // Keep loading state
        } else {
          this.#chatInput.streamingEnded();
          this.#chatInput.messageProcessed();
        }
      }
    });

    // Start with empty new chat state
    this.startNewChat();
  }

  #setupEventListeners() {
    if (this.#chatInput) {
      // Listen for send-message events from ChatInput
      this.#chatInput.addEventListener(
        "send-message",
        this.#handleSendMessage.bind(this)
      );

      // Listen for cancel-streaming events from ChatInput
      this.#chatInput.addEventListener(
        "cancel-streaming",
        this.cancelStreaming.bind(this)
      );
    }
  }

  // Public API methods
  public async loadChat(chatId: string | null) {
    // Prevent duplicate loading of the same chat
    if (this.#currentChatId() === chatId && this.#messages().length > 0) {
      return;
    }

    this.#currentChatId(chatId);

    if (!chatId) {
      // Show empty state for new chat
      this.#messages([]);
      return;
    }

    this.#isLoading(true);
    try {
      const messages = await this.#streamingService.loadChatMessages(chatId);
      this.#messages(messages);
    } catch (error) {
      console.error("Error loading chat:", error);
      this.#messages([
        {
          role: "response",
          content: "❌ Error loading chat. Please try again.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      this.#isLoading(false);
    }
  }

  public startNewChat() {
    this.#currentChatId(null);
    this.#messages([]);
  }

  public async deleteChat(chatId: string) {
    try {
      // Use the streaming service to delete the chat
      const success = await this.#streamingService.deleteChat(chatId);

      if (!success) {
        throw new Error("Failed to delete chat");
      }

      // If the deleted chat was the current chat, start a new chat
      if (this.#currentChatId() === chatId) {
        this.startNewChat();
      }

      // Dispatch success event
      this.dispatchEvent(
        new CustomEvent("chat-deleted", {
          detail: { id: chatId },
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      console.error("Error deleting chat:", error);
      // Dispatch error event for notification
      this.dispatchEvent(
        new CustomEvent("chat-error", {
          detail: {
            message:
              error instanceof Error ? error.message : "Failed to delete chat",
          },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  // Event handlers
  async #handleSendMessage(event: Event) {
    const customEvent = event as CustomEvent;
    const { message } = customEvent.detail;

    // If no chat is selected, create a new one first
    if (!this.#currentChatId()) {
      const createResult =
        await this.#streamingService.createChat("New Conversation");

      if (!createResult.success) {
        console.error("Failed to create new chat:", createResult.error);
        notificationService.error(
          "Failed to create new chat. Please try again."
        );
        return;
      }

      this.#currentChatId(createResult.chatId);

      // Notify parent to update sidebar
      this.dispatchEvent(
        new CustomEvent("chat-created", {
          detail: { chatId: this.#currentChatId() },
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

    const currentMessages = this.#messages();
    this.#messages([...currentMessages, userMessage]);

    // Add loading message for AI response
    const loadingMessage: Message = {
      role: "response",
      content: "Thinking...",
      timestamp: Date.now(),
      isLoading: true,
    };

    this.#messages([...this.#messages(), loadingMessage]);

    // Check if this is the first message and generate a title
    const isFirstMessage =
      this.#messages().filter((m) => !m.isLoading).length === 1;

    // Handle the AI response using the streaming service
    await this.#handleStreamingResponse(message, isFirstMessage);
  }

  public cancelStreaming() {
    const cancellationMessage = this.#streamingService.cancelStreaming();

    if (cancellationMessage) {
      // Add cancellation message to the last response
      const messages = this.#messages();
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "response") {
        const updatedMessage = {
          ...lastMessage,
          content: lastMessage.content + "\n\n" + cancellationMessage,
          isStreaming: false,
        };
        const updatedMessages = [...messages];
        updatedMessages[updatedMessages.length - 1] = updatedMessage;
        this.#messages(updatedMessages);
      }

      this.#isStreaming(false);
    }
  }

  async #handleStreamingResponse(message: string, isFirstMessage: boolean) {
    if (!this.#currentChatId()) return;

    // Remove loading message
    const messages = this.#messages();
    this.#messages(messages.slice(0, -1));

    this.#isStreaming(true);

    // Create callbacks for the streaming service
    const callbacks = {
      onMessageUpdate: (streamingMessage: Message) => {
        // Update the message in our local state
        const currentMessages = this.#messages();
        const lastMessage = currentMessages[currentMessages.length - 1];

        if (lastMessage && lastMessage.role === "response") {
          const updatedMessages = [...currentMessages];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMessage,
            content: streamingMessage.content,
            isStreaming: streamingMessage.isStreaming,
          };
          this.#messages(updatedMessages);
        } else {
          this.#messages([...currentMessages, streamingMessage]);
        }
      },

      onStreamingComplete: () => {
        this.#isStreaming(false);

        // Generate title if this is the first message
        if (isFirstMessage) {
          this.#handleTitleGeneration(message);
        }
      },

      onError: (error: string) => {
        // Show error message
        const errorMessage: Message = {
          role: "response",
          content: `❌ ${error}`,
          timestamp: Date.now(),
        };

        this.#messages([...this.#messages(), errorMessage]);

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

        this.#isStreaming(false);
      },
    };

    // Start streaming using the service
    await this.#streamingService.startStreamingResponse(
      {
        chatId: this.#currentChatId()!,
        userMessage: message,
        conversationHistory: this.#messages()
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

  async #handleTitleGeneration(firstMessage: string) {
    if (!this.#currentChatId()) return;

    const title = await this.#streamingService.generateChatTitle(
      this.#currentChatId()!,
      firstMessage
    );
    if (title) {
      // Notify parent to refresh sidebar with new title
      this.dispatchEvent(
        new CustomEvent("chat-title-updated", {
          detail: { chatId: this.#currentChatId(), title },
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
