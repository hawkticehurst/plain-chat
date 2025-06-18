import { signal, computed } from "@lib";
import { authService } from "@lib";

class AuthStore {
  // PRIVATE STATE: The core state is a signal holding the authentication status.
  #isSignedIn = signal<boolean>(false);
  #authReady = signal<boolean>(false);
  #userId = signal<string | null>(null);

  // --- DERIVED STATE (COMPUTED) ---
  // These are public, read-only computed signals.

  // Check if user is authenticated and auth system is ready
  public isAuthenticated = computed(() => {
    return this.#authReady() && this.#isSignedIn();
  });

  // Check if auth system is ready (whether signed in or not)
  public isAuthReady = computed(() => {
    return this.#authReady();
  });

  // Get the current user ID if signed in
  public currentUserId = computed(() => {
    return this.#isSignedIn() ? this.#userId() : null;
  });

  // --- ACTIONS ---
  // These are public methods that encapsulate the logic for modifying state.

  public initialize() {
    // Set up periodic auth state checks
    this.#checkAuthStatus();

    // Set up periodic polling for auth status
    setInterval(() => {
      this.#checkAuthStatus();
    }, 1000);

    // Wait for auth service to be ready
    this.#waitForAuthReady();
  }

  public updateAuthStatus(isSignedIn: boolean, userId?: string | null) {
    this.#isSignedIn(isSignedIn);
    this.#userId(userId || null);
  }

  public setAuthReady(ready: boolean) {
    this.#authReady(ready);
  }

  public async signOut() {
    try {
      await authService.signOut();
      // Auth service will reload the page, but in case it doesn't:
      this.#isSignedIn(false);
      this.#userId(null);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  // --- PRIVATE METHODS ---

  #checkAuthStatus() {
    const wasSignedIn = this.#isSignedIn();
    const isSignedIn = authService.isSignedIn();
    const currentUser = authService.getCurrentUser();

    this.#isSignedIn(isSignedIn);
    this.#userId(currentUser?.id || null);

    // Emit a custom event when auth status changes for components that need to react
    if (wasSignedIn !== isSignedIn) {
      window.dispatchEvent(
        new CustomEvent("auth-status-changed", {
          detail: { isSignedIn, userId: currentUser?.id || null },
        })
      );
    }
  }

  async #waitForAuthReady() {
    try {
      // Wait for Clerk to be loaded (not necessarily with a session)
      let attempts = 0;
      while (attempts < 50) {
        // 5 second timeout (50 * 100ms)
        const clerk = authService.getClerkInstance();
        if (clerk && clerk.loaded) {
          // Clerk is loaded, we can determine auth status
          this.#checkAuthStatus();
          this.#authReady(true);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      // Mark as ready regardless of auth status
      if (attempts >= 50) {
        console.warn("Auth service took longer than expected to initialize");
        this.#authReady(true);
      }
    } catch (error) {
      console.error("Auth initialization failed:", error);
      // Still mark as ready so UI shows
      this.#authReady(true);
    }
  }

  // Expose read-only access to the core signals if needed
  public getAuthState = () => this.#isSignedIn;
  public getAuthReady = () => this.#authReady;
  public getUserId = () => this.#userId;
}

// Create and export a SINGLETON instance of the store.
// Every component that imports this will get the same instance.
export const authStore = new AuthStore();
