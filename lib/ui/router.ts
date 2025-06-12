/**
 * Router class for managing client-side routing.
 * Implements a simple hash-based routing system.
 */
export class Router {
  private _routes: Map<string, () => void> = new Map();
  private _currentRoute = "";

  constructor() {
    // Listen for hash changes
    window.addEventListener("hashchange", () => {
      this._handleRouteChange();
    });
  }

  private _handleRouteChange() {
    const route = window.location.hash.slice(1) || "/";
    this.navigate(route);
  }

  public createRoute(route: string, callback: () => void) {
    if (this._routes.has(route)) {
      console.warn(`Route ${route} already exists. Overwriting.`);
    }
    this._routes.set(route, callback);
  }

  public navigate(route: string) {
    if (!this._routes.has(route)) {
      console.error(`Route ${route} does not exist.`);
      return;
    }
    window.location.hash = route;
    this._currentRoute = route;
    const callback = this._routes.get(route);
    if (callback) {
      callback();
    }
  }

  get currentRoute() {
    return this._currentRoute;
  }
}

export const router = new Router();
