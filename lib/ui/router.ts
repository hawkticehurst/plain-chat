/**
 * Router class for managing client-side routing.
 * Implements a simple hash-based routing system.
 */
export class Router {
  private _routes: Map<string, () => void> = new Map();
  private _currentRoute = "";
  private _navigating = false; // Guard against infinite loops

  constructor() {
    // Listen for hash changes
    window.addEventListener("hashchange", () => {
      this._handleRouteChange();
    });
  }

  private _handleRouteChange() {
    if (this._navigating) return; // Prevent infinite loops

    let route = window.location.hash.slice(1) || "/";

    // Handle OAuth redirects that come without hash but with query parameters
    if (route === "/" && window.location.search) {
      // Check if this looks like an OAuth redirect
      const search = window.location.search;
      if (
        search.includes("code=") ||
        search.includes("state=") ||
        search.includes("__clerk")
      ) {
        // This is likely an OAuth redirect, stay on home route
        route = "/";
        // Clear the URL of OAuth parameters after handling
        setTimeout(() => {
          window.history.replaceState({}, "", window.location.pathname + "#/");
        }, 100);
      }
    }

    this._executeRoute(route);
  }

  private _executeRoute(route: string) {
    // Clean the route - remove query parameters for routing purposes
    const cleanRoute = route.split("?")[0];

    // Remove any leading hash if present
    const normalizedRoute = cleanRoute.startsWith("#/")
      ? cleanRoute.slice(1)
      : cleanRoute;
    const finalRoute = normalizedRoute.startsWith("/")
      ? normalizedRoute
      : "/" + normalizedRoute;

    // Update current route
    this._currentRoute = finalRoute;

    // Execute callback if route exists
    const callback = this._routes.get(finalRoute);
    if (callback) {
      callback();
    } else {
      console.error(`Route ${finalRoute} does not exist.`);
    }
  }

  public createRoute(route: string, callback: () => void) {
    if (this._routes.has(route)) {
      console.warn(`Route ${route} already exists. Overwriting.`);
    }
    this._routes.set(route, callback);
  }

  public navigate(route: string) {
    if (this._navigating) return; // Prevent infinite loops

    // Handle absolute URLs
    try {
      const url = new URL(route);
      if (url.origin === window.location.origin) {
        // If it's our domain, extract the path and hash
        route = url.hash ? url.hash.slice(1) : url.pathname;
      }
    } catch (e) {
      // Not a valid URL, use as is
    }

    // Clean and normalize the route
    const cleanRoute = route.split("?")[0];
    const normalizedRoute = cleanRoute.startsWith("#/")
      ? cleanRoute.slice(1)
      : cleanRoute;
    const finalRoute = normalizedRoute.startsWith("/")
      ? normalizedRoute
      : "/" + normalizedRoute;

    // Check if we're already on this route
    if (this._currentRoute === finalRoute) {
      return;
    }

    // Check if route exists
    if (!this._routes.has(finalRoute)) {
      // For OAuth redirects or unknown routes, default to home
      if (
        cleanRoute !== route || // Has query parameters
        finalRoute !== "/"
      ) {
        console.log(`Route ${finalRoute} not found, redirecting to home`);
        this.navigate("/");
        return;
      }

      console.error(`Route ${finalRoute} does not exist.`);
      return;
    }

    // Set navigation guard
    this._navigating = true;

    // Update the hash (this will trigger hashchange event)
    window.location.hash = finalRoute;

    // Execute the route immediately (don't wait for hashchange)
    this._executeRoute(finalRoute);

    // Release the guard after a short delay
    setTimeout(() => {
      this._navigating = false;
    }, 10);
  }

  public init() {
    // Handle initial route on page load
    this._handleInitialRoute();
  }

  private _handleInitialRoute() {
    // Check if we're loading with OAuth parameters in the URL
    if (window.location.search && !window.location.hash) {
      const search = window.location.search;
      if (
        search.includes("code=") ||
        search.includes("state=") ||
        search.includes("__clerk")
      ) {
        // OAuth redirect detected, navigate to home and clean URL
        console.log("OAuth redirect detected on initial load");
        window.location.hash = "/";
        setTimeout(() => {
          window.history.replaceState({}, "", window.location.pathname + "#/");
        }, 100);
        return;
      }
    }

    // Normal route handling
    this._handleRouteChange();
  }

  get currentRoute() {
    return this._currentRoute;
  }
}

export const router = new Router();
