import type { Component } from "./Component";

export function render(component: Component, root: Element) {
  if (!root) {
    throw new Error("Root element not found");
  }

  root.innerHTML = "";

  component.render();
  root.appendChild(component);
}
