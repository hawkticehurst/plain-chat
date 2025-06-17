import type { UserResource } from "@clerk/types";
import { config } from "../config";
import { Clerk } from "@clerk/clerk-js";

export interface AuthStatus {
  isAuthenticated: boolean;
  userId: string | null;
  message?: string;
}

export class AuthService extends EventTarget {
  private clerk: any = null;

  async init(
    signInDiv: HTMLDivElement,
    isSignedInCallback: (user: UserResource) => void
  ): Promise<void> {
    // Use environment variable for Clerk publishable key
    const publicKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

    if (!publicKey) {
      throw new Error(
        "VITE_CLERK_PUBLISHABLE_KEY environment variable is required"
      );
    }

    // Check if Clerk is already initialized from early initialization
    if (this.clerk) {
      // Clerk is already initialized, just set up the sign-in component
      if (this.clerk.user) {
        isSignedInCallback(this.clerk.user);
        return;
      }

      // Mount the sign-in component
      this.clerk.mountSignIn(signInDiv);

      // Listen for sign-in events
      this.clerk.addListener((session: any) => {
        if (session.user) {
          isSignedInCallback(session.user);
        }
      });
      return;
    }

    // If not already initialized, initialize now
    const clerk = new Clerk(publicKey);

    // Use minimal configuration - environment variables handle redirects
    await clerk.load();

    this.setClerk(clerk);

    if (clerk.user) {
      isSignedInCallback(clerk.user);
      return;
    }

    // Mount the sign-in component
    clerk.mountSignIn(signInDiv);

    // Listen for sign-in events
    clerk.addListener((session: any) => {
      if (session.user) {
        isSignedInCallback(session.user);
      }
    });
  }

  async signOut(): Promise<void> {
    try {
      if (this.clerk) {
        await this.clerk.signOut();
        // Force page reload to clear any cached state
        window.location.reload();
      }
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  getCurrentUser(): UserResource | null {
    return this.clerk?.user || null;
  }

  isSignedIn(): boolean {
    return !!this.clerk?.user;
  }

  async getAuthStatus(): Promise<AuthStatus> {
    try {
      // First check if Clerk is initialized and user is signed in
      if (!this.clerk || !this.clerk.user) {
        return { isAuthenticated: false, userId: null };
      }

      // If user exists in Clerk, consider them authenticated
      // We don't need to call the API to verify this
      return {
        isAuthenticated: true,
        userId: this.clerk.user.id,
      };
    } catch (error) {
      console.error("Error checking auth status:", error);
      return { isAuthenticated: false, userId: null };
    }
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      // Try to get Clerk session token if available
      if (this.clerk && this.clerk.session) {
        // Get token with Convex URL as audience
        const convexUrl = config.apiBaseUrl;

        // Configure token options with production security
        const tokenOptions: any = {
          template: "convex",
          // Add the Convex site URL as audience
          audience: convexUrl,
        };

        // Add authorizedParties for production security
        if (import.meta.env.PROD) {
          tokenOptions.authorizedParties = ["https://chat.hawkticehurst.com"];
        }

        const token = await this.clerk.session.getToken(tokenOptions);

        if (!token) {
          console.warn("Failed to get auth token from Clerk session");
          return {};
        }

        return {
          Authorization: `Bearer ${token}`,
        };
      }

      // If no Clerk session, return empty headers
      return {};
    } catch (error) {
      console.error("Error getting auth headers:", error);
      return {};
    }
  }

  async getToken(): Promise<string | null> {
    try {
      if (this.clerk && this.clerk.session) {
        const convexUrl = config.apiBaseUrl;

        // Configure token options with production security
        const tokenOptions: any = {
          template: "convex",
          audience: convexUrl,
        };

        // Add authorizedParties for production security
        if (import.meta.env.PROD) {
          tokenOptions.authorizedParties = ["https://chat.hawkticehurst.com"];
        }

        const token = await this.clerk.session.getToken(tokenOptions);
        return token;
      }
      return null;
    } catch (error) {
      console.error("Error getting auth token:", error);
      return null;
    }
  }

  setClerk(clerk: Clerk) {
    this.clerk = clerk;
    // Emit auth ready event
    this.dispatchEvent(new CustomEvent("auth-ready"));
  }

  getClerkInstance() {
    return this.clerk;
  }

  async fetchWithAuth(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const authHeaders = await this.getAuthHeaders();

    const requestOptions: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...options.headers,
      },
    };

    return fetch(url, requestOptions);
  }

  /**
   * Fetch with auth and retry logic for better resilience
   */
  async fetchWithAuthRetry(
    url: string,
    options: RequestInit = {},
    maxRetries: number = 2
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithAuth(url, options);

        // If it's a 401, don't retry - it's an auth issue
        if (response.status === 401) {
          return response;
        }

        // If it's a 5xx error and we have retries left, try again
        if (response.status >= 500 && attempt < maxRetries) {
          console.warn(
            `Server error ${response.status} on attempt ${attempt + 1}, retrying...`
          );
          // Wait a bit before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
          continue;
        }

        // Return response (success or non-retryable error)
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a network error that might be transient
        const isNetworkError =
          lastError.message.includes("NetworkError") ||
          lastError.message.includes("fetch") ||
          lastError.name === "TypeError";

        if (attempt < maxRetries && isNetworkError) {
          console.warn(
            `Network error on attempt ${attempt + 1}, retrying:`,
            lastError.message
          );
          // Wait a bit before retrying
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
          continue;
        }

        // If it's not a network error or we're out of retries, break
        break;
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error("All retry attempts failed");
  }

  async handleRedirectCallback(): Promise<boolean> {
    try {
      if (this.clerk) {
        // Don't pass redirect URLs to handleRedirectCallback
        // Let Clerk use the URLs configured during initialization
        await this.clerk.handleRedirectCallback();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error handling redirect callback:", error);
      return false;
    }
  }

  isOAuthRedirect(): boolean {
    const url = window.location.href;
    const search = window.location.search;
    const hash = window.location.hash;

    return (
      url.includes("__clerk_status") ||
      url.includes("__clerk_redirect") ||
      url.includes("clerk_oauth") ||
      search.includes("code=") || // GitHub OAuth code parameter
      search.includes("state=") || // OAuth state parameter (used by both GitHub and Google)
      search.includes("scope=") || // OAuth scope parameter (Google often includes this)
      search.includes("authuser=") || // Google-specific parameter
      search.includes("prompt=") || // Google OAuth prompt parameter
      hash.includes("access_token=") || // Some OAuth flows use hash
      hash.includes("id_token=") || // Google OAuth ID token
      // Catch-all for any OAuth-related query parameters
      /[?&](code|state|scope|authuser|prompt|session_state)=/.test(search)
    );
  }

  isReady(): boolean {
    return (
      this.clerk !== null && this.clerk.loaded === true && !!this.clerk.session
    );
  }

  async waitForReady(timeoutMs: number = 5000): Promise<boolean> {
    if (this.isReady()) {
      return true;
    }

    return new Promise((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      let checkInterval: ReturnType<typeof setInterval>;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (checkInterval) clearInterval(checkInterval);
      };

      // Set timeout
      timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);

      // Check every 100ms
      checkInterval = setInterval(() => {
        if (this.isReady()) {
          cleanup();
          resolve(true);
        }
      }, 100);
    });
  }

  async waitForSessionReady(timeoutMs: number = 5000): Promise<boolean> {
    if (this.clerk && this.clerk.session) {
      return true;
    }

    return new Promise((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      let checkInterval: ReturnType<typeof setInterval>;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (checkInterval) clearInterval(checkInterval);
      };

      // Set timeout
      timeoutId = setTimeout(() => {
        cleanup();
        resolve(false);
      }, timeoutMs);

      // Check every 50ms for session availability
      checkInterval = setInterval(() => {
        if (this.clerk && this.clerk.session) {
          cleanup();
          resolve(true);
        }
      }, 50);
    });
  }
}

export const authService = new AuthService();
