import type { Component } from "./Component";

/**
 * Renders a root component into a container element, passing initial props.
 * @param ComponentClass The component class to render.
 * @param root The DOM element to render into.
 * @param props Optional initial data for the component.
 */
export function render(
  ComponentClass: { new (): Component },
  root: Element,
  props?: any
) {
  if (!root) {
    throw new Error("Root element not found");
  }
  const component = new ComponentClass();
  root.innerHTML = "";
  component.init(props);
  root.appendChild(component);
}