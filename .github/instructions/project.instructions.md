---
applyTo: "**/*.ts"
---

# Code Base Instructions

This code base is a TypeScript project that uses the vanilla TypeScript Vite template.

The UI of this project is built using vanilla a specific flavor of vanilla Web Components that is defined below. All the UI must be built using this flavor of Web Components.

## Code Base Structure

The code base is structured as follows:

```
public/                  # Contains static assets that are served by the web server
src/
├── components/          # Contains all the web components
├── lib/                 # Contains the base classes and utility functions
|   ├── router.ts        # Router for the application
|   ├── base.ts          # Base class for web components
|   ├── render.ts        # Render function for the entire application
|   ├── html.ts          # Tagged template function for HTML
|   └── index.ts         # Exports for the lib directory
├── App.ts               # Main application component
├── main.ts              # Main entry point for the application
└── styles.css           # Global styles
index.html               # Main HTML file
package.json             # Project metadata and dependencies
tsconfig.json            # TypeScript configuration file
```

## Web Components

Below is an example of the web component format that must be used in this project. The key elements are:

- The component is defined as a class that always extends the `Component` base class found in the `src/lib/base.ts` file
- The `Component` base class includes a helper method `insert` that is used to insert elements into the component's internal structure
- The component's constructor sets up the initial HTML structure
- The component's HTML structure is defined in a template literal
- The template literal is always defined with the `html` tagged template function defined in the `src/lib/html.ts` file
- EXTREMELY IMPORTANT: The components NEVER use Shadow DOM
- IMPORTANT: Web Components are created using a class constructor (i.e. `new BenchButton()`) instead of `document.createElement('bench-button')`
- IMPORTANT: A web component constructor never accepts any parameters
- IMPORTANT: If a component should accept parameters, it should have a `render` method that accepts those parameters and updates the component's internal state
- Internal state is always stored in private properties (e.g. `_id`, `_selected`)

```ts
import { Component, html } from "./lib/index";

const adjectives = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy",
];
const colours = [
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
  "brown",
  "purple",
  "brown",
  "white",
  "black",
  "orange",
];
const nouns = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard",
];

let seed = 0;
// random function is replaced to remove any randomness from the benchmark.
const random = (max) => seed++ % max;
const pick = (dict) => dict[random(dict.length)];
const label = () => `${pick(adjectives)} ${pick(colours)} ${pick(nouns)}`;
const getButtonContainer = (r) =>
  r.firstElementChild.firstElementChild.firstElementChild.lastElementChild
    .firstElementChild;

const APP = html`<div class="container">
  <div class="jumbotron">
    <div class="row">
      <div class="col-md-6">
        <h1>Portable HTML Web Components (keyed) – V2 Fast</h1>
      </div>
      <div class="col-md-6">
        <div class="row"></div>
      </div>
    </div>
  </div>
  <table class="table table-hover table-striped test-data">
    <tbody id="tbody"></tbody>
  </table>
  <span
    class="preloadicon glyphicon glyphicon-remove"
    aria-hidden="true"
  ></span>
</div>`;

class BenchApp extends Component {
  _id = 1;
  _selected = null;

  constructor() {
    super();
    this.innerHTML = APP;
    this._tbody = this.querySelector("tbody");
    this._rows = this._tbody.children;

    const container = getButtonContainer(this);
    const runButton = new BenchButton();
    const runlotsButton = new BenchButton();
    const addButton = new BenchButton();
    const updateButton = new BenchButton();
    const clearButton = new BenchButton();
    const swaprowsButton = new BenchButton();
    runButton.render("run", "Create 1,000 rows", this.run.bind(this));
    runlotsButton.render(
      "runlots",
      "Create 10,000 rows",
      this.runlots.bind(this)
    );
    addButton.render("add", "Append 1,000 rows", this.add.bind(this));
    updateButton.render(
      "update",
      "Update every 10th row",
      this.update.bind(this)
    );
    clearButton.render("clear", "Clear", this.clear.bind(this));
    swaprowsButton.render("swaprows", "Swap Rows", this.swaprows.bind(this));
    container.append(
      runButton,
      runlotsButton,
      addButton,
      updateButton,
      clearButton,
      swaprowsButton
    );

    this._tbody.addEventListener("row-select", (e) => {
      const msg = e.detail;
      if (this._selected) {
        this._selected.deselect();
      }
      this._selected = msg.element;
    });
  }
  run() {
    this.create(1000);
  }
  runlots() {
    this.create(10000);
  }
  add() {
    this.create(1000, true);
  }
  clear() {
    this._tbody.textContent = "";
    this._selected = null;
  }
  update() {
    for (let i = 0, r; (r = this._rows[i]); i += 10) {
      r.appendToLabel(" !!!");
    }
  }
  swaprows() {
    const [, r1, r2] = this._rows;
    const r998 = this._rows[998];
    if (r998) {
      this.insert(this._tbody, r1, r998);
      this.insert(this._tbody, r998, r2);
    }
  }
  create(count, add = false) {
    if (!add) {
      this.clear();
    }
    let id = this._id;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const row = new BenchRow();
      row.render(id++, label());
      fragment.append(row);
    }
    this.insert(this._tbody, fragment, null);
    this._id = id;
  }
}

class BenchButton extends Component {
  constructor() {
    super();
    this.div = document.createElement("div");
    this.div.className = "col-sm-6 smallpad";
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.className = "btn btn-primary btn-block";
    this.div.append(this.button);
  }
  render(action, text, fn) {
    this.button.textContent = text;
    this.button.id = action;
    this.button.addEventListener("click", fn);
    this.insert(this, this.div, null);
  }
}

class BenchRow extends Component {
  constructor() {
    super();
    this.idCell = document.createElement("td");
    this.idCell.className = "col-md-1";

    this.labelCell = document.createElement("td");
    this.labelCell.className = "col-md-4";
    this.labelLink = document.createElement("a");
    this.labelLink.addEventListener("click", (e) => {
      e.stopPropagation();
      this.select();
      this.dispatchEvent(
        new CustomEvent("row-select", {
          bubbles: true,
          detail: { element: this },
        })
      );
    });
    this.labelCell.append(this.labelLink);

    this.closeCell = document.createElement("td");
    this.closeCell.className = "col-md-1";
    const closeLink = document.createElement("a");
    const icon = document.createElement("span");
    icon.className = "glyphicon glyphicon-remove";
    icon.setAttribute("aria-hidden", "true");
    closeLink.append(icon);
    closeLink.addEventListener("click", (e) => {
      e.stopPropagation();
      this.remove();
    });
    this.closeCell.append(closeLink);

    this.emptyCell = document.createElement("td");
    this.emptyCell.className = "col-md-6";
  }
  render(rowId, label) {
    this.idCell.textContent = rowId;
    this.labelLink.textContent = label;
    this.insert(this, this.idCell, null);
    this.insert(this, this.labelCell, null);
    this.insert(this, this.closeCell, null);
    this.insert(this, this.emptyCell, null);
  }
  select() {
    this.className = "danger";
  }
  deselect() {
    this.className = "";
  }
  appendToLabel(text) {
    this.labelLink.textContent += text;
  }
}

customElements.define("bench-button", BenchButton);
customElements.define("bench-row", BenchRow);
customElements.define("bench-app", BenchApp);
```

## Component Structure

The components in this project are structured as follows:

- Each component is defined in its own file in the `src/components` directory.
- There can be exceptions to this rule, when a set of components are closely related and can be grouped together in a single file.
- The component file should export the component class.
- The component's CSS styles should be defined in a separate CSS file in the same directory as the component, and should be imported into the global CSS file using `@import './path/to/component.css';`.

## Router

This is a single-page application (SPA) that uses the `hashchange` event to handle routing. The application does not use any external libraries for routing.

There is a `x-route` custom element that is used to define routes. Here's an example of usage:

```html
<x-route path="/" exact
  ><p>hello</p>
  <x-route>
    <!-- only match #/ (or no hash) and show the text "hello" -->
    <x-route path="/">
      <!-- match every route below / (e.g. for site navigation) -->
      <x-route path="/about" exact>
        <!-- only match #/about exactly -->
        <x-route path="/todos/([\w]+)">
          <!-- match #/todos/:id and pass id to routeChangedCallback -->
          <x-route path="/notebooks/([\w]+)(?:/([\w]+))?">
            <!-- match #/notebooks/:id and /notebooks/:id/:note and pass id and note to routeChangedCallback -->
            <x-route path="*">
              <!-- match if no other route matches within the same parent node --></x-route
            ></x-route
          ></x-route
        ></x-route
      ></x-route
    ></x-route
  ></x-route
>
```

## Styles

The project uses vanilla CSS for styling.

The styles are defined in the `src/styles.css` file and are applied globally. There are no CSS preprocessors or frameworks used.

The `style` attribute should not be used in the HTML structure of the components. Instead, styles should be defined in the CSS file and applied as classes to the elements.

Dynamically applying styles using JavaScript is allowed, but should be used sparingly and only when necessary. The preferred way to apply styles is through CSS classes.

When scoped styles are needed (e.g. for a specific component), a component CSS file can be created in the same directory as the component and prepend any component CSS selectors with the custom element name they are associated with.

For example, if the component is named `bench-button`, this is how the CSS should be structured:

```css
bench-button {
  /* styles for the custom element itself -- usually these will be layout / container type styles */
}

bench-button button {
  /* styles for the button inside bench-button */
}
```

These component styles should be imported into the global CSS file using `@import './path/to/component.css';`.

It is absolutely critical that CSS imported styles never import other CSS files. Nested imports will cause performance issues and are not allowed.

For example, the following is **not allowed**:

```css
/* File: src/components/button.css */
@import "./path/to/another-component.css"; /* This is not allowed */
```

This **is allowed**:

```css
/* File: src/components/button.css */
bench-button {
  /* styles */
}
bench-button button {
  /* styles for the button inside bench-button */
}
```

```css
/* File: src/styles.css */
@import "./components/button.css"; /* This is allowed */
@import "./components/another-component.css"; /* This is allowed */
```

## General Guidelines

- Remember to always check for missing or unused imports when adding, removing, or refactoring code.
