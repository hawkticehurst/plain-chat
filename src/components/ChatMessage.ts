import { Component, html, htmlRaw } from "../lib/index";
import { marked } from "marked";

export class ChatMessage extends Component {
  async render(role: "prompt" | "response", content: string, isLoading = false) {
    let processedContent = content;
    let extraClasses = "";
    
    if (isLoading) {
      extraClasses = " loading";
      processedContent = content + " <span class='loading-indicator'>⏳</span>";
    }
    
    const markup = await marked(processedContent);
    const template = html`
      <div class="message ${role}${extraClasses}">
        <div class="content">
          <div class="text">${htmlRaw(markup)}</div>
        </div>
      </div>
    `;

    this.innerHTML = String(template);
  }
}

if (!customElements.get('chat-message')) {
  customElements.define("chat-message", ChatMessage);
}
