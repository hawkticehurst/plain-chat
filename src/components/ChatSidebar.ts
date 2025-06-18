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
import { authStore } from "../stores/AuthStore";
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
  #isCollapsed = signal<boolean>(false);

  // DOM references
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

    // Check if we're on a mobile/small screen device
    const isMobile = window.innerWidth <= 768;

    // Load collapsed state from localStorage, but default to collapsed when signed out or on mobile
    const savedState = localStorage.getItem("sidebar-collapsed");
    if (savedState !== null && authStore.isAuthenticated() && !isMobile) {
      // If user is signed in and not on mobile, respect their saved preference
      this.#isCollapsed(savedState === "true");
    } else if (authStore.isAuthenticated() && !isMobile) {
      // If user is signed in but no saved state and not on mobile, default to open
      this.#isCollapsed(false);
    } else {
      // If user is signed out or on mobile, always collapse
      this.#isCollapsed(true);
    }

    this.#setupAuthListener();
    this.#setupResizeListener();
    this.#setupClickOutsideListener();
    this.#setupTouchGestures();
    this.#setupClickOutsideListener();
    this.#setupTouchGestures();
  }

  init() {
    // Build the DOM structure once
    this.append(html`
      <section class="header">
        <button class="new-chat-btn" @click="handleNewChat">New Chat</button>
      </section>
      <section class="chat-list"></section>
    `);

    // Cache DOM references
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

    // If not signed in, stop loading
    if (!authStore.isAuthenticated()) {
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
    // Hide footer completely - sign in moved to ChatMain empty state
    effect(() => {
      if (this.#footerSection) {
        this.#footerSection.style.display = "none";
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

    // Update chat list when chats, loading, or auth state changes
    effect(() => {
      if (!this.#chatListSection) return;

      const isSignedIn = authStore.isAuthenticated();
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
    // Listen for auth status changes from the global store
    window.addEventListener("auth-status-changed", (event: any) => {
      const { isSignedIn } = event.detail;
      const isMobile = window.innerWidth <= 768;

      if (isSignedIn) {
        this.#loadChats();

        // When user signs in, check screen size and saved preference
        const savedState = localStorage.getItem("sidebar-collapsed");
        if (isMobile) {
          // On mobile, default to collapsed regardless of saved state
          this.#isCollapsed(true);
        } else if (savedState === null) {
          // No saved preference, default to open for signed-in users on desktop
          this.#isCollapsed(false);
          localStorage.setItem("sidebar-collapsed", "false");
        } else {
          // Respect their saved preference on desktop
          this.#isCollapsed(savedState === "true");
        }
      } else {
        this.#chats([]);
        this.#loading(false);
        // Collapse sidebar when user signs out
        this.#isCollapsed(true);
        // Note: We don't persist the collapsed state on sign out
        // This allows the user to have their preference restored on sign in
      }
    });
  }

  #setupResizeListener() {
    // Listen for window resize events to handle mobile/desktop transitions
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;

      // If switching to mobile and sidebar is open, close it
      if (isMobile && !this.#isCollapsed() && authStore.isAuthenticated()) {
        this.#isCollapsed(true);
        // Don't persist this state change as it's due to screen size
      }
      // If switching from mobile to desktop and user is signed in, restore their preference
      else if (!isMobile && authStore.isAuthenticated()) {
        const savedState = localStorage.getItem("sidebar-collapsed");
        if (savedState !== null) {
          this.#isCollapsed(savedState === "true");
        } else {
          // Default to open on desktop if no saved preference
          this.#isCollapsed(false);
        }
      }
    };

    // Debounce resize events
    let resizeTimeout: number;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(handleResize, 150);
    };

    window.addEventListener("resize", debouncedResize);

    // Store reference to remove listener if needed
    (this as any)._resizeHandler = debouncedResize;
  }

  #setupClickOutsideListener() {
    // Add click outside listener for mobile to close sidebar
    const handleClickOutside = (event: MouseEvent) => {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile || this.#isCollapsed()) return;

      // Check if click is outside the sidebar
      const target = event.target as Element;
      const rect = this.getBoundingClientRect();
      const clickX = event.clientX;
      const clickY = event.clientY;

      // If click is outside the sidebar bounds
      const isOutside =
        clickX < rect.left ||
        clickX > rect.right ||
        clickY < rect.top ||
        clickY > rect.bottom;

      if (isOutside) {
        // Check if click is on the toggle button (don't close if so)
        const toggleButton = document.querySelector(".sidebar-toggle-btn");
        if (!toggleButton || !toggleButton.contains(target)) {
          this.#isCollapsed(true);
        }
      }
    };

    document.addEventListener("click", handleClickOutside);

    // Store reference to remove listener if needed
    (this as any)._clickOutsideHandler = handleClickOutside;
  }

  #setupTouchGestures() {
    // Add swipe to close gesture for mobile
    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const handleTouchStart = (event: TouchEvent) => {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile || this.#isCollapsed()) return;

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const isMobile = window.innerWidth <= 768;
      if (!isMobile || this.#isCollapsed()) return;

      const touch = event.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      const endTime = Date.now();

      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const deltaTime = endTime - startTime;

      // Check if it's a horizontal swipe left (to close sidebar)
      const isSwipeLeft =
        deltaX < -50 && Math.abs(deltaY) < 100 && deltaTime < 300;

      if (isSwipeLeft) {
        this.#isCollapsed(true);
      }
    };

    this.addEventListener("touchstart", handleTouchStart, { passive: true });
    this.addEventListener("touchend", handleTouchEnd, { passive: true });
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

    // Only persist state to localStorage on desktop
    // On mobile, sidebar state changes are temporary
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      localStorage.setItem("sidebar-collapsed", String(newState));
    }
  }

  public isCollapsed(): boolean {
    return this.#isCollapsed();
  }

  public async refreshChats() {
    if (!authStore.isAuthenticated()) {
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

  // Cleanup method to remove event listeners (good practice)
  disconnectedCallback() {
    // Remove event listeners to prevent memory leaks
    if ((this as any)._clickOutsideHandler) {
      document.removeEventListener("click", (this as any)._clickOutsideHandler);
    }

    if ((this as any)._resizeHandler) {
      window.removeEventListener("resize", (this as any)._resizeHandler);
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
