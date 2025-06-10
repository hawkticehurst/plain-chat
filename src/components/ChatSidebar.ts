import { Component, html, signal } from "../lib/index";
import type { Signal } from "../lib/index";

interface ChatItem {
  id: string;
  title: string;
  timestamp: Date;
}

export class ChatSidebar extends Component {
  private _chats: Array<ChatItem> = [];

  constructor() {
    super();
    this._chats = [
      {
        id: "1",
        title: "AI Assistant",
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      },
      {
        id: "2",
        title: "Code Helper",
        timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
      {
        id: "3",
        title: "Writing Assistant",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      },
      {
        id: "4",
        title: "Data Analysis",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        id: "5",
        title: "Project Planning",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      },
      {
        id: "6",
        title: "Research Helper",
        timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      },
    ];
  }

  connectedCallback() {
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
      <section class="chat-list"></section>
    `;

    this.innerHTML = String(template);

    // Add event listeners
    const newChatBtn = this.querySelector(".new-chat-btn");
    const aiSettingsBtn = this.querySelector(".ai-settings-btn");
    const usageDashboardBtn = this.querySelector(".usage-dashboard-btn");

    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => {
        // Handle new chat creation
        console.log("New chat clicked");
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

    const chatList = this.querySelector(".chat-list");
    if (chatList) {
      const groupedChats = this.groupChatsByCategory();
      const categoryOrder = ["Today", "Yesterday", "Last 7 Days", "Older"];

      for (const category of categoryOrder) {
        const chats = groupedChats[category];
        if (chats.length === 0) continue;

        const categoryHeader = document.createElement("p");
        categoryHeader.className = "category-header";
        categoryHeader.textContent = category;
        chatList.appendChild(categoryHeader);

        // const ul = document.createElement("ul");

        for (const chat of chats) {
          const chatItem = new ChatSidebarItem(chat);
          chatItem.addEventListener("click", () => {
            this.dispatchEvent(
              new CustomEvent("chat-selected", {
                detail: { id: chatItem.id },
                bubbles: true,
                composed: true,
              })
            );
          });
          // ul.appendChild(chatItem);
          chatList.appendChild(chatItem);
        }
      }
    }
  }
}

customElements.define("chat-sidebar", ChatSidebar);

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

customElements.define("chat-sidebar-item", ChatSidebarItem);
