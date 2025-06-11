import { Component, html, authService } from "./lib/index";
import type { AuthStatus } from "./lib/index";
import "./components/ChatSidebar";
import "./components/ChatMain";
import "./components/AISettings";
import "./components/UsageDashboard";

export class App extends Component {
  private _authStatus: AuthStatus = { isAuthenticated: false, userId: null };
  private _loading = true;
  private _currentRoute = "";

  constructor() {
    super();
    this.checkAuthStatus();
    this._setupRouting();
  }

  private _setupRouting() {
    // Listen for hash changes
    window.addEventListener("hashchange", () => {
      this._handleRouteChange();
    });

    // Handle initial route
    this._handleRouteChange();
  }

  private _handleRouteChange() {
    this._currentRoute = window.location.hash.slice(1) || "/";
    if (!this._loading) {
      this.render();
    }
  }

  private async checkAuthStatus() {
    this._authStatus = await authService.getAuthStatus();
    this._loading = false;
    this.render();
  }

  render() {
    if (this._loading) {
      this.innerHTML = '<div class="loading">Loading...</div>';
      return;
    }

    if (!this._authStatus.isAuthenticated) {
      const template = html`
        <div class="auth-required">
          <h1>Welcome to Chat App</h1>
          <div id="clerk-signin"></div>
        </div>
      `;
      this.innerHTML = String(template);

      this.initializeClerk();
      return;
    }

    // Authenticated user - handle routing
    if (this._currentRoute === "/ai-settings") {
      const template = html`
        <div class="single-page-container">
          <ai-settings></ai-settings>
        </div>
      `;
      this.innerHTML = String(template);
      return;
    }

    if (this._currentRoute === "/usage") {
      const template = html`
        <div class="single-page-container">
          <usage-dashboard></usage-dashboard>
        </div>
      `;
      this.innerHTML = String(template);
      return;
    }

    // Default chat interface
    const template = html`
      <div class="chat-app-container">
        <chat-sidebar></chat-sidebar>
        <chat-main></chat-main>
      </div>
    `;

    this.innerHTML = String(template);

    // Set up event listeners for chat interactions
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
      const { Clerk } = await import("@clerk/clerk-js");

      const publicKey =
        "pk_test_Z3Jvd24tcGVyY2gtNDcuY2xlcmsuYWNjb3VudHMuZGV2JA";
      const clerk = new Clerk(publicKey);
      await clerk.load();

      authService.setClerk(clerk);

      if (clerk.user) {
        // User is already signed in, refresh the app
        this._authStatus = { isAuthenticated: true, userId: clerk.user.id };
        this.render();
        return;
      }

      // Mount the sign-in component
      const signInDiv = this.querySelector("#clerk-signin") as HTMLDivElement;
      if (signInDiv) {
        clerk.mountSignIn(signInDiv);
      }

      // Listen for sign-in events
      clerk.addListener(({ user }) => {
        if (user) {
          // Update auth service with the clerk instance
          authService.setClerk(clerk);
          this._authStatus = { isAuthenticated: true, userId: user.id };
          this.render();
        }
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
