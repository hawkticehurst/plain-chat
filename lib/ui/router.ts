// A type for the handler function that each route will execute.
// It receives an object containing any URL parameters.
type RouteHandler = (params: Record<string, string>) => void | Promise<void>;

// The internal representation of a route.
type Route = {
  handler: RouteHandler;
  params: string[]; // Names of the parameters, e.g., ["id"]
  regex: RegExp; // The regex to match the path
};

/**
 * A flexible, hash-based router for single-page applications.
 * Supports parameterized routes and provides clean URL parameter extraction.
 */
export class Router {
  #routes: Route[] = [];
  #currentPath = "";
  #navigating = false; // Guard against infinite loops

  constructor() {
    window.addEventListener("hashchange", this.#handleRouteChange.bind(this));
  }

  /**
   * The main entry point for handling a route change, either from a hashchange
   * event or an initial page load.
   */
  #handleRouteChange() {
    if (this.#navigating) return;

    let path = window.location.hash.slice(1) || "/";

    // Handle OAuth redirects that come without hash but with query parameters
    if (path === "/" && window.location.search) {
      const search = window.location.search;
      if (
        search.includes("code=") ||
        search.includes("state=") ||
        search.includes("__clerk")
      ) {
        // This is likely an OAuth redirect, stay on home route
        path = "/";
        // Clear the URL of OAuth parameters after handling
        setTimeout(() => {
          window.history.replaceState({}, "", window.location.pathname + "#/");
        }, 100);
      }
    }

    this.#executeRoute(path);
  }

  /**
   * Finds the matching route for a given path and executes its handler.
   * @param path The path to execute (e.g., "/users/123")
   */
  #executeRoute(path: string) {
    for (const route of this.#routes) {
      const match = path.match(route.regex);

      if (match) {
        this.#currentPath = path;
        // Extract parameters from the URL (e.g., "123" from the match).
        const params = match.slice(1).reduce(
          (acc, value, index) => {
            acc[route.params[index]] = value;
            return acc;
          },
          {} as Record<string, string>
        );

        // Directly execute the handler for the matched route.
        route.handler(params);
        return; // Stop after finding the first match.
      }
    }

    // Handle 404 case if no route matched.
    const notFoundRoute = this.#routes.find(
      (route) => route.regex.toString() === "/^\\/(.*)/"
    );
    if (notFoundRoute) {
      notFoundRoute.handler({ path });
    } else {
      console.error(`Route not found for path: ${path}`);
    }
  }

  /**
   * Defines a new route and the handler function to execute when it matches.
   * @param path The route path (e.g., "/users/:id").
   * @param handler The function to call with the route parameters.
   */
  public createRoute(path: string, handler: RouteHandler) {
    const params = (path.match(/:(\w+)/g) || []).map((p) => p.slice(1));
    const regex = new RegExp(`^${path.replace(/:(\w+)/g, "([^/]+)")}$`);
    this.#routes.push({ handler, params, regex });
  }

  /**
   * Programmatically navigates to a new route.
   * @param path The path to navigate to (e.g., "/users/456")
   */
  public navigate(path: string) {
    if (this.#navigating) return;
    if (`#${path}` === window.location.hash) return;

    // Find the matching route definition to ensure it's a valid path.
    let routeExists = false;
    for (const route of this.#routes) {
      if (path.match(route.regex)) {
        routeExists = true;
        break;
      }
    }

    if (!routeExists) {
      console.error(
        `Navigation failed: Route does not exist for path "${path}".`
      );
      return;
    }

    this.#navigating = true;
    window.location.hash = path;

    // Force execution if hashchange doesn't fire
    setTimeout(() => {
      if (this.#navigating) {
        this.#navigating = false;
        this.#executeRoute(path);
      }
    }, 50);

    // Reset navigating flag
    setTimeout(() => {
      this.#navigating = false;
    }, 100);
  }

  /**
   * Kicks off the initial routing logic when the app loads.
   * Includes special handling for initial OAuth redirects.
   */
  public init() {
    this.#handleRouteChange();
  }

  /**
   * Get the current path
   */
  get currentRoute() {
    return this.#currentPath;
  }
}

// Create and export a singleton instance for the whole app to use.
export const router = new Router();
