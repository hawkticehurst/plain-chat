import { Component, html, htmlRaw } from "../lib/index";
import { marked } from "marked";

export class ChatMessage extends Component {
  async render(role: "prompt" | "response", content: string) {
    const markup = await marked(content);
    const template = html`
      <div class="message ${role}">
        <div class="content">
          <div class="text">${htmlRaw(markup)}</div>
        </div>
      </div>
    `;

    this.innerHTML = String(template);
  }
}

customElements.define("chat-message", ChatMessage);
