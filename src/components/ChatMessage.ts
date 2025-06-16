import { Component, html, signal, effect, computed } from "@lib";
import { marked } from "marked";
import "./ChatMessage.css";

export class ChatMessage extends Component {
  // Private reactive state using signals
  #role = signal<"prompt" | "response">("response");
  #content = signal<string>("");
  #isLoading = signal<boolean>(false);
  #isStreaming = signal<boolean>(false);
  #hasError = signal<boolean>(false);
  #errorMessage = signal<string>("");

  // DOM references
  #messageContainer: HTMLElement | null = null;
  #textElement: HTMLElement | null = null;
  #errorElement: HTMLElement | null = null;

  // Computed values
  #processedContent = computed(() => {
    const content = this.#content();
    const isLoading = this.#isLoading();

    if (isLoading) {
      return content + " <span class='loading-indicator'>⏳</span>";
    }
    return content;
  });

  #cssClasses = computed(() => {
    const role = this.#role();
    const isLoading = this.#isLoading();
    const isStreaming = this.#isStreaming();

    let classes = `message ${role}`;
    if (isLoading) classes += " loading";
    if (isStreaming) classes += " streaming";

    return classes;
  });

  init() {
    // Build the DOM structure once
    this.append(html`
      <div class="message">
        <div class="content">
          <div class="text"></div>
          <div class="error-box" style="display: none;"></div>
        </div>
      </div>
    `);

    // Cache DOM references
    this.#messageContainer = this.querySelector(".message") as HTMLElement;
    this.#textElement = this.querySelector(".text") as HTMLElement;
    this.#errorElement = this.querySelector(".error-box") as HTMLElement;

    // Wire up reactive effects
    this.#setupReactiveEffects();
  }

  #setupReactiveEffects() {
    // Update CSS classes when role, loading, or streaming state changes
    effect(() => {
      if (!this.#messageContainer) return;
      this.#messageContainer.className = this.#cssClasses();
    });

    // Update text content when content or loading state changes
    effect(() => {
      if (!this.#textElement) return;

      const content = this.#processedContent();
      const isStreaming = this.#isStreaming();
      const role = this.#role();

      this.#updateTextContent(content, isStreaming, role);
    });

    // Show/hide error message
    effect(() => {
      if (!this.#errorElement) return;

      const hasError = this.#hasError();
      const errorMessage = this.#errorMessage();

      if (hasError && errorMessage) {
        this.#errorElement.textContent = errorMessage;
        this.#errorElement.style.display = "block";
      } else {
        this.#errorElement.style.display = "none";
      }
    });
  }

  async #updateTextContent(
    content: string,
    isStreaming: boolean,
    role: "prompt" | "response"
  ) {
    if (!this.#textElement) return;

    // Process markdown for all content, including streaming
    let markup: string;
    if (isStreaming && role === "response") {
      // For streaming, render markdown carefully to handle partial content
      try {
        markup = await marked(content);
      } catch (error) {
        // Fallback to raw content if markdown parsing fails on partial content
        markup = this.#escapeHtml(content).replace(/\n/g, "<br>");
      }
    } else {
      try {
        markup = await marked(content);
      } catch (error) {
        markup = this.#escapeHtml(content).replace(/\n/g, "<br>");
      }
    }

    // Use requestAnimationFrame to batch DOM updates and reduce layout thrashing
    requestAnimationFrame(() => {
      if (this.#textElement && this.#content() === content) {
        this.#textElement.innerHTML = markup;
      }
    });
  }

  #escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Public API methods
  public async render(
    role: "prompt" | "response",
    content: string,
    isLoading = false,
    isStreaming = false
  ) {
    this.#role(role);
    this.#content(content);
    this.#isLoading(isLoading);
    this.#isStreaming(isStreaming);
    this.#hasError(false);
    this.#errorMessage("");
  }

  public async updateStreamingContent(newContent: string) {
    // Only update if content actually changed
    if (this.#content() !== newContent) {
      this.#content(newContent);
    }
  }

  public async finalizeStream() {
    this.#isStreaming(false);
    // Content will be re-rendered automatically due to reactive effects
  }

  public showStreamingError(errorMessage: string) {
    this.#hasError(true);
    this.#errorMessage(errorMessage);
    this.#isStreaming(false);
  }
}

if (!customElements.get("chat-message")) {
  customElements.define("chat-message", ChatMessage);
}
