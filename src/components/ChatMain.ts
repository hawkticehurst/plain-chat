import { Component, html, signal, effect, StreamingChatService } from "@lib";
import { ChatInput, ChatMessages, notificationService } from "@components";
import type { Message } from "@lib";
import { titleGenerationService } from "../services";
import "./ChatMain.css";

export class ChatMain extends Component {
  // Private reactive state using signals
  #messages = signal<Array<Message>>([]);
  #currentChatId = signal<string | null>(null);
  #isStreaming = signal(false);
  #isLoading = signal(false);
  #sidebarCollapsed = signal(false);
  #isInSettingsMode = signal(false);
  #sidebarStateBeforeSettings = signal<boolean | null>(null);
  #tokenCount = signal<number>(0);
  #isTokenCountVisible = signal<boolean>(false);
  #estimatedTokens = signal<number>(0);

  // Cached DOM references
  #chatInput: ChatInput | null = null;
  #chatMessages: ChatMessages | null = null;
  #emptyStateDiv: HTMLElement | null = null;
  #chatContainer: HTMLElement | null = null;
  #toggleButton: HTMLElement | null = null;
  #tokenCounter: HTMLElement | null = null;

  // Services
  #streamingService: StreamingChatService;

  constructor() {
    super();
    this.#streamingService = new StreamingChatService();
  }

  // Utility function to estimate token count from text
  #estimateTokenCount(text: string): number {
    // Simple token estimation: roughly 4 characters per token
    // This is an approximation - real tokenization varies by model
    const cleanText = text.replace(/\s+/g, " ").trim();
    return Math.ceil(cleanText.length / 4);
  }

  // Update estimated token count during streaming
  #updateEstimatedTokens(content: string) {
    const estimated = this.#estimateTokenCount(content);
    this.#estimatedTokens(estimated);
  }

  // Show/hide token counter
  #showTokenCounter() {
    // Remove any existing fade-out animation
    if (this.#tokenCounter) {
      this.#tokenCounter.classList.remove("fade-out");
    }
    this.#isTokenCountVisible(true);
  }

  #hideTokenCounter() {
    if (this.#tokenCounter && this.#isTokenCountVisible()) {
      // Add fade-out animation
      this.#tokenCounter.classList.add("fade-out");

      // Hide after animation completes
      setTimeout(() => {
        // Set display none and clear state
        if (this.#tokenCounter) {
          this.#tokenCounter.style.display = "none";
        }

        // Clear the reactive state
        this.#isTokenCountVisible(false);
        this.#tokenCount(0);
        this.#estimatedTokens(0);
      }, 500); // Match the animation duration
    } else {
      console.log(
        "⚠️ Token counter not visible or element not found, skipping animation"
      );
    }
  }

  // Helper method to restore sidebar state when leaving settings
  #restoreSidebarState() {
    const sidebar = document.querySelector("chat-sidebar") as any;
    const savedSidebarState = this.#sidebarStateBeforeSettings();

    if (sidebar && sidebar.isCollapsed && savedSidebarState !== null) {
      const currentlyCollapsed = sidebar.isCollapsed();

      // If the saved state is different from current state, toggle it
      if (savedSidebarState !== currentlyCollapsed) {
        sidebar.toggleCollapse();
      }

      // Clear the saved state
      this.#sidebarStateBeforeSettings(null);
    }
  }

  init() {
    // Build the DOM structure once
    this.append(html`
      <button
        class="sidebar-toggle-btn"
        @click="handleToggleSidebar"
        title="Toggle Sidebar"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>
      <button
        class="settings-back-btn"
        @click="handleBackFromSettings"
        title="Back to Chat"
        style="display: none;"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        Back to chat
      </button>
      <div class="token-counter" style="display: none;">
        <div class="token-counter-content">
          <span class="token-count">0</span>
          <span class="token-label">tokens</span>
        </div>
      </div>
      <button class="chat-settings-btn" @click="handleChatSettings">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </button>
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
    this.#toggleButton = this.querySelector(
      ".sidebar-toggle-btn"
    ) as HTMLElement;
    this.#tokenCounter = this.querySelector(".token-counter") as HTMLElement;

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

    // Check initial sidebar state for proper styling
    setTimeout(() => {
      const sidebar = document.querySelector("chat-sidebar") as any;
      if (sidebar && sidebar.isCollapsed && sidebar.isCollapsed()) {
        this.classList.add("sidebar-collapsed");
        this.#sidebarCollapsed(true);
      }
    }, 100);

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

    // Manage button visibility based on settings mode
    effect(() => {
      const isInSettings = this.#isInSettingsMode();
      const toggleButton = this.querySelector(
        ".sidebar-toggle-btn"
      ) as HTMLElement;
      const backButton = this.querySelector(
        ".settings-back-btn"
      ) as HTMLElement;
      const settingsButton = document.querySelector(
        ".chat-settings-btn"
      ) as HTMLElement;

      if (toggleButton && backButton) {
        if (isInSettings) {
          toggleButton.style.display = "none";
          backButton.style.display = "flex";
        } else {
          toggleButton.style.display = "flex";
          backButton.style.display = "none";
        }
      }

      // Hide/show settings button
      if (settingsButton) {
        settingsButton.style.display = isInSettings ? "none" : "flex";
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

    // Update toggle button icon based on sidebar state
    effect(() => {
      if (this.#toggleButton) {
        const isCollapsed = this.#sidebarCollapsed();
        this.#toggleButton.innerHTML = isCollapsed
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M9 18l6-6-6-6"/>
             </svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
               <path d="M3 12h18M3 6h18M3 18h18"/>
             </svg>`;
        this.#toggleButton.title = isCollapsed
          ? "Expand Sidebar"
          : "Collapse Sidebar";
      }
    });

    // Update token counter visibility and content
    effect(() => {
      if (this.#tokenCounter) {
        const isVisible = this.#isTokenCountVisible();

        // Only set display immediately for showing
        // For hiding, let the fade-out animation handle it
        if (isVisible) {
          this.#tokenCounter.style.display = "flex";
        } else if (!this.#tokenCounter.classList.contains("fade-out")) {
          // Only hide immediately if we're not in the middle of a fade-out animation
          this.#tokenCounter.style.display = "none";
        }
      }
    });

    // Update token count display
    effect(() => {
      if (this.#tokenCounter) {
        const tokenCountElement = this.#tokenCounter.querySelector(
          ".token-count"
        ) as HTMLElement;
        if (tokenCountElement) {
          const isStreaming = this.#isStreaming();
          const finalCount = this.#tokenCount();
          const estimatedCount = this.#estimatedTokens();

          if (isStreaming && estimatedCount > 0) {
            tokenCountElement.textContent = `~${estimatedCount}`;
            tokenCountElement.className = "token-count streaming";
          } else if (finalCount > 0) {
            tokenCountElement.textContent = finalCount.toString();
            tokenCountElement.className = "token-count final";
          } else {
            tokenCountElement.textContent = "0";
            tokenCountElement.className = "token-count";
          }
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
    // Restore sidebar state if coming from settings
    this.#restoreSidebarState();

    // Clear settings mode
    this.#isInSettingsMode(false);

    // Clean up any settings components first
    const existingSettings = this.querySelector("chat-settings");
    if (existingSettings) {
      existingSettings.remove();
    }

    // Show normal chat UI elements
    if (this.#emptyStateDiv && this.#chatContainer) {
      const hasChat = chatId !== null;
      this.#emptyStateDiv.style.display = hasChat ? "none" : "flex";
      this.#chatContainer.style.display = hasChat ? "block" : "none";
    }

    // Show chat input
    if (this.#chatInput) {
      this.#chatInput.style.display = "block";
    }

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
    // Restore sidebar state if coming from settings
    this.#restoreSidebarState();

    // Clear settings mode
    this.#isInSettingsMode(false);

    // Clean up any settings components first
    const existingSettings = this.querySelector("chat-settings");
    if (existingSettings) {
      existingSettings.remove();
    }

    // Show normal chat UI elements
    if (this.#emptyStateDiv && this.#chatContainer) {
      this.#emptyStateDiv.style.display = "flex";
      this.#chatContainer.style.display = "none";
    }

    // Show chat input
    if (this.#chatInput) {
      this.#chatInput.style.display = "block";
    }

    this.#currentChatId(null);
    this.#messages([]);
  }

  public focusInput() {
    if (this.#chatInput) {
      this.#chatInput.focus();
    }
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
    const { message, model } = customEvent.detail;

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
    await this.#handleStreamingResponse(message, isFirstMessage, model);
  }

  public cancelStreaming() {
    const cancellationMessage = this.#streamingService.cancelStreaming();

    if (cancellationMessage) {
      // Hide token counter
      this.#hideTokenCounter();

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

  async #handleStreamingResponse(
    message: string,
    isFirstMessage: boolean,
    model?: string
  ) {
    if (!this.#currentChatId()) return;

    // Remove loading message
    const messages = this.#messages();
    this.#messages(messages.slice(0, -1));

    this.#isStreaming(true);

    // Show token counter
    this.#showTokenCounter();

    // Start title generation in parallel if this is the first message
    if (isFirstMessage && this.#currentChatId()) {
      this.#startParallelTitleGeneration(message);
    }

    // Create callbacks for the streaming service
    const callbacks = {
      onMessageUpdate: (streamingMessage: Message) => {
        // Update estimated token count during streaming
        if (streamingMessage.isStreaming && streamingMessage.content) {
          this.#updateEstimatedTokens(streamingMessage.content);
        }

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

        // Get final token count from the completed message
        const messages = this.#messages();
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.role === "response") {
            const finalTokenCount = this.#estimateTokenCount(
              lastMessage.content
            );
            this.#tokenCount(finalTokenCount);
            this.#estimatedTokens(0); // Clear estimated count

            const updatedMessages = [...messages];
            updatedMessages[updatedMessages.length - 1] = {
              ...lastMessage,
              isStreaming: false,
              aiMetadata: {
                model: model || "google/gemini-2.5-flash-preview-05-20", // Use the passed model or default
                tokenCount: finalTokenCount,
              },
            };
            this.#messages(updatedMessages);
          }
        }

        // Keep token counter visible for a few seconds after completion
        setTimeout(() => {
          this.#hideTokenCounter();
        }, 3000);
      },

      onError: (error: string) => {
        // Hide token counter on error
        this.#hideTokenCounter();

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
        model, // Pass the selected model to the service
      },
      callbacks
    );
  }

  /**
   * Starts title generation in parallel with the AI response using a web worker
   * This allows the title to be generated and displayed as soon as it's ready
   */
  async #startParallelTitleGeneration(firstMessage: string) {
    if (!this.#currentChatId()) return;

    const chatId = this.#currentChatId()!;

    try {
      // Generate title in web worker (non-blocking)
      const title = await titleGenerationService.generateTitle(
        chatId,
        firstMessage
      );

      if (title) {
        // Immediately notify parent to update sidebar with new title
        this.dispatchEvent(
          new CustomEvent("chat-title-updated", {
            detail: { chatId, title },
            bubbles: true,
            composed: true,
          })
        );
      }
    } catch (error) {
      console.error(
        `❌ Error in parallel title generation for chat ${chatId}:`,
        error
      );
    }
  }

  handleToggleSidebar = () => {
    // Find the sidebar and toggle it
    const sidebar = document.querySelector("chat-sidebar") as any;
    if (sidebar && sidebar.toggleCollapse) {
      sidebar.toggleCollapse();
      // Update local state for icon
      const isCollapsed = sidebar.isCollapsed();
      this.#sidebarCollapsed(isCollapsed);

      // Add/remove class to adjust toggle button position
      if (isCollapsed) {
        this.classList.add("sidebar-collapsed");
      } else {
        this.classList.remove("sidebar-collapsed");
      }
    }
  };

  handleBackFromSettings = () => {
    // Restore the sidebar state first
    const sidebar = document.querySelector("chat-sidebar") as any;
    const savedSidebarState = this.#sidebarStateBeforeSettings();

    if (sidebar && sidebar.isCollapsed && savedSidebarState !== null) {
      const currentlyCollapsed = sidebar.isCollapsed();

      // If the saved state is different from current state, toggle it
      if (savedSidebarState !== currentlyCollapsed) {
        sidebar.toggleCollapse();
      }

      // Clear the saved state
      this.#sidebarStateBeforeSettings(null);
    }

    // Instead of using window.location.hash which causes a full refresh,
    // directly call the App's newChat method to get smooth transition
    const app = document.querySelector("chat-app") as any;
    if (app && app.newChat) {
      // Call the app's newChat method which handles sidebar state restoration
      // and smooth content transition
      app.newChat();
    } else {
      // Fallback: manually restore and switch to home
      this.#isInSettingsMode(false);
      this.startNewChat();

      // Update URL and router state
      window.history.pushState({}, "", "#/");
      const router = (window as any).router;
      if (router) {
        router.currentPath = "/";
      }
    }
  };

  handleChatSettings = () => {
    this.loadSettings();
  };

  loadSettings() {
    // Save current sidebar state before changing it
    const sidebar = document.querySelector("chat-sidebar") as any;
    if (sidebar && sidebar.isCollapsed) {
      this.#sidebarStateBeforeSettings(sidebar.isCollapsed());

      // Collapse the sidebar if it's not already collapsed
      if (!sidebar.isCollapsed()) {
        sidebar.toggleCollapse();
      }
    }

    // Set settings mode
    this.#isInSettingsMode(true);

    // Clear current chat state
    this.#currentChatId(null);
    this.#messages([]);

    // Hide chat content and chat input
    if (this.#emptyStateDiv && this.#chatContainer) {
      this.#emptyStateDiv.style.display = "none";
      this.#chatContainer.style.display = "none";
    }

    // Hide chat input
    if (this.#chatInput) {
      this.#chatInput.style.display = "none";
    }

    // Create and insert settings component
    const settingsComponent = document.createElement("chat-settings");
    settingsComponent.classList.add("settings-in-main");

    // Remove any existing settings
    const existingSettings = this.querySelector("chat-settings");
    if (existingSettings) {
      existingSettings.remove();
    }

    // Insert settings before the chat input
    if (this.#chatInput) {
      this.insertBefore(settingsComponent, this.#chatInput);
    } else {
      this.appendChild(settingsComponent);
    }
  }
}

if (!customElements.get("chat-main")) {
  customElements.define("chat-main", ChatMain);
}
