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
      // Use fetchWithAuth to include the Bearer token
      const response = await this.fetchWithAuth(
        `${config.apiBaseUrl}/auth/status`
      );
      if (response.ok) {
        return await response.json();
      }
      return { isAuthenticated: false, userId: null };
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
        console.log("🔧 Auth token debug:", {
          hasClerk: !!this.clerk,
          hasSession: !!this.clerk.session,
          hasToken: !!token,
          tokenPreview: token ? token.substring(0, 20) + "..." : null,
          audience: convexUrl,
        });
        return {
          Authorization: `Bearer ${token}`,
        };
      }

      console.log("🔧 No Clerk session available:", {
        hasClerk: !!this.clerk,
        hasSession: this.clerk ? !!this.clerk.session : false,
      });

      // If no Clerk session, return empty headers
      return {};
    } catch (error) {
      console.error("Error getting auth headers:", error);
      return {};
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
}

export const authService = new AuthService();
