import { App } from "./App";
import { render } from "@lib";

const root = document.getElementById("root");
render(App, root!);

// Initialize router with default route
if (!window.location.hash) {
  window.location.hash = "/";
}
