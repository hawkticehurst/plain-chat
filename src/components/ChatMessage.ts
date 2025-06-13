import { Component, html, htmlRaw } from "@lib";
import { marked } from "marked";

export class ChatMessage extends Component {
  private _content: string = "";
  private _isStreaming: boolean = false;
  private _role: "prompt" | "response" = "response";
  private _hasError: boolean = false;
  private _errorMessage: string = "";

  async render(
    role: "prompt" | "response",
    content: string,
    isLoading = false,
    isStreaming = false
  ) {
    this._role = role;
    this._content = content;
    this._isStreaming = isStreaming;

    let processedContent = content;
    let extraClasses = "";

    if (isLoading) {
      extraClasses = " loading";
      processedContent = content + " <span class='loading-indicator'>⏳</span>";
    } else if (isStreaming) {
      extraClasses = " streaming";
      // For streaming, just show the content directly - no complex animation
      processedContent = content;
    }

    // Process markdown for all content, including streaming
    let markup: string;
    if (isStreaming && role === "response") {
      // For streaming, render markdown carefully to handle partial content
      try {
        markup = await marked(processedContent);
      } catch (error) {
        // Fallback to raw content if markdown parsing fails on partial content
        markup = processedContent.replace(/\n/g, "<br>");
      }
    } else {
      markup = await marked(processedContent);
    }

    const template = html`
      <div class="message ${role}${extraClasses}">
        <div class="content">
          <div class="text">${htmlRaw(markup)}</div>
          ${this._hasError
            ? html`<div class="error-box">${this._errorMessage}</div>`
            : ""}
        </div>
      </div>
    `;

    this.innerHTML = String(template);
  }

  // Method to update content during streaming - simple and efficient
  async updateStreamingContent(newContent: string) {
    if (!this._isStreaming) {
      // If not streaming, just update content normally
      this._content = newContent;
      await this.render(this._role, newContent, false, false);
      return;
    }

    // Only update if content actually changed
    if (this._content === newContent) {
      return;
    }

    this._content = newContent;

    // Simple approach: just update the text content directly
    // This prevents the flickering caused by constant markdown re-parsing
    const textElement = this.querySelector(".text") as HTMLElement;
    if (textElement) {
      // Use requestAnimationFrame to batch DOM updates and reduce layout thrashing
      requestAnimationFrame(async () => {
        try {
          const markdownHtml = await marked(newContent);
          // Only update if the element still exists and content is still current
          if (textElement.parentNode && this._content === newContent) {
            textElement.innerHTML = markdownHtml;
          }
        } catch (error) {
          // Fallback to plain text with line breaks
          if (textElement.parentNode && this._content === newContent) {
            textElement.innerHTML = this._escapeHtml(newContent).replace(
              /\n/g,
              "<br>"
            );
          }
        }
      });
    }
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Method to finalize streaming (remove streaming class, ensure final render)
  async finalizeStream() {
    this._isStreaming = false;

    // Render final content with full markdown
    const markup = await marked(this._content);

    const messageDiv = this.querySelector(".message");
    const textElement = this.querySelector(".text") as HTMLElement;

    if (messageDiv) {
      messageDiv.classList.remove("streaming");
    }

    if (textElement) {
      textElement.innerHTML = markup;
    }
  }

  // Method to show error during streaming
  showStreamingError(errorMessage: string) {
    this._hasError = true;
    this._errorMessage = errorMessage;

    // Re-render to show error
    this.render(this._role, this._content, false, false);
  }
}

if (!customElements.get("chat-message")) {
  customElements.define("chat-message", ChatMessage);
}
