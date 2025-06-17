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

  constructor() {
    super();
    this.initClerk();
  }

  async init() {
    router.createRoute("/", () => {
      this.renderAppShell();
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
        this.#chat.loadChat(chatId);
        this.#sidebar.setCurrentChat(chatId);
      }
    });

    router.createRoute("/sign-in", () => {
      this.innerHTML = "";
      this.append(html`
        <div class="auth-required">
          <div id="clerk-signin"></div>
        </div>
      `);
      this.setupSignIn();
    });

    router.createRoute("/chat-settings", () => {
      this.innerHTML = "";
      this.append(html`<chat-settings></chat-settings>`);
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

      await clerk.load();

      authService.setClerk(clerk);

      // Handle OAuth redirects if present
      if (authService.isOAuthRedirect()) {
        await authService.handleRedirectCallback();

        // Check if there's a redirect URL stored
        const redirectUrl = sessionStorage.getItem("redirect-after-auth");
        if (redirectUrl) {
          sessionStorage.removeItem("redirect-after-auth");
          window.location.hash = redirectUrl;
        } else {
          // After handling the redirect, navigate to home
          window.location.hash = "/";
        }

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

  private setupSignIn() {
    const signInDiv = this.querySelector("#clerk-signin");
    if (signInDiv && authService.getClerkInstance()) {
      authService.getClerkInstance().mountSignIn(signInDiv);
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
      <button class="chat-settings-btn" @click="handleChatSettings">
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
            d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
          />
        </svg>
      </button>
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
    this.#sidebar?.handleChatSettings();
  };

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
