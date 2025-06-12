import { Component, html, signal, config, authService } from "@lib";
import type { Signal } from "@lib";

interface ChatItem {
  id: string;
  title: string;
  timestamp: Date;
  updatedAt: number;
}

export class ChatSidebar extends Component {
  private _chats: Array<ChatItem> = [];
  private _loading = true;
  private _currentChatId: string | null = null;

  constructor() {
    super();
    this.loadChats();
  }

  connectedCallback() {
    this.render();
  }

  private async loadChats() {
    try {
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/chats`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.chats && Array.isArray(data.chats)) {
          this._chats = data.chats.map((chat: any) => ({
            id: chat._id,
            title: chat.title,
            timestamp: new Date(chat.updatedAt),
            updatedAt: chat.updatedAt,
          }));
        } else {
          this._chats = [];
        }
      } else {
        console.error("Failed to load chats:", response.status);
        this._chats = [];
      }
    } catch (error) {
      console.error("Error loading chats:", error);
      this._chats = [];
    } finally {
      this._loading = false;
      this.render();
    }
  }

  public async refreshChats() {
    this._loading = true;
    this.render();
    await this.loadChats();
  }

  public setCurrentChat(chatId: string | null) {
    this._currentChatId = chatId;
    this.render();
  }

  private getCategoryForDate(date: Date): string {
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

  private groupChatsByCategory(): Record<string, ChatItem[]> {
    const categories: Record<string, ChatItem[]> = {
      Today: [],
      Yesterday: [],
      "Last 7 Days": [],
      Older: [],
    };

    for (const chat of this._chats) {
      const category = this.getCategoryForDate(chat.timestamp);
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
  }

  render() {
    const template = html`
      <section class="header">
        <button class="new-chat-btn">New Chat</button>
        <button class="ai-settings-btn">AI Settings</button>
        <button class="usage-dashboard-btn">Usage Dashboard</button>
      </section>
      <section class="chat-list">
        ${this._loading
          ? html`<div class="loading">Loading chats...</div>`
          : ""}
      </section>
    `;

    this.innerHTML = String(template);

    // Add event listeners
    const newChatBtn = this.querySelector(".new-chat-btn");
    const aiSettingsBtn = this.querySelector(".ai-settings-btn");
    const usageDashboardBtn = this.querySelector(".usage-dashboard-btn");

    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => {
        // Just dispatch an event to start a new chat (don't create in DB yet)
        this.dispatchEvent(
          new CustomEvent("new-chat-requested", {
            bubbles: true,
            composed: true,
          })
        );
      });
    }

    if (aiSettingsBtn) {
      aiSettingsBtn.addEventListener("click", () => {
        window.location.hash = "#/ai-settings";
      });
    }

    if (usageDashboardBtn) {
      usageDashboardBtn.addEventListener("click", () => {
        window.location.hash = "#/usage";
      });
    }

    if (!this._loading) {
      const chatList = this.querySelector(".chat-list");
      if (chatList) {
        // Clear loading message
        chatList.innerHTML = "";

        const groupedChats = this.groupChatsByCategory();
        const categoryOrder = ["Today", "Yesterday", "Last 7 Days", "Older"];

        for (const category of categoryOrder) {
          const chats = groupedChats[category];
          if (chats.length === 0) continue;

          const categoryHeader = document.createElement("p");
          categoryHeader.className = "category-header";
          categoryHeader.textContent = category;
          chatList.appendChild(categoryHeader);

          for (const chat of chats) {
            const chatItem = new ChatSidebarItem(chat);

            // Highlight current chat
            if (chat.id === this._currentChatId) {
              chatItem.classList.add("active");
            }

            chatItem.addEventListener("click", () => {
              // Remove active class from all items
              const allItems = chatList.querySelectorAll("chat-sidebar-item");
              allItems.forEach((item) => item.classList.remove("active"));

              // Add active class to clicked item
              chatItem.classList.add("active");

              this.dispatchEvent(
                new CustomEvent("chat-selected", {
                  detail: { id: chat.id },
                  bubbles: true,
                  composed: true,
                })
              );
            });
            chatList.appendChild(chatItem);
          }
        }
      }
    }
  }
}

if (!customElements.get("chat-sidebar")) {
  customElements.define("chat-sidebar", ChatSidebar);
}

class ChatSidebarItem extends Component {
  private _id: Signal<string>;
  private _title: Signal<string>;

  constructor(chat: ChatItem) {
    super();
    this._id = signal<string>(chat.id, []);
    this._title = signal<string>(chat.title, []);
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const template = html`
      <li class="header">
        <p class="title">${this._title.value}</p>
      </li>
    `;
    this.innerHTML = String(template);
  }

  get id() {
    return this._id.value;
  }
}

if (!customElements.get("chat-sidebar-item")) {
  customElements.define("chat-sidebar-item", ChatSidebarItem);
}
