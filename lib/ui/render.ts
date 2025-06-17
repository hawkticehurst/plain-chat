import type { Component } from "./Component";

/**
 * Renders a root component into a container element, passing initial props.
 * @param component The component instance or class to render.
 * @param root The DOM element to render into.
 * @param props Optional initial data for the component.
 */
export function render(
  component: Component | { new (): Component },
  root: Element,
  props?: any
) {
  if (!root) {
    throw new Error("Root element not found");
  }

  const instance =
    typeof component === "function" ? new component() : component;
  root.innerHTML = "";
  instance.init(props);
  root.appendChild(instance);
}
