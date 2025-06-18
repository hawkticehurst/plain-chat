import { Component, html, authService, router } from "@lib";
import { notificationService } from "./components/NotificationComponent";
import type { ChatSidebar } from "./components/ChatSidebar";
import type { ChatMain } from "./components/ChatMain";
import type { ConfirmDialog } from "./components/ConfirmDialog";
import "./components/ChatSidebar";
import "./components/ChatMain";
import "./components/ChatSettings";
import "./components/UsageDashboard";
import "./components/NotificationComponent";
import "./components/ConfirmDialog";
import "./App.css";

export class App extends Component {
  #sidebar: ChatSidebar | null = null;
  #chat: ChatMain | null = null;
  #confirmDialog: ConfirmDialog | null = null;
  #previousSidebarState: boolean | null = null;

  constructor() {
    super();
    this.initClerk();
  }

  async init() {
    router.createRoute("/", () => {
      this.renderAppShell();
      // Restore previous sidebar state if we're coming from settings
      if (this.#previousSidebarState !== null && this.#sidebar) {
        const currentState = this.#sidebar.isCollapsed();
        if (currentState !== this.#previousSidebarState) {
          this.#sidebar.toggleCollapse();
        }
        this.#previousSidebarState = null;
      }
    });

    router.createRoute("/chat/:id", async (params) => {
      const chatId = params.id;

      // Validate that chatId is not empty
      if (!chatId || chatId.trim() === "") {
        router.navigate("/");
        return;
      }

      // Check if app shell is already rendered
      const isAppShellRendered = this.isAppShellRendered();

      if (!isAppShellRendered) {
        // Full app render needed (page refresh or direct navigation)
        this.renderAppShell();
      }

      // Wait for auth to be ready before loading the chat
      const authReady = await authService.waitForReady(10000);

      if (!authReady || !authService.isSignedIn()) {
        // Store the intended chat URL for after auth
        sessionStorage.setItem("redirect-after-auth", `/chat/${chatId}`);
        router.navigate("/sign-in");
        return;
      }

      // Wait for Clerk session to be fully available for token generation
      await authService.waitForSessionReady(3000);

      // Load the specific chat after auth is confirmed ready
      if (this.#chat && this.#sidebar) {
        // Restore previous sidebar state if we're coming from settings
        if (this.#previousSidebarState !== null) {
          const currentState = this.#sidebar.isCollapsed();
          if (currentState !== this.#previousSidebarState) {
            this.#sidebar.toggleCollapse();
          }
          this.#previousSidebarState = null;
        }

        this.#chat.loadChat(chatId);
        this.#sidebar.setCurrentChat(chatId);
      }
    });

    router.createRoute("/sign-in", async () => {
      this.innerHTML = "";
      this.append(html`
        <div class="auth-required">
          <div id="clerk-signin"></div>
        </div>
      `);
      await this.setupSignIn();
    });

    router.createRoute("/chat-settings", async () => {
      await this.loadSettingsRoute();
    });

    router.createRoute("/usage", () => {
      this.innerHTML = "";
      this.append(html`<usage-dashboard></usage-dashboard>`);
    });

    // Initialize router
    router.init();
  }

  private async initClerk() {
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

      // Load without config - use environment variables instead
      await clerk.load();

      authService.setClerk(clerk);

      // Handle OAuth redirects if present
      if (authService.isOAuthRedirect()) {
        await authService.handleRedirectCallback();
        return;
      }
    } catch (error) {
      console.error("Error initializing Clerk:", error);
    }
  }
  private async setupSignIn() {
    const signInDiv = this.querySelector("#clerk-signin");
    if (!signInDiv) {
      console.error("Failed to setup sign-in: missing div");
      return;
    }

    // Wait for Clerk to be initialized
    let attempts = 0;
    while (!authService.getClerkInstance() && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    const clerk = authService.getClerkInstance();
    if (!clerk) {
      console.error(
        "Failed to setup sign-in: Clerk not initialized after waiting"
      );
      return;
    }

    // Clear any stored redirect to prevent interference
    sessionStorage.removeItem("redirect-after-auth");

    // Mount without redirect URLs to avoid conflicts - let natural flow handle it
    clerk.mountSignIn(signInDiv);

    // Add a listener to handle successful sign-in
    const checkForSignIn = () => {
      if (clerk.user) {
        // Use window.location.hash to trigger router
        window.location.hash = "#/";
        return true;
      }
      return false;
    };

    // Check immediately in case user is already signed in
    if (!checkForSignIn()) {
      // Poll for sign-in completion if not already signed in
      const pollInterval = setInterval(() => {
        if (checkForSignIn()) {
          clearInterval(pollInterval);
        }
      }, 500);

      // Clear polling after 2 minutes to avoid infinite polling
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 120000);
    }
  }

  private isAppShellRendered(): boolean {
    // Check if the main app components exist
    return !!(
      this.querySelector("chat-sidebar") &&
      this.querySelector("chat-main") &&
      this.querySelector("confirm-dialog") &&
      this.querySelector("notification-component")
    );
  }

  private renderAppShell() {
    this.innerHTML = ""; // Clear previous content
    this.append(html`
      <chat-sidebar
        @chat-selected="selectChat"
        @new-chat-requested="newChat"
        @chat-deleted="deleteChat"
        @chat-delete-requested="handleDeleteRequest"
        @chat-title-updated="chatTitleUpdated"
      ></chat-sidebar>
      <chat-main
        @chat-deleted="handleChatDeleted"
        @chat-error="handleChatError"
        @chat-created="handleChatCreated"
        @chat-title-updated="chatTitleUpdated"
      ></chat-main>
      <div class="gradient" role="presentation"></div>
      <notification-component></notification-component>
      <confirm-dialog></confirm-dialog>
    `);
    this.#sidebar = this.querySelector("chat-sidebar") as ChatSidebar;
    this.#chat = this.querySelector("chat-main") as ChatMain;
    this.#confirmDialog = this.querySelector("confirm-dialog") as ConfirmDialog;
    // Process event attributes after components are created
    this._processEventAttributes();
  }

  handleChatSettings = () => {
    // Force route execution if we're not already on settings
    if (router.currentRoute !== "/chat-settings") {
      router.navigate("/chat-settings");
      // Fallback: manually execute settings route if navigation doesn't trigger properly
      setTimeout(() => {
        if (router.currentRoute !== "/chat-settings") {
          // Manually execute the settings route
          this.loadSettingsRoute();
        }
      }, 100);
    }
  };

  private async loadSettingsRoute() {
    // Check if app shell is already rendered
    const isAppShellRendered = this.isAppShellRendered();

    if (!isAppShellRendered) {
      // Full app render needed (page refresh or direct navigation)
      this.renderAppShell();
    }

    // Wait for auth to be ready before loading the settings
    const authReady = await authService.waitForReady(10000);

    if (!authReady || !authService.isSignedIn()) {
      // Store the intended settings URL for after auth
      sessionStorage.setItem("redirect-after-auth", "/chat-settings");
      router.navigate("/sign-in");
      return;
    }

    // Wait for Clerk session to be fully available for token generation
    await authService.waitForSessionReady(3000);

    // Load the settings page after auth is confirmed ready
    if (this.#chat && this.#sidebar) {
      // Store current sidebar state and collapse it
      this.#previousSidebarState = this.#sidebar.isCollapsed();
      if (!this.#sidebar.isCollapsed()) {
        this.#sidebar.toggleCollapse();
      }
      this.#chat.loadSettings();
    }
  }

  public selectChat(event: Event) {
    const customEvent = event as CustomEvent;
    const { id } = customEvent.detail;

    // Ensure app shell is rendered
    if (!this.isAppShellRendered()) {
      this.renderAppShell();
    }

    if (!this.#chat || !this.#sidebar) {
      console.error(
        "Chat components not initialized after rendering app shell"
      );
      return;
    }

    // Update URL first to prevent race conditions
    const targetPath = `/chat/${id}`;
    if (router.currentRoute !== targetPath) {
      // Update the URL in browser history without triggering navigation
      window.history.pushState({}, "", `#${targetPath}`);
      // Update router's internal state
      (router as any).currentPath = targetPath;
    }

    // Load the chat and update sidebar
    this.#chat.loadChat(id);
    this.#sidebar.setCurrentChat(id);
  }

  public newChat() {
    // Ensure app shell is rendered
    if (!this.isAppShellRendered()) {
      this.renderAppShell();
    }

    if (!this.#chat || !this.#sidebar) {
      console.error(
        "Chat components not initialized after rendering app shell"
      );
      return;
    }

    // Restore previous sidebar state if we're coming from settings
    if (this.#previousSidebarState !== null) {
      const currentState = this.#sidebar.isCollapsed();
      if (currentState !== this.#previousSidebarState) {
        this.#sidebar.toggleCollapse();
      }
      this.#previousSidebarState = null;
    }

    // Load new chat immediately
    this.#chat.startNewChat();
    this.#sidebar.setCurrentChat(null);

    // Focus the chat input for better UX
    this.#chat.focusInput();

    // Update URL
    window.history.pushState({}, "", "#/");
    (router as any).currentPath = "/";
  }

  public deleteChat(event: Event) {
    if (!this.#chat || !this.#sidebar) {
      console.error("Chat components not initialized");
      return;
    }
    const customEvent = event as CustomEvent;
    const { id } = customEvent.detail;
    this.#chat.deleteChat(id);
    this.#sidebar.removeChat(id);
  }

  public chatTitleUpdated(event: Event) {
    if (!this.#sidebar) {
      console.error("ChatSidebar component not initialized");
      return;
    }

    const customEvent = event as CustomEvent;
    const { chatId, title } = customEvent.detail;

    // Use the new optimized method that updates just the specific chat
    this.#sidebar.updateChatTitle(chatId, title);
  }

  public async handleDeleteRequest(event: Event) {
    if (!this.#chat || !this.#sidebar || !this.#confirmDialog) {
      console.error("Components not initialized");
      return;
    }

    const customEvent = event as CustomEvent;
    const { id, title } = customEvent.detail;

    // Show confirmation dialog
    const confirmed = await this.#confirmDialog.show({
      title: "Delete Chat",
      message: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: () => {
        // This will be handled by the promise resolution
      },
      onCancel: () => {
        // This will be handled by the promise resolution
      },
    });

    if (confirmed) {
      // Proceed with deletion
      await this.#chat.deleteChat(id);
      // Remove from sidebar immediately for better UX
      this.#sidebar.removeChat(id);
    }
  }

  public handleChatDeleted() {
    // Refresh the sidebar to sync with server state
    if (!this.#sidebar) {
      console.error("ChatSidebar component not initialized");
      return;
    }
    this.#sidebar.refreshChats();

    // If we're currently viewing a specific chat that was deleted, navigate to home
    const currentRoute = router.currentRoute;
    if (currentRoute.startsWith("/chat/")) {
      router.navigate("/");
    }
  }

  public handleChatError(event: Event) {
    const customEvent = event as CustomEvent;
    const { message } = customEvent.detail;

    // Show notification using the notification service
    notificationService.error(message);
  }

  public handleChatCreated(event: Event) {
    const customEvent = event as CustomEvent;
    const { chatId } = customEvent.detail;

    // Navigate to the new chat URL
    if (chatId) {
      router.navigate(`/chat/${chatId}`);
    }

    // Refresh the sidebar to show the new chat
    if (this.#sidebar) {
      this.#sidebar.refreshChats();
    }
  }
}

if (!customElements.get("chat-app")) {
  customElements.define("chat-app", App);
}
