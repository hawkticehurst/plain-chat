import { Component, html } from "../lib/index";

export class ChatInput extends Component {
  private _isLoading = false;
  private _isStreaming = false;

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
          ${this._isLoading || this._isStreaming ? "disabled" : ""}
        ></textarea>
        <div class="actions">
          <button
            class="attach-btn"
            type="button"
            title="Attach file"
            ${this._isLoading || this._isStreaming ? "disabled" : ""}
          >
            📎
          </button>
          ${this._isStreaming
            ? html`<button
                class="cancel-btn"
                type="button"
                title="Cancel streaming response"
              >
                ⏹️
              </button>`
            : html`<button
                class="send-btn"
                type="button"
                title="Send message"
                ${this._isLoading ? "disabled" : ""}
              >
                ${this._isLoading ? "⏳" : "➤"}
              </button>`}
        </div>
      </div>
    `;

    this.innerHTML = String(template);

    // Add event listeners for auto-resize and send functionality
    const textarea = this.querySelector(".input") as HTMLTextAreaElement;
    const sendBtn = this.querySelector(".send-btn") as HTMLButtonElement;
    const cancelBtn = this.querySelector(".cancel-btn") as HTMLButtonElement;

    if (textarea) {
      textarea.addEventListener("input", this._handleTextareaResize.bind(this));
      textarea.addEventListener("keydown", this._handleKeyDown.bind(this));
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", this._handleSend.bind(this));
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", this._handleCancel.bind(this));
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

  private async _handleSend() {
    const textarea = this.querySelector(".input") as HTMLTextAreaElement;
    if (!textarea || !textarea.value.trim() || this._isLoading) {
      return;
    }

    const message = textarea.value.trim();
    textarea.value = "";
    textarea.style.height = "auto";

    try {
      this._isLoading = true;
      this.render(); // Re-render to show loading state

      // Dispatch event to ChatMain to handle the AI conversation
      this.dispatchEvent(
        new CustomEvent("send-message", {
          detail: { message },
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      console.error("Error sending message:", error);
      // Re-enable input on error
      this._isLoading = false;
      this.render();
    }
  }

  private _handleCancel() {
    if (this._isStreaming) {
      // Dispatch cancel event to ChatMain
      this.dispatchEvent(
        new CustomEvent("cancel-streaming", {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  // Method to be called by parent when message processing is complete
  public messageProcessed() {
    this._isLoading = false;
    this._isStreaming = false;
    this.render();
  }

  // Method to be called by parent when streaming starts
  public streamingStarted() {
    this._isStreaming = true;
    this._isLoading = false;
    this.render();
  }

  // Method to be called by parent when streaming ends
  public streamingEnded() {
    this._isStreaming = false;
    this._isLoading = false;
    this.render();
  }
}

if (!customElements.get("chat-input")) {
  customElements.define("chat-input", ChatInput);
}
