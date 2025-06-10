import { config } from "./config";

export interface AuthStatus {
  isAuthenticated: boolean;
  userId: string | null;
  message?: string;
}

export class AuthService {
  private clerk: any = null;

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

  setClerk(clerk: any) {
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
