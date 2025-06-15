# Opinionated Vanilla Web App Guidelines

## 1. Introduction & Philosophy

This document outlines an opinionated approach to building web applications. The core philosophy is to strike a deliberate balance between two worlds:

- **The Power and Flexibility of Vanilla:** Embrace the performance, stability, and simplicity of native Web Platform APIs. The abstractions are minimal, ensuring we stay close to the metal and avoid unnecessary framework overhead.
- **The Ergonomics of Modern Frameworks:** Adopt the best ideas from modern UI development, primarily a reactive, state-driven architecture. This leads to code that is more predictable, maintainable, and enjoyable to write.

This guide provides the principles, patterns, and tools necessary to build applications in this style.

## 2. Core Principles

These five principles are the foundation of every decision we make.

1. **Components are Self-Contained Units:** Every component is an encapsulated module responsible for its own state, view, and logic.
2. **Render Once, Update Granularly:** A component's DOM structure is built **only once**. All subsequent changes are fine-grained, surgical updates, never a full re-render.
3. **State Drives the UI:** All dynamic data is held in `signals`. We never manipulate the DOM directly in response to events; instead, we update the state, and the UI reacts automatically.
4. **Declarative Scaffolding, Imperative Wiring:** We use `html` templates to declaratively define the static structure of our components. We then use `effect`s to imperatively wire that structure to our reactive state.
5. **A Clear, Unidirectional Data Flow:** Data flows down from parent to child via properties. Children communicate up to parents via standard DOM events.

## 3. The Core API

This psuedo framework is composed of a small set of powerful, purpose-built utilities.

### `Component` Base Class

The foundation of all UI elements. It extends `HTMLElement` and provides lifecycle hooks and helpers.

- **Purpose:** To provide a common structure for all components, handle event attribute processing, and manage cleanup.
- **Key Methods:**
  - `constructor()`: Minimal setup. Do not access DOM content here.
  - `init(props?)`: The main initialization hook. Build the initial DOM and set up effects here. Receives props if created by the global `render` function.
  - `connectedCallback()`: Called by the browser when the element is added to the DOM. It ensures `init()` is called.
  - `disconnectedCallback()`: Called by the browser on removal. It runs all registered cleanup functions.
  - `_addCleanup(fn)`: A protected method to register a function (like an event listener removal) to be run on `disconnectedCallback`.

### `signal(initialValue)`

The core reactive primitive. It holds a value that, when changed, can trigger updates.

- **Purpose:** To create a piece of reactive state.
- **API:** Returns a single, overloaded function.
  - `mySignal()`: Gets the current value.
  - `mySignal(newValue)`: Sets a new value and notifies all subscribers.
- **Example:**
  
  ```typescript
  const count = signal(0);
  console.log(count()); // Logs: 0

  count(1); // Sets the value and triggers effects
  console.log(count()); // Logs: 1
  ```

### `effect(fn)`

The bridge between state and the view. It creates a reactive computation.

- **Purpose:** To run a piece of code that automatically re-executes whenever a `signal` it reads has changed.
- **How it Works:** Any signal whose getter is called inside the `effect` function becomes a dependency.
- **Example:**
  
  ```typescript
  const name = signal("Hawk");
  const greetingElement = document.querySelector("#greeting");

  // This effect runs once immediately, and again anytime `name` changes.
  effect(() => {
    greetingElement.textContent = `Hello, ${name()}`;
  });

  // Later, this will automatically update the DOM:
  name("T3"); // greetingElement.textContent becomes "Hello, T3"
  ```

### `computed(fn)`

Creates a derived, read-only signal.

- **Purpose:** To create a new reactive value that is a calculation of one or more other signals.
- **API:** Returns a read-only getter function.
- **Example:**

  ```typescript
  const firstName = signal("T3");
  const lastName = signal("Chat");

  const fullName = computed(() => `${firstName()} ${lastName()}`);

  console.log(fullName()); // Logs: "T3 Chat"
  firstName("Gemini"); // The value of fullName() is now "Gemini Chat"
  ```

### `html` Tagged Template

A safe and efficient way to create DOM nodes from a string.

- **Purpose:** To parse an HTML string into a `DocumentFragment` that can be safely appended to the DOM. It automatically encodes interpolated values to prevent XSS attacks.
- **Composition and Nesting:** The `html` utility is fully compositional. You can safely interpolate other `html` templates, `Node` objects (like `HTMLElement` or `DocumentFragment`), or arrays of these items directly inside a template literal. This enables powerful patterns like conditional rendering and list mapping.
- **Example:**
  
  ```typescript
  const userName = "<script>alert('XSS')</script>";
  const template = html`
    <div class="profile">
      <h2>${userName}</h2>
    </div>
  `;
  // The resulting h2's textContent will be the literal string, not an executed script.
  this.append(template);
  ```

- **Example (Composition):**
  
  ```typescript
  const header = html`<h1>Welcome</h1>`;
  const body = html`<p>This is the main content.</p>`;

  this.append(html`
    <div class="container">
      ${header}
      ${body}
    </div>
  `);
  ```

- **Example (List Rendering):**
  
  ```typescript
  const items = ["First", "Second", "Third"];

  this.append(html`
    <ul>
      ${items.map((item) => html`<li>${item}</li>`)}
    </ul>
  `);
  ```

### `htmlRaw` Tagged Template

A utility function that marks a string as trusted, raw HTML, bypassing the default encoding behavior of the `html` template.

- **Purpose:** To inject pre-sanitized or known-safe HTML directly into the DOM.
- **Security Warning:** This is a powerful tool that should be used with extreme caution. Never pass unsanitized user input to htmlRaw, as this will create a security vulnerability (XSS). All content should be from a trusted source or sanitized with a library like DOMPurify before being passed to this function.
- **Example (Rendering Sanitized HTML):**
  
  ```typescript
  import { html, htmlRaw } from '@lib';
  import DOMPurify from 'dompurify';

  // Assume `rawHtmlFromCms` is a string from a trusted-but-unverified source.
  const safeHtml = DOMPurify.sanitize(rawHtmlFromCms);

  // Now it's safe to render.
  const content = html`
    <article>
      ${htmlRaw(safeHtml)}
    </article>
  `;
  ```

- **Example (Markdown):**
  
  ```typescript
  // In a component that renders rich text content...
  import { marked } from 'marked'; // Converts Markdown to HTML
  import DOMPurify from 'dompurify'; // Sanitizes HTML
  import { html, htmlRaw } from '@lib';

  // 1. Get the raw, potentially unsafe Markdown from a user or database.
  const unsafeMarkdown = `## Hello World!\n\nThis is a list:\n\n* Item 1\n* <script>alert('XSS attack!')</script>\n* Item 3`;

  // 2. Convert the Markdown to an HTML string. This string is still unsafe.
  const unsafeHtml = marked.parse(unsafeMarkdown);

  // 3. Sanitize the HTML string. DOMPurify removes the dangerous <script> tag.
  const safeHtml = DOMPurify.sanitize(unsafeHtml);

  // 4. Now that the HTML is safe, use `htmlRaw` to wrap it.
  const trustedHtml = htmlRaw(safeHtml);

  // 5. Interpolate the trusted HTML into your template.
  this.append(html`
    <div class="content-body">
      <h3>Rendered Content:</h3>
      ${trustedHtml}
    </div>
  `);
  ```

### `render(component, root, props?)`

The top-level function to bootstrap the application.

- **Purpose:** To instantiate a root component, pass it initial data, and attach it to the DOM.
- **Example:**
  
  ```typescript
  // main.ts
  import { render } from "@lib";
  import { App } from "./App";

  const root = document.querySelector("#app");
  const initialData = { theme: "dark" };

  render(App, root, initialData);
  ```

### `router`

A single-page application requires a client-side router to manage views and URLs. The `router` utility is a flexible, JS-only, hash-based router. Depending on your application's needs, you can choose between two primary patterns for configuring it.

**Philosophy**

The routing approach is built on these principles:

1. **Simplicity & Platform Alignment:** We use the URL hash (`#`) and the native `hashchange` event, requiring no special server configuration.
2. **Imperative Orchestration:** The router is an action orchestrator. It matches a URL path and executes a specific handler function, giving you direct control over what happens for each route.

**The Routing API**

The entire routing system is controlled by a single, global router instance exported from `lib/ui/router.ts`.

- `router.createRoute(path, handler)`: Defines a route.
  - `path`: A string representing the URL path after the `#`. It can include parameters prefixed with a colon (e.g., `/users/:id`). A wildcard `/(.*)` can be used as a catch-all for 404 pages.
  - `handler`: A function that will be executed when the route matches. This function receives a single `params` object containing any values extracted from the URL.
- `router.navigate(path)`: Programmatically navigates to a new route. This is useful for actions like redirecting after a form submission or login.
- `router.init()`: Initializes the router, matching the initial URL on page load.

#### Pattern 1: Centralized Routing (in `main.ts`)

This is the default, recommended pattern for most applications. It decouples the routing logic from any specific component.

- **How it Works:** In `main.ts`, you first render a static `App` shell that contains a stable container element (e.g., `<main id="page-content"></main>`). Then, you define all your routes, with each handler targeting that stable container.
- **Best For:** Applications where the routing logic is largely independent of the main app shell's state, or for simpler applications where a clear separation of concerns is desired.

```typescript
// src/main.ts
import { router } from "./lib/Router";
import { render } from "./lib/render";
import { App } from "./App";
import { HomePage } from "./pages/HomePage";

// 1. Render the static app shell
const appRoot = document.querySelector("#app")!;
render(new App(), appRoot);

// 2. Get a reference to the page container inside the shell
const pageContainer = document.querySelector("#page-content");

// 3. Define routes with handlers that target the container
router.createRoute("/", (params) => {
  render(new HomePage(), pageContainer, params);
});

// 4. Initialize the router
router.init();
```

#### Pattern 2: Component-Scoped Routing (in `App.ts`)

This is a powerful alternative pattern for applications where the routing logic is tightly coupled to the state or methods of the main application shell.

- **How it Works:** You define the routes inside the `init()` method of your root `App` component. The route handlers can then directly access the component's instance via `this`, allowing them to call its methods or interact with its state.
- **Best For:** Complex applications like a chat client or a dashboard, where changing a route might require calling methods on the `App` shell to set up specific event listeners, manage WebSocket connections, or update shared state.

**Step 1: Prepare the App Shell**

The `App` component's `init` method will be responsible for both setting up its own static DOM and defining the routes.

**Crucial Best Practice:** The route handlers should not append directly to `this`. Instead, the `App` component should create a stable container for page content. Each route handler **must** clear this container before rendering its own content to prevent pages from stacking on top of each other.

```typescript
// src/App.ts
import { Component, html, router } from "@lib";
import { ChatSidebar, ChatMain } from "./components/Chat";
import { SignInComponent } from "./components/SignIn";

export class App extends Component {
  // A reference to the container where pages will be rendered
  #pageContainer: HTMLElement;

  init() {
    // 1. Create the static shell and the content container.
    this.append(html`
      <header>My Application</header>
      <main id="page-content"></main>
    `);
    this.#pageContainer = this.querySelector("#page-content")!;

    // 2. Define all routes within the init method.
    this.setupRoutes();

    // 3. Initialize the router AFTER all routes have been defined.
    // This ensures the router can match the initial URL on page load.
    router.init();
  }

  setupRoutes() {
    router.createRoute("/", () => {
      // CRITICAL: Clear the container before rendering new content.
      this.#pageContainer.innerHTML = "";
      this.#pageContainer.append(html`
        <chat-sidebar></chat-sidebar>
        <chat-main></chat-main>
      `);
      // The handler can now call methods on this App instance.
      this.setupChatEventListeners();
    });

    router.createRoute("/sign-in", () => {
      this.#pageContainer.innerHTML = "";
      this.#pageContainer.append(html`
        <div class="auth-required">
          <sign-in-component></sign-in-component>
        </div>
      `);
      this.setupSignIn();
    });

    // ... other routes ...
  }

  setupChatEventListeners() {
    console.log("Setting up chat-specific listeners on the App shell...");
    // ... logic to connect to WebSockets, etc. ...
  }

  setupSignIn() {
    console.log("Configuring the sign-in flow...");
  }
}

customElements.define("app-shell", App);
```

**Step 2: The `main.ts` Entry Point**

With this pattern, your `main.ts` becomes extremely simple. Its only job is to render the `App` component.

```typescript
// src/main.ts
import { render } from "@lib";
import { App } from "./App";

const root = document.querySelector("#app")!;
render(App, root);
```

#### Trade-Offs and When to Choose

- **Choose Centralized Routing (`main.ts`)** for simplicity, clear separation of concerns, and when your routing is stateless.
- **Choose Component-Scoped Routing (`App.ts`)** when your routes need to be tightly integrated with the state and methods of your main application component, providing powerful co-location and encapsulation at the cost of slightly more complex handler logic (i.e., manual cleanup).

## 4. Authoring Patterns & Best Practices

This section details _how_ to use the core APIs together to build robust components.

### Component Structure

Every component should follow this basic structure.

```typescript
// src/components/MyComponent.ts

// 1. Import dependencies
import { Component, html, signal, effect } from "@lib";

// 2. Import the component's dedicated stylesheet
import "./MyComponent.css";

// 3. Define the component class
export class MyComponent extends Component {
  // 4. Define state as private signals
  #myState = signal("initial");
  #p: HTMLElement | null = null;

  // 5. Use init() for all setup logic
  init() {
    // 6. Build the initial DOM structure ONCE
    this.append(html`
      <h1>My Component</h1>
      <p>${this.#myState()}</p>
      <button @click="updateState">Update</button>
    `);

    // 7. Query for elements you need to update
    this.#p = this.querySelector("p")!;

    // 8. Set up effects to wire state to the view
    effect(() => {
      this.#p.textContent = this.#myState();
    });
  }

  // 9. Define methods that update state
  updateState() {
    this.#myState("A new value!");
  }
}

// 10. Define the custom element for the browser
customElements.define("my-component", MyComponent);
```

### Using Effects Correctly

The `effect` is the workhorse of this reactive system. Using it correctly is key to writing performant and maintainable components.

**Guideline 1: Prefer Granular, Focused Effects**

An effect should have a single responsibility. Instead of one large effect that updates the entire component, use multiple small effects, each dedicated to a specific piece of the UI.

- **Why?**

  - **Performance:** An effect re-runs if _any_ of its dependencies change. Small, focused effects ensure that a state change only re-runs the specific code that depends on it, avoiding wasted computation.
  - **Readability:** Small, single-purpose functions are easier to read, understand, and debug.

- **Example:**

  **Anti-Pattern: Monolithic Effect**

  ```typescript
  // BAD: This effect re-runs completely if either name or status changes.
  effect(() => {
    this.nameElement.textContent = this.#user().name;
    this.statusElement.classList.toggle("online", this.#user().isOnline);
  });
  ```

  **Best Practice: Granular Effects**

  ```typescript
  // GOOD: Effects are separated by their concern and dependencies.
  effect(() => {
    this.nameElement.textContent = this.#user().name;
  });

  effect(() => {
    this.statusElement.classList.toggle("online", this.#user().isOnline);
  });
  ```

**Guideline 2: Write Declarative Effects; Don't Manually Guard DOM Updates**

You should not add `if` statements inside your effects to check if a DOM property is different before setting it.

- **Why?**

  - **Signal Guards:** Our `signal` primitive already prevents effects from running if the new value is the same as the old one.
  - **Browser Optimizations:** Redundant DOM writes (e.g., setting `textContent` to the same string) are extremely fast in modern browsers and do not cause performance issues. Adding JavaScript checks is often slower.

- **Example:**

  **Anti-Pattern: Manual Guarding**

  ```typescript
  // BAD: This adds unnecessary complexity and is less performant.
  effect(() => {
    const newName = this.#user().name;
    if (this.nameElement.textContent !== newName) {
      this.nameElement.textContent = newName;
    }
  });
  ```

  **Best Practice: Declarative and Idempotent**

  ```typescript
  // GOOD: Simply declare the desired end state.
  effect(() => {
    this.nameElement.textContent = this.#user().name;
  });
  ```

### Data Flow Patterns

**Pattern 1: Top-Level Props via `render()`**
Use this pattern to inject initial data into your main application or route-level components.

```typescript
// In App.ts, the receiving component
export class App extends Component<{ initialCount: number }> {
  #count = signal(0);

  init(props) {
    // Use the props to set initial state
    this.#count(props?.initialCount ?? 0);

    // ... setup logic ...
  }
}

// In main.ts, the sending context
render(App, document.body, { initialCount: 5 });
```

**Pattern 2: Parent-to-Child via Properties**
This is the standard way to pass data down the component tree.

```typescript
// In parent-component.ts
import { UserProfile } from "./UserProfile";

class ParentComponent extends Component {
  #user = signal({ name: "Hawk", id: 123 });

  async init() {
    this.append(html`<user-profile></user-profile>`);
    const profileElement = this.querySelector("user-profile") as UserProfile;

    // Wait for the child to be defined and upgraded
    await customElements.whenDefined("user-profile");

    // For reactive data, set the property inside an effect
    effect(() => {
      profileElement.user = this.#user();
    });
  }
}

// In user-profile.ts
export class UserProfile extends Component {
  // Define a public property to receive data
  public user: { name: string; id: number } | null = null;

  init() {
    // ... use this.user to render the profile ...
  }
}
```

### Styling Strategy

Use a "Scoped by Convention" approach that is simple, performant, and avoids Shadow DOM. We take advantage of some of the features and DX that Vite provides natively.

1. **Direct CSS Import:** Each component **must** import its own stylesheet directly into its TypeScript file. This creates a clear dependency and enables fast HMR via Vite.

```typescript
// In MyComponent.ts
import "./MyComponent.css";
```

2. **Global Stylesheet:** The `src/main.css` file should only contain truly global styles, such as CSS custom properties (`:root`), font-face definitions, and base element styling (e.g., `body`, `h1`). It should not contain `@import` rules for components.

3. **Scoped Selectors:** To prevent style collisions, all selectors in a component's CSS file **must** be scoped. Use CSS Nesting for the best ergonomics -- specifically install the `postcss-nesting` plugin and configure it in the `vite.config.js` file.

```js
import { defineConfig } from "vite";
import postcssNesting from "postcss-nesting";

export default defineConfig({
  css: {
    postcss: {
      plugins: [postcssNesting()],
    },
  },
});
```

4. **Zero-Specificity Prefix:** Use the `:where()` pseudo-class on the host element selector. This makes your component's default styles easy to override with utility classes or themes.

**Example `MyComponent.css`:**

```css
/* Use PostCSS Nesting for clean, scoped styles */
:where(my-component) {
  display: block;
  border: 1px solid #eee;
  padding: 16px;

  /* Nested styles are automatically scoped */
  .title {
    font-size: 1.5rem;
    color: var(--primary-color, blue);
  }

  button {
    background-color: var(--primary-color, blue);
    color: white;
  }

  /* Use '&' for pseudo-classes on the host */
  &.is-active {
    border-color: blue;
  }
}
```

### Query Elements Once

In your component's init method, query for all the dynamic elements you'll need to manipulate and store references to them as private class properties. Avoid re-querying the DOM (e.g., `this.querySelector(...)`) inside effects or event handlers.

**Why:** DOM querying can be expensive, especially in complex components. Querying once and caching the reference can be a significant performance optimization.

**Example:**

```ts
class MyComponent extends Component {
  #nameDisplay: HTMLElement | null = null;
  #actionButton: HTMLButtonElement | null = null;

  init() {
    this.append(html`
      <p>Name: <span id="name"></span></p>
      <button id="action">Do Action</button>
    `);

    // GOOD: Query once and store references.
    this.#nameDisplay = this.querySelector("#name");
    this.#actionButton = this.querySelector("#action");

    // Now use this.#nameDisplay and this.#actionButton in effects/handlers.
  }
}
```

## 5. Advanced Patterns & Edge Cases

This section covers solutions for more complex, real-world scenarios.

### Asynchronous Data Fetching

- **Problem:** You need to fetch data from an API and display loading, error, and success states.
- **Pattern:** Use multiple signals to track the state of the request (`data`, `isLoading`, `error`). Use effects to conditionally render the correct UI for each state.

```typescript
class UserProfile extends Component {
  #user = signal(null);
  #isLoading = signal(true);
  #error = signal<string | null>(null);

  async init(props) {
    this.append(html`
      <div class="loading">Loading...</div>
      <div class="error-message"></div>
      <div class="content"></div>
    `);

    // ... query for elements ...

    effect(() => {
      /* show/hide loading element based on #isLoading() */
    });
    effect(() => {
      /* show/hide and populate error element based on #error() */
    });
    effect(() => {
      /* show/hide and populate content element based on #user() */
    });

    try {
      const res = await fetch(`/api/users/${props.userId}`);
      this.#user(await res.json());
    } catch (e) {
      this.#error(e.message);
    } finally {
      this.#isLoading(false);
    }
  }
}
```

### Efficient List Rendering

- **Problem:** Rendering a list of items. For large, frequently changing lists, clearing and re-appending all items is inefficient.
- **Pattern:** Use the `reconcile` utility. It performs a "keyed" diff, only adding, removing, or updating the nodes that have actually changed.
- **Rule of Thumb:** Consider moving from simple re-rendering to keyed reconciliation when a list frequently changes and typically contains more than 50-100 items.
  - **Why this number?** Below this threshold, modern JavaScript engines and browsers are so fast that the cost of destroying and recreating a few dozen DOM nodes is often negligible (< 16ms) and not worth the added code complexity. Above it, you risk dropping frames and creating a janky user experience.

```ts
import { Component, html, reconcile, signal, effect } from "@lib";

// Import the styles for this component
import "./UserList.css";

// A simple type for our user data
type User = {
  id: number;
  name: string;
};

let nextId = 4;

export class UserList extends Component {
  // 1. STATE: The source of truth for our list is a signal.
  #users = signal<User[]>([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
    { id: 3, name: "Charlie" },
  ]);

  // This map will store the live DOM nodes, keyed by user ID.
  // `reconcile` will manage this map for us.
  #userNodes = new Map<string, Element>();

  init() {
    // 2. SCAFFOLD: Create the static shell for our component.
    this.append(html`
      <h2>User List</h2>
      <div class="controls">
        <button @click="addUser">Add User</button>
        <button @click="shuffleUsers">Shuffle Users</button>
      </div>
      <div class="user-list-container"></div>
    `);

    const container = this.querySelector(".user-list-container")!;

    // 3. WIRING: This is the core reactive logic.
    effect(() => {
      console.log("Reconciling user list...");

      // The `reconcile` function is called inside an effect.
      // It will run whenever the `#users` signal changes.
      this.#userNodes = reconcile(
        // The parent DOM element to render into.
        container,
        // The previous map of nodes.
        this.#userNodes,
        // The new array of data.
        this.#users(),
        // A function to get a unique key from a data item.
        (user) => String(user.id),
        // A function to create a new DOM node when an item is new.
        (user) => {
          console.log(`Creating node for ${user.name}`);
          const el = document.createElement("div");
          el.className = "user-item";
          // We add a data attribute to easily find the element later.
          el.dataset.userId = String(user.id);
          el.textContent = `ID: ${user.id}, Name: ${user.name}`;

          const removeBtn = document.createElement("button");
          removeBtn.textContent = "Remove";
          // The button's click handler modifies the state, not the DOM.
          removeBtn.addEventListener("click", () => this.removeUser(user.id));

          el.append(removeBtn);
          return el;
        },
        // A function to update an existing DOM node when its data changes.
        (node, user) => {
          console.log(`Updating node for ${user.name}`);
          // In this simple example, we just update the text content.
          node.firstChild!.textContent = `ID: ${user.id}, Name: ${user.name}`;
        }
      );
    });
  }

  // 4. ACTIONS: Methods that modify the state.
  addUser() {
    const newUser = { id: nextId++, name: `User ${nextId - 1}` };
    // We update the signal by creating a new array.
    this.#users([...this.#users(), newUser]);
  }

  removeUser(idToRemove: number) {
    // We update the signal by filtering the array.
    this.#users(this.#users().filter((user) => user.id !== idToRemove));
  }

  shuffleUsers() {
    // We update the signal by shuffling the array.
    this.#users([...this.#users()].sort(() => Math.random() - 0.5));
  }
}

customElements.define("user-list", UserList);
```

### Lazy Loading Components

- **Problem:** Improving initial load time by only fetching component code when it's needed.
- **Pattern:** Use dynamic `import('./MyComponent.js')` within your router or an event handler. Once the module is loaded, define the custom element and instantiate it.

```typescript
// In your router...
router.createRoute('/dashboard', async () => {
  // The component code is only fetched when the user navigates here.
  const { DashboardPage } = await import('./pages/DashboardPage.js');
  customElements.define('dashboard-page', DashboardPage);
  
  // Render dashboard within app...
});

// For a dialog...
async openDashboardDialog() {
  // The component code is only fetched when this method is called.
  const { DashboardDialog } = await import('./dialogs/DashboardDialog.js');
  if (!customElements.get('dashboard-dialog')) {
    customElements.define('dashboard-dialog', DashboardDialog);
  }
  const dialog = new DashboardDialog();
  document.body.append(dialog);
}
```

### Global State / Context

- **Problem:** You need to share state between components that are far apart in the DOM tree without "prop drilling" (passing props through many layers). Common examples: user authentication status, theme (dark/light mode).
- **Pattern:** Create signals in a separate file (a "store") and import them directly into any component that needs them. For small bits of data that need to be shared across an application exporting individual signals is appropriate. As an application grows in complexity, however, it's better to group related state and actions into a class.

**Simple Example:**

```ts
// theme.store.ts
import { signal } from './signal';
export const theme = signal<'light' | 'dark'>('light');
export const toggleTheme = () => {
  theme(theme() === 'light' ? 'dark' : 'light');
};

// component-a.ts
import { theme, toggleTheme } from './theme.store';
class ComponentA extends Component {
  init() {
    this.append(html`<button @click="toggle">Toggle Theme</button>`);
    effect(() => {
      console.log(`Component A sees theme: ${theme()}`);
    });
  }
  toggle() { toggleTheme(); }
}

// component-b.ts (somewhere else in the app)
import { theme } from './theme.store';
class ComponentB extends Component {
  init() {
    effect(() => {
      document.body.className = theme();
    });
  }
}
```

**Example: A Complex Shopping Cart Store**

This store will manage a list of items, calculate totals, and handle interactions.

```ts
// src/stores/CartStore.ts
import { signal, computed } from '../lib/signal';

// Define the shape of a product and a cart item
type Product = { id: number; name: string; price: number };
type CartItem = { productId: number; quantity: number; price: number };

class CartStore {
  // PRIVATE STATE: The core state is a signal holding the cart items.
  #items = signal<CartItem[]>([]);

  // --- DERIVED STATE (COMPUTED) ---
  // These are public, read-only computed signals.

  // Total number of items in the cart.
  public itemCount = computed(() => {
    return this.#items().reduce((sum, item) => sum + item.quantity, 0);
  });

  // The total price of all items in the cart.
  public totalPrice = computed(() => {
    const total = this.#items().reduce((sum, item) => sum + item.price * item.quantity, 0);
    return total.toFixed(2); // Format as a currency string
  });

  // A map for quick lookups of item quantities.
  public itemQuantityMap = computed(() => {
    return new Map(this.#items().map(item => [item.productId, item.quantity]));
  });

  // --- ACTIONS ---
  // These are public methods that encapsulate the logic for modifying state.

  public addItem(product: Product) {
    const items = this.#items();
    const existingItem = items.find(i => i.productId === product.id);

    if (existingItem) {
      // If item exists, create a new array with the updated quantity
      const newItems = items.map(i =>
        i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      );
      this.#items(newItems);
    } else {
      // If item is new, create a new array and add it
      const newItem: CartItem = { productId: product.id, quantity: 1, price: product.price };
      this.#items([...items, newItem]);
    }
  }

  public removeItem(productId: number) {
    const newItems = this.#items().filter(i => i.productId !== productId);
    this.#items(newItems);
  }

  public clearCart() {
    this.#items([]);
  }

  // Expose the raw items list as a read-only signal if needed
  public getItems() {
    return this.#items;
  }
}

// Create and export a SINGLETON instance of the store.
// Every component that imports this will get the same instance.
export const cartStore = new CartStore();
```

**How to Use the Store in Components:**

Any component can import the `cartStore` instance to access its state and actions.

```ts
// src/components/ProductCard.ts
import { cartStore } from '../stores/CartStore';

class ProductCard extends Component {
  // ...
  addToCart() {
    // Call an action on the store
    cartStore.addItem(this.productData);
  }
}
```

```ts
// src/components/ShoppingCartDisplay.ts
import { cartStore } from '../stores/CartStore';

class ShoppingCartDisplay extends Component {
  init() {
    this.append(html`
      <p>Items in cart: <span class="count"></span></p>
      <p>Total: $<span class="total"></span></p>
      <ul class="item-list"></ul>
    `);
    const countEl = this.querySelector('.count');
    const totalEl = this.querySelector('.total');

    // React to derived state from the store
    effect(() => {
      countEl.textContent = cartStore.itemCount();
    });
    effect(() => {
      totalEl.textContent = cartStore.totalPrice();
    });
    // ... use reconcile to render the list from cartStore.getItems() ...
  }
}
```

### Focus Management

- **Problem:** After an action (e.g., adding a todo item), you need to programmatically set focus on the new input element. An `effect` is for reacting to state, not for one-off imperative commands.
- **Pattern:** Perform the focus command imperatively, but wait for the DOM to update first. `queueMicrotask` is perfect for this, as it runs after the current synchronous code (including the `effect` that creates the element) but before the next paint.

```ts
// In a TodoList component
addTodo() {
  const newTodo = { id: Date.now(), text: '' };
  this.#todos([...this.#todos(), newTodo]);

  // The effect will create the new todo item in the DOM synchronously.
  // We queue a microtask to run immediately after.
  queueMicrotask(() => {
    const newItemInput = this.querySelector(`[data-todo-id="${newTodo.id}"] input`);
    newItemInput?.focus();
  });
}
```

### Integrating a Third-Party Library (e.g., a Charting Library)

- **Problem:** You need to use a library like Chart.js or Leaflet that wants to take control of a specific DOM element.
- **Pattern:** The component acts as a lifecycle bridge. It creates a container element, passes it to the library, and uses `effect` to call the library's update API. Crucially, it uses `disconnectedCallback` to clean up.

```ts
import Chart from 'chart.js/auto';

class MyChart extends Component {
  #chartInstance: Chart | null = null;
  chartData = signal({ /* ... chart data ... */ });

  init() {
    // Create a canvas for the library to own.
    this.append(html`<canvas></canvas>`);
    const ctx = this.querySelector('canvas')!.getContext('2d')!;

    // Initialize the library.
    this.#chartInstance = new Chart(ctx, {
      type: 'bar',
      data: this.chartData(),
      // ... options
    });

    // Use an effect to bridge our reactive state to the library's API.
    effect(() => {
      if (!this.#chartInstance) return;
      this.#chartInstance.data = this.chartData();
      this.#chartInstance.update();
    });
  }

  disconnectedCallback() {
    // IMPORTANT: Clean up to prevent memory leaks.
    this.#chartInstance?.destroy();
    super.disconnectedCallback();
  }
}
```

### Headless Components / Logic Controllers

- **Problem:** You have a complex piece of logic that you want to reuse across multiple components, but the logic itself has no UI. Examples: a web socket connection manager, an intersection observer controller.
- **Pattern:** A "headless component" is just a regular TypeScript class that uses signals internally and exposes methods and state. It is not a Web Component. A real component can then instantiate this class to use its logic.

```ts
// A headless controller for tracking online status
class OnlineStatusController {
  isOnline = signal(navigator.onLine);
  constructor() {
    window.addEventListener('online', () => this.isOnline(true));
    window.addEventListener('offline', () => this.isOnline(false));
  }
}

// A component uses the controller
class MyAppComponent extends Component {
  #onlineStatus = new OnlineStatusController();

  init() {
    effect(() => {
      console.log('Am I online?', this.#onlineStatus.isOnline());
      this.classList.toggle('is-offline', !this.#onlineStatus.isOnline());
    });
  }
}
```