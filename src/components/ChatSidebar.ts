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
  #isCollapsed = signal<boolean>(false);

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
    // Load collapsed state from localStorage
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null) {
      this.#isCollapsed(savedState === "true");
    }

    this.#checkAuthStatus();
    this.#setupAuthListener();
  }

  init() {
    // Build the DOM structure once
    this.append(html`
      <section class="header">
        <button class="new-chat-btn" @click="handleNewChat">New Chat</button>
      </section>
      <section class="chat-list"></section>
      <section class="footer">
        <button class="auth-btn" @click="handleAuth"></button>
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

    // Apply collapsed state to the component
    effect(() => {
      const isCollapsed = this.#isCollapsed();

      if (isCollapsed) {
        this.classList.add("collapsed");
      } else {
        this.classList.remove("collapsed");
      }
    });

    // Enable/disable buttons based on auth status
    effect(() => {
      const isSignedIn = this.#isSignedIn();
      const chatSettingsBtn = this.#headerSection?.querySelector(
        ".chat-settings-btn"
      ) as HTMLButtonElement;

      if (chatSettingsBtn) chatSettingsBtn.disabled = !isSignedIn;
    });

    // Update chat list when chats, loading, or auth state changes
    effect(() => {
      if (!this.#chatListSection) return;

      const isSignedIn = this.#isSignedIn();
      const groupedChats = this.#groupedChats();
      const currentChatId = this.#currentChatId();

      this.#renderChatList(isSignedIn, groupedChats, currentChatId);
    });
  }

  #renderChatList(
    isSignedIn: boolean,
    groupedChats: Record<string, ChatItem[]>,
    currentChatId: string | null
  ) {
    if (!this.#chatListSection) return;

    // Clear existing content
    this.#chatListSection.innerHTML = "";

    if (!isSignedIn) {
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
    // Just dispatch the event - let the App handle everything
    this.dispatchEvent(
      new CustomEvent("chat-selected", {
        detail: { id: chatId },
        bubbles: true,
        composed: true,
      })
    );
  };

  #handleChatDelete = (id: string, title: string) => {
    this.dispatchEvent(
      new CustomEvent("chat-delete-requested", {
        detail: { id, title },
        bubbles: true,
        composed: true,
      })
    );
  };

  // Public API methods
  public toggleCollapse() {
    const newState = !this.#isCollapsed();
    this.#isCollapsed(newState);
    // Persist state to localStorage
    localStorage.setItem("sidebar-collapsed", String(newState));
  }

  public isCollapsed(): boolean {
    return this.#isCollapsed();
  }

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

  /**
   * Updates a specific chat's title without doing a full refresh
   * This provides immediate UI feedback when titles are generated
   */
  public updateChatTitle(chatId: string, newTitle: string) {
    const currentChats = this.#chats();
    const updatedChats = currentChats.map((chat) =>
      chat.id === chatId
        ? { ...chat, title: newTitle, timestamp: new Date() }
        : chat
    );

    // Check if we found and updated the chat
    const chatFound = updatedChats.some(
      (chat) => chat.id === chatId && chat.title === newTitle
    );
    if (chatFound) {
      this.#chats(updatedChats);

      // Also update the specific chat item in the DOM with animation
      const chatItem = this.#chatListSection?.querySelector(
        `chat-sidebar-item[data-chat-id="${chatId}"]`
      ) as any;
      if (chatItem && typeof chatItem.updateTitleWithAnimation === "function") {
        chatItem.updateTitleWithAnimation(newTitle);
      }
    } else {
      // The chat might be new and not yet in our local state
      // Do a full refresh to ensure we have the latest data
      this.refreshChats();
    }
  }

  public setCurrentChat(chatId: string | null) {
    // Prevent duplicate setting of the same chat
    if (this.#currentChatId() === chatId) {
      return;
    }

    this.#currentChatId(chatId);

    // Update visual state immediately
    const allItems =
      this.#chatListSection?.querySelectorAll("chat-sidebar-item");
    allItems?.forEach((item) => item.classList.remove("active"));

    if (chatId && this.#chatListSection) {
      const currentItem = this.#chatListSection.querySelector(
        `chat-sidebar-item[data-chat-id="${chatId}"]`
      );
      if (currentItem) {
        currentItem.classList.add("active");
      }
    }
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
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
            />
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
  } /**
   * Updates the title with a smooth fade animation
   */
  public updateTitleWithAnimation(newTitle: string) {
    const titleElement = this.querySelector(".title") as HTMLElement;
    if (!titleElement) {
      // Fallback to signal update if element not found
      this.#title(newTitle);
      return;
    }

    // Start fade out using CSS class
    titleElement.classList.add("updating");

    // After fade out completes, update text and fade in
    setTimeout(() => {
      this.#title(newTitle); // Update the signal
      titleElement.textContent = newTitle; // Update DOM directly for immediate effect
      titleElement.classList.remove("updating");
    }, 200);
  }

  /**
   * Updates the title without animation (for regular updates)
   */
  public updateTitle(newTitle: string) {
    this.#title(newTitle);
  }
}

if (!customElements.get("chat-sidebar-item")) {
  customElements.define("chat-sidebar-item", ChatSidebarItem);
}
