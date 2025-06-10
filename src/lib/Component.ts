export class Component extends HTMLElement {
  constructor() {
    super();
  }

  disconnectedCallback() {
    // Cleanup if necessary
  }

  // @ts-ignore
  render(...args: any[]): void {
    // Override this method in subclasses to render content
  }

  insert(parent: Node, node: Element, ref: Node | null) {
    parent.insertBefore(node, ref);
  }
}
