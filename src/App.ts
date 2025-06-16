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

  hello() {
    console.log("Hello from App component!");
  }

  async init() {
    router.createRoute("/", () => {
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
        ></chat-main>
        <notification-component></notification-component>
        <confirm-dialog></confirm-dialog>
      `);
      this.#sidebar = this.querySelector("chat-sidebar") as ChatSidebar;
      this.#chat = this.querySelector("chat-main") as ChatMain;
      this.#confirmDialog = this.querySelector(
        "confirm-dialog"
      ) as ConfirmDialog;
      // Process event attributes after components are created
      this._processEventAttributes();
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

  private setupSignIn() {
    const signInDiv = this.querySelector("#clerk-signin");
    if (signInDiv && authService.getClerkInstance()) {
      authService.getClerkInstance().mountSignIn(signInDiv);
    }
  }

  public selectChat(event: Event) {
    if (!this.#chat || !this.#sidebar) {
      console.error("Chat components not initialized");
      return;
    }
    const customEvent = event as CustomEvent;
    const { id } = customEvent.detail;
    this.#chat.loadChat(id);
    this.#sidebar.setCurrentChat(id);
  }

  public newChat() {
    if (!this.#chat || !this.#sidebar) {
      console.error("Chat components not initialized");
      return;
    }
    this.#chat.startNewChat();
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

  public chatTitleUpdated() {
    if (!this.#sidebar) {
      console.error("ChatSidebar component not initialized");
      return;
    }
    this.#sidebar.refreshChats();
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
  }

  public handleChatError(event: Event) {
    const customEvent = event as CustomEvent;
    const { message } = customEvent.detail;

    // Show notification using the notification service
    notificationService.error(message);
  }
}

if (!customElements.get("chat-app")) {
  customElements.define("chat-app", App);
}
