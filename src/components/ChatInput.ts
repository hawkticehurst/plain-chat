import { Component, html } from "@lib";

export class ChatInput extends Component {
  private _isLoading = false;
  private _isStreaming = false;
  private _selectedModel = "google/gemini-2.5-flash-preview-05-20";

  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.append(html`
      <div class="wrapper">
        <div class="input-container">
          <textarea
            class="input"
            placeholder="Type your message here..."
            rows="1"
            ${this._isLoading || this._isStreaming ? "disabled" : ""}
          ></textarea>
          <div class="actions">
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
        <div class="model-selector">
          <select class="model-select" title="Select AI Model">
            <option value="google/gemini-2.5-flash-preview-05-20">
              Gemini 2.5 Flash
            </option>
            <option value="openai/gpt-4">GPT-4</option>
            <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
            <option value="anthropic/claude-3-sonnet">Claude 3 Sonnet</option>
            <option value="google/gemini-pro">Gemini Pro</option>
            <option value="meta-llama/llama-3-8b-instruct">Llama 3 8B</option>
          </select>
        </div>
      </div>
    `);

    // Add event listeners for auto-resize and send functionality
    const textarea = this.querySelector(".input") as HTMLTextAreaElement;
    const sendBtn = this.querySelector(".send-btn") as HTMLButtonElement;
    const cancelBtn = this.querySelector(".cancel-btn") as HTMLButtonElement;
    const modelSelect = this.querySelector(
      ".model-select"
    ) as HTMLSelectElement;

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

    if (modelSelect) {
      modelSelect.value = this._selectedModel;
      modelSelect.addEventListener(
        "change",
        this._handleModelChange.bind(this)
      );
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

  private _handleModelChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this._selectedModel = select.value;

    // Dispatch event to notify parent of model change
    this.dispatchEvent(
      new CustomEvent("model-changed", {
        detail: { model: this._selectedModel },
        bubbles: true,
        composed: true,
      })
    );
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
          detail: { message, model: this._selectedModel },
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

  // Method to get the currently selected model
  public getSelectedModel(): string {
    return this._selectedModel;
  }

  // Method to set the selected model programmatically
  public setSelectedModel(model: string) {
    this._selectedModel = model;
    const modelSelect = this.querySelector(
      ".model-select"
    ) as HTMLSelectElement;
    if (modelSelect) {
      modelSelect.value = model;
    }
  }
}

if (!customElements.get("chat-input")) {
  customElements.define("chat-input", ChatInput);
}
