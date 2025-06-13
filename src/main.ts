import { App } from "./App";
import { render } from "@lib";

const init = async () => {
  const root = document.getElementById("root");
  if (!root) {
    console.error("Root element not found");
    return;
  }

  // Initialize the app
  const app = new App();
  render(app, root);

  // Initialize router with default route
  if (!window.location.hash) {
    window.location.hash = "/";
  }
};

init().catch(console.error);
