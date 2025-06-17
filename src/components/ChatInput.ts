import { Component, html, signal, effect } from "@lib";
import "./ChatInput.css";

export class ChatInput extends Component {
  // Private reactive state using signals
  #isLoading = signal(false);
  #isStreaming = signal(false);
  #selectedModel = signal("google/gemini-2.5-flash-preview-05-20");
  #textValue = signal("");

  // Cached DOM references (queried once in init)
  #textarea: HTMLTextAreaElement | null = null;
  #sendBtn: HTMLButtonElement | null = null;
  #cancelBtn: HTMLButtonElement | null = null;
  #modelSelect: HTMLSelectElement | null = null;

  init() {
    this.innerHTML = "";
    this.append(html`
      <div class="wrapper">
        <div class="input-container">
          <textarea
            class="input"
            placeholder="Type your message here..."
            rows="1"
            @input="handleTextareaInput"
            @keydown="handleKeyDown"
          ></textarea>
          <div class="actions">
            <button
              class="send-btn"
              type="button"
              title="Send message"
              @click="handleSend"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <button
              class="cancel-btn"
              type="button"
              title="Cancel streaming response"
              @click="handleCancel"
              style="display: none;"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
        <div class="model-selector">
          <select
            class="model-select"
            title="Select AI Model"
            @change="handleModelChange"
          >
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

    // Cache DOM references
    this.#textarea = this.querySelector(".input") as HTMLTextAreaElement;
    this.#sendBtn = this.querySelector(".send-btn") as HTMLButtonElement;
    this.#cancelBtn = this.querySelector(".cancel-btn") as HTMLButtonElement;
    this.#modelSelect = this.querySelector(
      ".model-select"
    ) as HTMLSelectElement;

    // Set initial model value
    if (this.#modelSelect) {
      this.#modelSelect.value = this.#selectedModel();
    }

    // Wire up reactive effects for granular updates
    this.#setupReactiveEffects();
  }

  #setupReactiveEffects() {
    // Update textarea disabled state based on loading/streaming
    effect(() => {
      if (this.#textarea) {
        this.#textarea.disabled = this.#isLoading() || this.#isStreaming();
      }
    });

    // Update send button based on loading state
    effect(() => {
      if (this.#sendBtn) {
        this.#sendBtn.disabled = this.#isLoading();
        this.#sendBtn.innerHTML = "";
        const markup = this.#isLoading()
          ? html`<span>Loading</span>`
          : html`<svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
                clip-rule="evenodd"
              />
            </svg>`;
        this.#sendBtn.appendChild(markup);
        this.#sendBtn.style.display = this.#isStreaming() ? "none" : "flex";
      }
    });

    // Update cancel button based on streaming state
    effect(() => {
      if (this.#cancelBtn) {
        this.#cancelBtn.style.display = this.#isStreaming() ? "flex" : "none";
      }
    });
  }

  // Event handlers (called via @ attributes)
  handleTextareaInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.#textValue(textarea.value);

    // Auto-resize functionality
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  }

  handleModelChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.#selectedModel(select.value);

    // Dispatch event to notify parent of model change
    this.dispatchEvent(
      new CustomEvent("model-changed", {
        detail: { model: this.#selectedModel() },
        bubbles: true,
        composed: true,
      })
    );
  }

  handleSend() {
    if (!this.#textarea || !this.#textValue().trim() || this.#isLoading()) {
      return;
    }

    const message = this.#textValue().trim();

    // Clear the input
    this.#textarea.value = "";
    this.#textValue("");
    this.#textarea.style.height = "auto";

    try {
      this.#isLoading(true);

      // Dispatch event to ChatMain to handle the AI conversation
      this.dispatchEvent(
        new CustomEvent("send-message", {
          detail: { message, model: this.#selectedModel() },
          bubbles: true,
          composed: true,
        })
      );
    } catch (error) {
      console.error("Error sending message:", error);
      // Re-enable input on error
      this.#isLoading(false);
    }
  }

  handleCancel() {
    if (this.#isStreaming()) {
      // Dispatch cancel event to ChatMain
      this.dispatchEvent(
        new CustomEvent("cancel-streaming", {
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  // Public API methods for parent components
  messageProcessed() {
    this.#isLoading(false);
    this.#isStreaming(false);
  }

  streamingStarted() {
    this.#isStreaming(true);
    this.#isLoading(false);
  }

  streamingEnded() {
    this.#isStreaming(false);
    this.#isLoading(false);
  }

  getSelectedModel(): string {
    return this.#selectedModel();
  }

  setSelectedModel(model: string) {
    this.#selectedModel(model);
    if (this.#modelSelect) {
      this.#modelSelect.value = model;
    }
  }
}

if (!customElements.get("chat-input")) {
  customElements.define("chat-input", ChatInput);
}
