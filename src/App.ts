import { Component, html, authService } from "./lib/index";
import type { AuthStatus } from "./lib/index";
import "./components/ChatSidebar";
import "./components/ChatMain";

export class App extends Component {
  private _authStatus: AuthStatus = { isAuthenticated: false, userId: null };
  private _loading = true;

  constructor() {
    super();
    this.checkAuthStatus();
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

    // Check if this is demo mode (auth disabled)
    const isDemoMode = (this._authStatus as any).message?.includes(
      "Authentication is disabled"
    );

    if (isDemoMode) {
      // Show demo mode - skip authentication and show the chat interface
      const template = html`
        <div class="demo-banner">
          <p>🧪 Demo Mode - Authentication disabled</p>
        </div>
        <div class="chat-app-container">
          <chat-sidebar></chat-sidebar>
          <chat-main></chat-main>
        </div>
      `;
      this.innerHTML = String(template);
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

    const template = html`
      <div class="chat-app-container">
        <chat-sidebar></chat-sidebar>
        <chat-main></chat-main>
      </div>
    `;

    this.innerHTML = String(template);
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

customElements.define("chat-app", App);
