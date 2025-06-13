import type { UserResource } from "@clerk/types";
import { config } from "../config";
import { Clerk } from "@clerk/clerk-js";

export interface AuthStatus {
  isAuthenticated: boolean;
  userId: string | null;
  message?: string;
}

export class AuthService {
  private clerk: any = null;

  async init(
    signInDiv: HTMLDivElement,
    isSignedInCallback: (user: UserResource) => void
  ): Promise<void> {
    const publicKey = "pk_test_Z3Jvd24tcGVyY2gtNDcuY2xlcmsuYWNjb3VudHMuZGV2JA";
    const clerk = new Clerk(publicKey);
    await clerk.load();

    this.setClerk(clerk);

    if (clerk.user) {
      isSignedInCallback(clerk.user);
      return;
    }

    // Mount the sign-in component
    clerk.mountSignIn(signInDiv);

    // Listen for sign-in events
    clerk.addListener(({ user }) => {
      if (user) {
        isSignedInCallback(user);
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
        const token = await this.clerk.session.getToken({
          template: "convex",
          // Add the Convex site URL as audience
          audience: convexUrl,
        });

        if (!token) {
          console.warn("Failed to get auth token from Clerk session");
          return {};
        }

        return {
          Authorization: `Bearer ${token}`,
        };
      }

      // If no Clerk session, return empty headers
      console.log("No Clerk session available for auth headers");
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
        const token = await this.clerk.session.getToken({
          template: "convex",
          audience: convexUrl,
        });
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
}

export const authService = new AuthService();
