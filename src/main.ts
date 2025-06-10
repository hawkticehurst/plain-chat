import { App } from "./App";
import { render } from "./lib/index";

const root = document.getElementById("root");
render(new App(), root!);