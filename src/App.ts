import { Component, html, authService, router } from "@lib";
import "./components/ChatSidebar";
import "./components/ChatMain";
import "./components/AISettings";
import "./components/UsageDashboard";
import "./components/NotificationComponent";

export class App extends Component {
  constructor() {
    super();
    this.initializeClerkEarly();
  }

  private async initializeClerkEarly() {
    try {
      // Initialize Clerk early to handle OAuth redirects
      const publicKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

      if (!publicKey) {
        throw new Error(
          "VITE_CLERK_PUBLISHABLE_KEY environment variable is required"
        );
      }

      const { Clerk } = await import("@clerk/clerk-js");
      const clerk = new Clerk(publicKey);

      // Use minimal configuration - let environment variables handle redirects
      // This avoids the deprecated redirectUrl warning
      await clerk.load();

      authService.setClerk(clerk);

      // Handle OAuth redirects if present
      if (authService.isOAuthRedirect()) {
        console.log("OAuth redirect detected, handling callback...");
        await authService.handleRedirectCallback();
        // After handling the redirect, navigate to home and refresh sidebar
        window.location.hash = "/";

        // Trigger a refresh of the sidebar after OAuth completion
        setTimeout(() => {
          const sidebar = document.querySelector("chat-sidebar") as any;
          if (sidebar && sidebar.refreshChats) {
            sidebar.refreshChats();
          }
        }, 500);
        return;
      }
    } catch (error) {
      console.error("Error initializing Clerk:", error);
    }
  }

  // Initial component setup - This will be called only once
  async init() {
    // Set up routes first
    router.createRoute("/", () => {
      this.innerHTML = String(html`
        <chat-sidebar></chat-sidebar>
        <chat-main></chat-main>
        <notification-component></notification-component>
      `);
      this.setupChatEventListeners();
    });

    router.createRoute("/sign-in", () => {
      this.innerHTML = String(html`
        <div class="auth-required">
          <div id="clerk-signin"></div>
        </div>
      `);
      this.setupSignIn();
    });

    router.createRoute("/ai-settings", () => {
      this.innerHTML = String(html`<ai-settings></ai-settings>`);
    });

    router.createRoute("/usage", () => {
      this.innerHTML = String(html`<usage-dashboard></usage-dashboard>`);
    });

    // Always start at home
    router.navigate("/");
  }

  private setupSignIn() {
    const signInDiv = this.querySelector("#clerk-signin");
    if (signInDiv && authService.getClerkInstance()) {
      authService.getClerkInstance().mountSignIn(signInDiv);
    }
  }

  private setupChatEventListeners() {
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
      });

      // Handle chat deletion
      sidebar.addEventListener("chat-deleted", () => {
        (chatMain as any).startNewChat();
      });

      // Handle chat title updates
      chatMain.addEventListener("chat-title-updated", () => {
        (sidebar as any).refreshChats();
      });
    }
  }
}

if (!customElements.get("chat-app")) {
  customElements.define("chat-app", App);
}
