// Adapted from https://github.com/hawkticehurst/stellar/blob/main/examples/counter/index.html

// function isCustomElement(tagName: string) {
//   return tagName.includes('-');
// }

function removeAttribute(elem: HTMLElement, attr: Attr) {
  elem?.removeAttributeNode(attr);
}

export class Component extends HTMLElement {
  private _tracked: { elem: HTMLElement; event: string; fn: EventListener }[];
  private _hasRendered: boolean = false;

  constructor() {
    super();
    this._tracked = [];
    this._processEventAttributes();
  }

  private _processEventAttributes() {
    // Clear existing tracked listeners
    for (const { elem, event, fn } of this._tracked) {
      elem?.removeEventListener(event, fn);
    }
    this._tracked = [];

    let node;
    const changes: (() => void)[] = [];
    // const nestedCustomElements: HTMLElement[] = [];
    const filter = (node: Node) => {
      // Reject any node that is not an HTML element
      if (!(node instanceof HTMLElement)) {
        return NodeFilter.FILTER_REJECT;
      }
      // Check if node is a nested custom element
      // if (isCustomElement(node.tagName) && node.tagName !== this.tagName) {
      //   nestedCustomElements.push(node);
      //   return NodeFilter.FILTER_REJECT;
      // }
      // // Check if node is a child of a nested custom element
      // for (const nested of nestedCustomElements) {
      //   if (nested.contains(node)) {
      //     return NodeFilter.FILTER_REJECT;
      //   }
      // }
      return NodeFilter.FILTER_ACCEPT;
    };
    const iterator = document.createNodeIterator(
      this,
      NodeFilter.SHOW_ELEMENT,
      { acceptNode: filter }
    );
    while ((node = iterator.nextNode())) {
      if (!node || !(node instanceof HTMLElement)) return;
      for (const attr of node.attributes) {
        if (attr.name.startsWith('@')) {
          changes.push(() => this.setEventHandler(attr));
        }
      }
    }
    // Process any changes that were collected after the initial iteration
    for (const change of changes) {
      change();
    }
    // Attach event listeners
    for (const { elem, event, fn } of this._tracked) {
      elem?.addEventListener(event, fn);
    }
  }

  // Override innerHTML to reprocess event attributes when content changes
  set innerHTML(value: string) {
    super.innerHTML = value;
    this._processEventAttributes();
  }

  get innerHTML(): string {
    return super.innerHTML;
  }

  private setEventHandler(attr: Attr) {
    const elem = attr.ownerElement as HTMLElement;
    const { name: event, value: method } = attr;
    this._tracked.push({
      elem: elem,
      event: event.slice(1),
      fn: (e: Event) => {
        (this as any)[method](e);
      },
    });
    removeAttribute(elem, attr);
  }

  // @ts-ignore
  render(...args: any[]): void {
    if (this._hasRendered) {
      console.error(
        `Component ${this.tagName} has already been rendered. Use signals and DOM manipulation for updates instead of calling render() again.`
      );
      return;
    }
    this._hasRendered = true;
    this.init(...args);
  }

  // Override this method in subclasses to implement initial rendering logic
  init(..._args: any[]): void {
    // Default implementation - override in subclasses
  }

  disconnectedCallback() {
    // Reset render state when component is removed from DOM
    this._hasRendered = false;
    
    // Clean up event listeners
    for (const { elem, event, fn } of this._tracked) {
      elem?.removeEventListener(event, fn);
    }
    this._tracked = [];
  }

  insert(parent: Node, node: Element, ref: Node | null = null) {
    parent.insertBefore(node, ref);
  }
}
