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

  async getAuthStatus(): Promise<AuthStatus> {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/auth/status`);
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
        const token = await this.clerk.session.getToken();
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
