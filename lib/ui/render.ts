import type { Component } from "./Component";

export function render(component: Component, root: Element) {
  if (!root) {
    throw new Error("Root element not found");
  }
  root.innerHTML = "";
  root.appendChild(component);
  component.render();
}
