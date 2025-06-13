import { Component, html, authService, router } from "@lib";
import type { AuthStatus } from "@lib";
import "./components/ChatSidebar";
import "./components/ChatMain";
import "./components/AISettings";
import "./components/UsageDashboard";
import "./components/NotificationComponent";

export class App extends Component {
  private _authStatus: AuthStatus = { isAuthenticated: false, userId: null };

  constructor() {
    super();
    this.getAuthStatus();
  }

  private async getAuthStatus() {
    this._authStatus = await authService.getAuthStatus();
  }

  // Initial component setup - This will be called only once
  async init() {
    router.createRoute("/", () => {
      this.innerHTML = String(html`
        <chat-sidebar></chat-sidebar>
        <chat-main></chat-main>
        <notification-component></notification-component>
      `);
      this._setupChatEventListeners();
    });

    router.createRoute("/sign-in", () => {
      this.innerHTML = String(html`
        <div class="auth-required">
          <div id="clerk-signin"></div>
        </div>
      `);
    });

    router.createRoute("/ai-settings", () => {
      this.innerHTML = String(html`<ai-settings></ai-settings>`);
    });

    router.createRoute("/usage", () => {
      this.innerHTML = String(html`<usage-dashboard></usage-dashboard>`);
    });

    if (!this._authStatus.isAuthenticated) {
      router.navigate("/sign-in");
      await this.initializeClerk();
      return;
    }
  }

  private _setupChatEventListeners() {
    const sidebar = this.querySelector("chat-sidebar");
    const chatMain = this.querySelector("chat-main");

    if (sidebar && chatMain) {
      // Handle chat selection
      sidebar.addEventListener("chat-selected", (event: Event) => {
        const customEvent = event as CustomEvent;
        const { id } = customEvent.detail;
        (chatMain as any).loadChat(id);
        (sidebar as any).setCurrentChat(id);
      });

      // Handle new chat request (don't create DB record yet)
      sidebar.addEventListener("new-chat-requested", () => {
        (chatMain as any).startNewChat();
        (sidebar as any).setCurrentChat(null);
      });

      // Handle new chat creation from main (when sending first message)
      chatMain.addEventListener("chat-created", (event: Event) => {
        const customEvent = event as CustomEvent;
        const { chatId } = customEvent.detail;
        (sidebar as any).refreshChats();
        (sidebar as any).setCurrentChat(chatId);
      });

      // Handle chat title updates
      chatMain.addEventListener("chat-title-updated", () => {
        (sidebar as any).refreshChats();
      });
    }
  }

  private async initializeClerk() {
    try {
      const signInDiv = this.querySelector("#clerk-signin") as HTMLDivElement;
      await authService.init(signInDiv, (user) => {
        this._authStatus = { isAuthenticated: true, userId: user.id };
        // Refresh the sidebar to load chats and update auth button state
        const sidebar = document.querySelector("chat-sidebar") as any;
        if (sidebar) {
          sidebar.refreshChats(); // This will check auth status and load chats
        }
        router.navigate("/");
      });
    } catch (error) {
      console.error("Error initializing Clerk:", error);
      this.innerHTML =
        '<div class="error">Error loading authentication. Please refresh the page.</div>';
    }
  }
}

if (!customElements.get("chat-app")) {
  customElements.define("chat-app", App);
}
