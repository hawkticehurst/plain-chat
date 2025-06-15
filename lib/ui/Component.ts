/**
 * Base class for all UI components in the application.
 *
 * This class provides a structure for creating web components that can
 * be initialized with props, handle lifecycle events, and manage event
 * listeners.
 *
 * Components should extend this class and implement the `init` method
 * to set up their initial state and DOM structure.
 */
export class Component<P = any> extends HTMLElement {
  protected props: P | undefined;
  private _cleanupCallbacks: (() => void)[] = [];

  constructor() {
    super();
  }

  connectedCallback() {
    if (this.props === undefined) {
      this.init();
    }
    this._processEventAttributes();
  }

  disconnectedCallback() {
    for (const cleanup of this._cleanupCallbacks) {
      cleanup();
    }
    this._cleanupCallbacks = [];
  }

  /**
   * The component's main initialization lifecycle hook. This is where you
   * should build the initial DOM and set up reactive effects.
   *
   * If this component is created as a "root" element via the global
   * `render()` utility (from `lib/ui/render.ts`), this method will
   * receive the `props` object passed to that function.
   *
   * @param props The initial data for the component, typically provided
   *              by the router or at application startup.
  */
 init(props?: P): void {
   this.props = props;
  }
  
  protected _addCleanup(fn: () => void) {
    this._cleanupCallbacks.push(fn);
  }
  
  // Reference: https://github.com/hawkticehurst/stellar/blob/main/index.ts
  private _processEventAttributes() {
    const iterator = document.createNodeIterator(this, NodeFilter.SHOW_ELEMENT);
    let node: any;
    while ((node = iterator.nextNode())) {
      if (node instanceof HTMLElement) {
        for (const attr of [...node.attributes]) {
          if (attr.name.startsWith("@")) {
            const eventName = attr.name.slice(1);
            const handlerName = attr.value;
            
            if (typeof (this as any)[handlerName] === "function") {
              const handler = (e: Event) => (this as any)[handlerName](e);
              node.addEventListener(eventName, handler);
              this._addCleanup(() =>
                node.removeEventListener(eventName, handler)
            );
            node.removeAttribute(attr.name);
          } else {
            console.warn(
              `Handler method "${handlerName}" not found on component ${this.tagName}.`
            );
          }
        }
      }
    }
  }
}
}
