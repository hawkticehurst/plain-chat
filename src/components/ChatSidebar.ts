import {
  Component,
  html,
  signal,
  effect,
  computed,
  config,
  authService,
} from "@lib";
import { notificationService } from "./NotificationComponent";
import "./ChatSidebar.css";

interface ChatItem {
  id: string;
  title: string;
  timestamp: Date;
  updatedAt: number;
}

export class ChatSidebar extends Component {
  // Private reactive state using signals
  #chats = signal<Array<ChatItem>>([]);
  #loading = signal<boolean>(true);
  #currentChatId = signal<string | null>(null);
  #isSignedIn = signal<boolean>(false);

  // DOM references
  #headerSection: HTMLElement | null = null;
  #chatListSection: HTMLElement | null = null;
  #footerSection: HTMLElement | null = null;

  // Computed values
  #groupedChats = computed(() => {
    const chats = this.#chats();
    const categories: Record<string, ChatItem[]> = {
      Today: [],
      Yesterday: [],
      "Last 7 Days": [],
      Older: [],
    };

    for (const chat of chats) {
      const category = this.#getCategoryForDate(chat.timestamp);
      categories[category].push(chat);
    }

    // Sort chats within each category by timestamp (newest first)
    Object.keys(categories).forEach((key) => {
      categories[key].sort(
        (a: ChatItem, b: ChatItem) =>
          b.timestamp.getTime() - a.timestamp.getTime()
      );
    });

    return categories;
  });

  constructor() {
    super();
    this.#checkAuthStatus();
    this.#setupAuthListener();
  }

  init() {
    // Build the DOM structure once
    this.append(html`
      <section class="header">
        <button class="new-chat-btn" @click="handleNewChat">New Chat</button>
        <button class="usage-dashboard-btn" @click="handleUsageDashboard">
          Usage Dashboard
        </button>
      </section>
      <section class="chat-list">
        <!-- Chat list will be populated by reactive effects -->
      </section>
      <section class="footer">
        <button class="auth-btn" @click="handleAuth">
          <!-- Button text updated by reactive effects -->
        </button>
      </section>
    `);

    // Cache DOM references
    this.#headerSection = this.querySelector(".header") as HTMLElement;
    this.#chatListSection = this.querySelector(".chat-list") as HTMLElement;
    this.#footerSection = this.querySelector(".footer") as HTMLElement;

    // Wire up reactive effects
    this.#setupReactiveEffects();

    // Load initial data after auth is ready
    this.#loadInitialData();
  }

  async #loadInitialData() {
    // If auth is already ready and user is signed in, load immediately
    if (authService.isReady() && authService.isSignedIn()) {
      this.#loadChats();
      return;
    }

    // Check auth status periodically
    this.#checkAuthStatus();

    // If not signed in, stop loading
    if (!this.#isSignedIn()) {
      this.#loading(false);
      return;
    }

    // Wait for auth service to be ready before loading chats
    const isReady = await authService.waitForReady(10000);
    if (isReady && authService.isSignedIn()) {
      this.#loadChats();
    } else {
      this.#loading(false);
    }
  }

  #setupReactiveEffects() {
    // Update auth button text
    effect(() => {
      const authBtn = this.#footerSection?.querySelector(
        ".auth-btn"
      ) as HTMLButtonElement;
      if (authBtn) {
        authBtn.textContent = this.#isSignedIn() ? "Sign Out" : "Sign In";
      }
    });

    // Enable/disable buttons based on auth status
    effect(() => {
      const isSignedIn = this.#isSignedIn();
      const chatSettingsBtn = this.#headerSection?.querySelector(
        ".chat-settings-btn"
      ) as HTMLButtonElement;
      const usageDashboardBtn = this.#headerSection?.querySelector(
        ".usage-dashboard-btn"
      ) as HTMLButtonElement;

      if (chatSettingsBtn) chatSettingsBtn.disabled = !isSignedIn;
      if (usageDashboardBtn) usageDashboardBtn.disabled = !isSignedIn;
    });

    // Update chat list when chats, loading, or auth state changes
    effect(() => {
      if (!this.#chatListSection) return;

      const loading = this.#loading();
      const isSignedIn = this.#isSignedIn();
      const groupedChats = this.#groupedChats();
      const currentChatId = this.#currentChatId();

      this.#renderChatList(loading, isSignedIn, groupedChats, currentChatId);
    });
  }

  #renderChatList(
    loading: boolean,
    isSignedIn: boolean,
    groupedChats: Record<string, ChatItem[]>,
    currentChatId: string | null
  ) {
    if (!this.#chatListSection) return;

    // Clear existing content
    this.#chatListSection.innerHTML = "";

    if (loading) {
      this.#chatListSection.appendChild(html`
        <div class="loading">Loading chats...</div>
      `);
      return;
    }

    if (!isSignedIn) {
      this.#chatListSection.appendChild(html`
        <div class="empty-state">
          <p>Sign in to see your chat history</p>
        </div>
      `);
      return;
    }

    // Render categorized chat list
    const categoryOrder = ["Today", "Yesterday", "Last 7 Days", "Older"];

    for (const category of categoryOrder) {
      const chats = groupedChats[category];
      if (chats.length === 0) continue;

      const categoryHeader = document.createElement("p");
      categoryHeader.className = "category-header";
      categoryHeader.textContent = category;
      this.#chatListSection.appendChild(categoryHeader);

      for (const chat of chats) {
        const chatItem = new ChatSidebarItem(chat);

        // Highlight current chat
        if (chat.id === currentChatId) {
          chatItem.classList.add("active");
        }

        // Handle chat selection
        chatItem.addEventListener("chat-item-selected", () => {
          this.#handleChatSelect(chat.id);
        });

        // Handle chat deletion
        chatItem.addEventListener("chat-item-delete", (event) => {
          const customEvent = event as CustomEvent;
          const { id, title } = customEvent.detail;
          this.#handleChatDelete(id, title);
        });

        this.#chatListSection.appendChild(chatItem);
      }
    }
  }

  #setupAuthListener() {
    // Check auth status periodically
    setInterval(() => {
      const wasSignedIn = this.#isSignedIn();
      this.#checkAuthStatus();

      // If auth status changed, refresh
      if (wasSignedIn !== this.#isSignedIn()) {
        if (this.#isSignedIn()) {
          this.#loadChats();
        } else {
          this.#chats([]);
          this.#loading(false);
        }
      }
    }, 1000);
  }

  #checkAuthStatus() {
    this.#isSignedIn(authService.isSignedIn());
  }

  async #loadChats() {
    // Double check auth status before making API calls
    if (!authService.isSignedIn()) {
      console.log("User not signed in, skipping chat loading");
      this.#chats([]);
      this.#loading(false);
      return;
    }

    try {
      const response = await authService.fetchWithAuthRetry(
        `${config.apiBaseUrl}/chats`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.chats && Array.isArray(data.chats)) {
          const chats = data.chats.map((chat: any) => ({
            id: chat._id,
            title: chat.title,
            timestamp: new Date(chat.updatedAt),
            updatedAt: chat.updatedAt,
          }));
          this.#chats(chats);
        } else {
          this.#chats([]);
        }
      } else {
        if (response.status === 401) {
          console.error(
            "Authentication failed loading chats - user may need to refresh"
          );
          notificationService.warning(
            "Authentication expired. Please refresh the page to continue."
          );
        } else if (response.status >= 500) {
          console.error(
            "Server error loading chats:",
            response.status,
            "- retries exhausted"
          );
          notificationService.error(
            "Server is experiencing issues. Chat list couldn't be loaded."
          );
        } else {
          console.error("Failed to load chats:", response.status);
          notificationService.warning(
            "Failed to load chat list. Please try refreshing."
          );
        }
        this.#chats([]);
      }
    } catch (error) {
      console.error("Network error loading chats (retries exhausted):", error);
      notificationService.error(
        "Network error loading chat list. Please check your connection."
      );
      this.#chats([]);
    } finally {
      this.#loading(false);
    }
  }

  #getCategoryForDate(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (date >= today) {
      return "Today";
    } else if (date >= yesterday) {
      return "Yesterday";
    } else if (date >= weekAgo) {
      return "Last 7 Days";
    } else {
      return "Older";
    }
  }

  // Event handlers
  handleNewChat = () => {
    this.dispatchEvent(
      new CustomEvent("new-chat-requested", {
        bubbles: true,
        composed: true,
      })
    );
  };

  handleChatSettings = () => {
    if (this.#isSignedIn()) {
      window.location.hash = "#/chat-settings";
    }
  };

  handleUsageDashboard = () => {
    if (this.#isSignedIn()) {
      window.location.hash = "#/usage";
    }
  };

  handleAuth = async () => {
    if (this.#isSignedIn()) {
      try {
        await authService.signOut();
      } catch (error) {
        console.error("Error signing out:", error);
      }
    } else {
      // Navigate to sign-in page
      window.location.hash = "#/sign-in";
    }
  };

  #handleChatSelect = (chatId: string) => {
    // Remove active class from all items
    const allItems =
      this.#chatListSection?.querySelectorAll("chat-sidebar-item");
    allItems?.forEach((item) => item.classList.remove("active"));

    // Add active class to clicked item
    const clickedItem = this.#chatListSection?.querySelector(
      `chat-sidebar-item[data-chat-id="${chatId}"]`
    );
    clickedItem?.classList.add("active");

    this.#currentChatId(chatId);

    this.dispatchEvent(
      new CustomEvent("chat-selected", {
        detail: { id: chatId },
        bubbles: true,
        composed: true,
      })
    );
  };

  #handleChatDelete = (chatId: string, chatTitle: string) => {
    // Dispatch event to parent to show confirmation dialog
    this.dispatchEvent(
      new CustomEvent("chat-delete-requested", {
        detail: { id: chatId, title: chatTitle },
        bubbles: true,
        composed: true,
      })
    );
  };

  // Public API methods
  public async refreshChats() {
    this.#checkAuthStatus();
    if (!this.#isSignedIn()) {
      this.#chats([]);
      this.#loading(false);
      return;
    }

    this.#loading(true);
    await this.#loadChats();
  }

  public setCurrentChat(chatId: string | null) {
    this.#currentChatId(chatId);
  }

  public removeChat(chatId: string) {
    // Remove the chat from the local state
    const currentChats = this.#chats();
    const updatedChats = currentChats.filter((chat) => chat.id !== chatId);
    this.#chats(updatedChats);

    // If the removed chat was the current chat, clear selection
    if (this.#currentChatId() === chatId) {
      this.#currentChatId(null);
    }
  }
}

if (!customElements.get("chat-sidebar")) {
  customElements.define("chat-sidebar", ChatSidebar);
}

class ChatSidebarItem extends Component {
  #id = signal<string>("");
  #title = signal<string>("");

  constructor(chat: ChatItem) {
    super();
    this.#id(chat.id);
    this.#title(chat.title);
    this.setAttribute("data-chat-id", chat.id);
  }

  init() {
    this.append(html`
      <li class="chat-item-container">
        <div class="chat-item-content" @click="handleItemClick">
          <p class="title"></p>
        </div>
        <button
          class="delete-btn"
          @click="handleDeleteClick"
          title="Delete chat"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c0 1 1 2 2 2v2"></path>
          </svg>
        </button>
      </li>
    `);

    // Wire up reactive effects
    effect(() => {
      const titleElement = this.querySelector(".title") as HTMLElement;
      if (titleElement) {
        titleElement.textContent = this.#title();
      }
    });
  }

  handleItemClick = (event: Event) => {
    event.stopPropagation();
    // Dispatch the chat selection event
    this.dispatchEvent(
      new CustomEvent("chat-item-selected", {
        detail: { id: this.#id() },
        bubbles: true,
        composed: true,
      })
    );
  };

  handleDeleteClick = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();

    // Dispatch the delete event
    this.dispatchEvent(
      new CustomEvent("chat-item-delete", {
        detail: { id: this.#id(), title: this.#title() },
        bubbles: true,
        composed: true,
      })
    );
  };

  get id() {
    return this.#id();
  }
}

if (!customElements.get("chat-sidebar-item")) {
  customElements.define("chat-sidebar-item", ChatSidebarItem);
}
