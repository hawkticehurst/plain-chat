import { Component, html } from "../lib/index";

export class ChatInput extends Component {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const template = html`
      <div class="wrapper">
        <textarea
          class="input"
          placeholder="Type your message here..."
          rows="1"
        ></textarea>
        <div class="actions">
          <button class="attach-btn" type="button" title="Attach file">
            📎
          </button>
          <button class="send-btn" type="button" title="Send message">➤</button>
        </div>
      </div>
    `;

    this.innerHTML = String(template);

    // Add event listeners for auto-resize and send functionality
    const textarea = this.querySelector(".input") as HTMLTextAreaElement;
    const sendBtn = this.querySelector(".send-btn") as HTMLButtonElement;

    if (textarea) {
      textarea.addEventListener("input", this._handleTextareaResize.bind(this));
      textarea.addEventListener("keydown", this._handleKeyDown.bind(this));
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", this._handleSend.bind(this));
    }
  }

  private _handleTextareaResize(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  }

  private _handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this._handleSend();
    }
  }

  private _handleSend() {
    const textarea = this.querySelector(".input") as HTMLTextAreaElement;
    if (textarea && textarea.value.trim()) {
      // TODO: Dispatch custom event with message content
      console.log("Sending message:", textarea.value);
      textarea.value = "";
      textarea.style.height = "auto";
    }
  }
}

customElements.define("chat-input", ChatInput);
