import { Component, html, authService, router } from "@lib";
import "./App.css";
import "./components/ChatSidebar";
import "./components/ChatMain";
import "./components/ChatSettings";
import "./components/UsageDashboard";
import "./components/NotificationComponent";

export class App extends Component {
  #pageContainer: HTMLElement | null = null;

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
    // Create the stable app shell structure
    this.append(html` <div id="page-content"></div> `);

    // Get reference to the stable container
    this.#pageContainer = this.querySelector("#page-content");

    // Set up routes using Component-Scoped Routing pattern
    router.createRoute("/", () => {
      this.#clearAndRender(html`
        <chat-sidebar></chat-sidebar>
        <chat-main></chat-main>
        <notification-component></notification-component>
      `);
      this.setupChatEventListeners();
    });

    router.createRoute("/sign-in", () => {
      this.#clearAndRender(html`
        <div class="auth-required">
          <div id="clerk-signin"></div>
        </div>
      `);
      this.setupSignIn();
    });

    router.createRoute("/chat-settings", () => {
      this.#clearAndRender(html`<chat-settings></chat-settings>`);
    });

    router.createRoute("/usage", () => {
      this.#clearAndRender(html`<usage-dashboard></usage-dashboard>`);
    });

    // Initialize router
    router.init();
  }

  /**
   * Helper method to clear the page container and render new content
   * This prevents pages from stacking on top of each other
   */
  #clearAndRender(content: DocumentFragment) {
    if (this.#pageContainer) {
      this.#pageContainer.innerHTML = "";
      this.#pageContainer.append(content);
    }
  }

  private setupSignIn() {
    const signInDiv = this.#pageContainer?.querySelector("#clerk-signin");
    if (signInDiv && authService.getClerkInstance()) {
      authService.getClerkInstance().mountSignIn(signInDiv);
    }
  }

  private setupChatEventListeners() {
    const sidebar = this.#pageContainer?.querySelector("chat-sidebar");
    const chatMain = this.#pageContainer?.querySelector("chat-main");

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
