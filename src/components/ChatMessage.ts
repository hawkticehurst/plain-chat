import { Component, html, htmlRaw } from "../lib/index";
import { marked } from "marked";

export class ChatMessage extends Component {
  private _content: string = "";
  private _isStreaming: boolean = false;
  private _role: "prompt" | "response" = "response";
  private _hasError: boolean = false;
  private _errorMessage: string = "";

  // Word-by-word animation state
  private _displayedContent: string = "";
  private _wordIndex: number = 0;
  private _words: string[] = [];
  private _animationTimeout: number | null = null;

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
      // For streaming, we'll manually control the content display
      processedContent = "";
    }

    // For streaming responses, we need to handle partial markdown more carefully
    let markup: string;
    if (isStreaming && role === "response") {
      // Start with empty content for streaming
      markup = "";
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

  // Method to update content during streaming with smooth word-by-word animation
  async updateStreamingContent(newContent: string) {
    if (!this._isStreaming) return;

    this._content = newContent;

    // Parse all content into words, preserving spaces and structure
    const allWords = this._parseIntoWords(newContent);

    // Only update the word queue if we have new words
    if (allWords.length > this._words.length) {
      this._words = allWords;

      // If not currently animating, start animation
      if (!this._animationTimeout) {
        this._animateWords();
      }
    }
  }

  private _parseIntoWords(content: string): string[] {
    const words: string[] = [];
    let currentWord = "";

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === " " || char === "\t") {
        // Finish current word if any
        if (currentWord) {
          words.push(currentWord);
          currentWord = "";
        }
        // Add the space as a separate "word"
        words.push(char);
      } else if (char === "\n") {
        // Finish current word if any
        if (currentWord) {
          words.push(currentWord);
          currentWord = "";
        }
        // Add newline as separate "word"
        words.push("\n");
      } else {
        currentWord += char;
      }
    }

    // Add final word if any
    if (currentWord) {
      words.push(currentWord);
    }

    return words;
  }

  private _animateWords() {
    if (this._animationTimeout) {
      clearTimeout(this._animationTimeout);
    }

    this._scheduleNextWord();
  }

  private _scheduleNextWord() {
    if (this._wordIndex >= this._words.length) {
      return; // Animation complete
    }

    const word = this._words[this._wordIndex];
    this._displayedContent += word;
    this._wordIndex++;

    // Update the display
    this._updateDisplay();

    // Calculate delay for next word
    const delay = this._getWordDelay(word);

    // Schedule next word
    this._animationTimeout = window.setTimeout(() => {
      this._scheduleNextWord();
    }, delay);
  }

  private _getWordDelay(word: string): number {
    // Much faster timing for smooth streaming effect
    if (word === " " || word === "\t") return 5; // Spaces: instant
    if (word === "\n") return 15; // Newlines: very short pause
    if (word.match(/[.!?]$/)) return 40; // End of sentence: short pause
    if (word.match(/[,;:]$/)) return 25; // Punctuation: brief pause
    if (word.length <= 2) return 15; // Short words: very fast
    if (word.length <= 5) return 20; // Medium words: fast
    return 25; // Long words: still fast
  }

  private _updateDisplay() {
    const textElement = this.querySelector(".text") as HTMLElement;
    if (!textElement) return;

    // Naive approach: just parse all current content as markdown every time
    try {
      const markdownHtml = marked.parse(this._displayedContent) as string;
      textElement.innerHTML = markdownHtml;
    } catch (error) {
      // If markdown parsing fails, just show as plain text
      textElement.innerHTML = this._escapeHtml(this._displayedContent).replace(
        /\n/g,
        "<br>"
      );
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

  // Method to finalize streaming (remove animations, full markdown render)
  async finalizeStream() {
    this._isStreaming = false;

    // Clear any pending animation
    if (this._animationTimeout) {
      clearTimeout(this._animationTimeout);
      this._animationTimeout = null;
    }

    // Reset animation state
    this._wordIndex = 0;
    this._displayedContent = "";
    this._words = [];

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

    // Clear any pending animation
    if (this._animationTimeout) {
      clearTimeout(this._animationTimeout);
      this._animationTimeout = null;
    }

    // Re-render to show error
    this.render(this._role, this._content, false, false);
  }
}

if (!customElements.get("chat-message")) {
  customElements.define("chat-message", ChatMessage);
}
