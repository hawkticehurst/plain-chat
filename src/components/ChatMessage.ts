import { Component, html, signal, effect, computed } from "@lib";
import { marked } from "marked";
import { codeToHtml } from "shiki";
import "./ChatMessage.css";

export class ChatMessage extends Component {
  // Private reactive state using signals
  #role = signal<"prompt" | "response">("response");
  #content = signal<string>("");
  #isLoading = signal<boolean>(false);
  #isStreaming = signal<boolean>(false);
  #hasError = signal<boolean>(false);
  #errorMessage = signal<string>("");
  #aiMetadata = signal<{ model?: string; tokenCount?: number } | null>(null);

  // DOM references
  #messageContainer: HTMLElement | null = null;
  #textElement: HTMLElement | null = null;
  #errorElement: HTMLElement | null = null;
  #metadataElement: HTMLElement | null = null;

  // Shiki configuration
  #shikiLoaded = false;

  // Computed values
  #processedContent = computed(() => {
    const content = this.#content();
    const isLoading = this.#isLoading();
    const isStreaming = this.#isStreaming();

    console.log("🔍 ChatMessage processedContent computed:", {
      content,
      isLoading,
      isStreaming,
      role: this.#role(),
    });

    return this.#processContent(
      content,
      isLoading || (isStreaming && content === "...")
    );
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
    // Initialize Shiki asynchronously - don't block component initialization
    this.#initializeShiki();

    // Build the DOM structure once
    this.append(html`
      <div class="message">
        <div class="content">
          <div class="text"></div>
          <div class="ai-metadata" style="display: none;"></div>
          <div class="error-box" style="display: none;"></div>
        </div>
      </div>
    `);

    // Cache DOM references
    this.#messageContainer = this.querySelector(".message") as HTMLElement;
    this.#textElement = this.querySelector(".text") as HTMLElement;
    this.#errorElement = this.querySelector(".error-box") as HTMLElement;
    this.#metadataElement = this.querySelector(".ai-metadata") as HTMLElement;

    // Wire up reactive effects
    this.#setupReactiveEffects();
  }

  async #initializeShiki() {
    try {
      // Test that codeToHtml is available with a simple example
      const testResult = await codeToHtml("console.log('test');", {
        lang: "javascript",
        theme: "github-dark",
      });

      if (testResult && testResult.includes("<pre")) {
        this.#shikiLoaded = true;
      } else {
        throw new Error("Shiki returned invalid result");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.warn(
        "⚠️ Shiki initialization failed, using fallback styling:",
        errorMessage
      );
      this.#shikiLoaded = false;
    }
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

    // Show/hide AI metadata
    effect(() => {
      if (!this.#metadataElement) return;

      const metadata = this.#aiMetadata();
      const role = this.#role();
      const isStreaming = this.#isStreaming();

      // Only show metadata for response messages that are not currently streaming
      if (
        role === "response" &&
        !isStreaming &&
        metadata &&
        (metadata.model || metadata.tokenCount)
      ) {
        let metadataHTML = '<div class="ai-metadata-content">';

        if (metadata.model) {
          metadataHTML += `<span class="model-name">${metadata.model}</span>`;
        }

        if (metadata.tokenCount) {
          metadataHTML += `<span class="token-count-final">~ ${metadata.tokenCount} tokens</span>`;
        }

        metadataHTML += "</div>";

        this.#metadataElement.innerHTML = metadataHTML;
        this.#metadataElement.style.display = "block";
      } else {
        this.#metadataElement.style.display = "none";
      }
    });

    // Re-render with full syntax highlighting when streaming completes
    effect(() => {
      const isStreaming = this.#isStreaming();
      const content = this.#content();
      const role = this.#role();

      // When streaming stops, re-process content for better syntax highlighting
      if (!isStreaming && content && role === "response") {
        // Small delay to ensure the content has been fully set
        setTimeout(() => {
          this.#updateTextContent(content, false, role);
        }, 100);
      }
    });
  }

  async #updateTextContent(
    content: string,
    isStreaming: boolean,
    role: "prompt" | "response"
  ) {
    if (!this.#textElement) return;

    // For loading state with just "...", replace with animated dots
    if (content === "..." && (this.#isLoading() || this.#isStreaming())) {
      const animatedDots = `
        <span class="loading-dots-animated">
          <span class="dot">●</span>
          <span class="dot">●</span>
          <span class="dot">●</span>
        </span>
      `;

      requestAnimationFrame(() => {
        if (this.#textElement && this.#content() === content) {
          this.#textElement.innerHTML = animatedDots;
        }
      });
      return;
    }

    // Process markdown for all other content
    let markup: string;
    if (isStreaming && role === "response") {
      // For streaming, render markdown carefully to handle partial content
      try {
        markup = await this.#processMarkdownWithSyntaxHighlighting(content);
      } catch (error) {
        // Fallback to raw content if markdown parsing fails on partial content
        markup = this.#escapeHtml(content).replace(/\n/g, "<br>");
      }
    } else {
      try {
        markup = await this.#processMarkdownWithSyntaxHighlighting(content);
      } catch (error) {
        markup = this.#escapeHtml(content).replace(/\n/g, "<br>");
      }
    }

    // Use requestAnimationFrame to batch DOM updates and reduce layout thrashing
    requestAnimationFrame(() => {
      if (this.#textElement && this.#content() === content) {
        this.#textElement.innerHTML = markup;

        // Add copy button event listeners after DOM update
        this.#setupCopyButtons();
      }
    });
  }

  async #processMarkdownWithSyntaxHighlighting(
    content: string
  ): Promise<string> {
    // Configure marked to use custom renderer for code blocks
    const renderer = new marked.Renderer();

    // Override code block rendering to use Shiki
    renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
      return this.#renderCodeBlock(text, lang || "");
    };

    // Override inline code rendering
    renderer.codespan = ({ text }: { text: string }) => {
      return `<code class="inline-code">${this.#escapeHtml(text)}</code>`;
    };

    marked.setOptions({ renderer });

    const html = await marked(content);

    // Post-process to apply syntax highlighting to code blocks
    return await this.#applySyntaxHighlighting(html);
  }

  #renderCodeBlock(code: string, language: string): string {
    const codeId = `code-${Math.random().toString(36).substring(2, 9)}`;
    return `<pre class="code-block" data-code-id="${codeId}" data-lang="${language}">
      <button class="copy-button" data-code-id="${codeId}" aria-label="Copy code">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
        </svg>
        <span class="copy-text">Copy</span>
      </button>
      <code class="hljs">${this.#escapeHtml(code)}</code>
    </pre>`;
  }

  async #applySyntaxHighlighting(html: string): Promise<string> {
    if (!this.#shikiLoaded) {
      return html;
    }

    // Create a temporary DOM to process code blocks
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const codeBlocks = tempDiv.querySelectorAll("pre.code-block code");

    for (const codeBlock of codeBlocks) {
      const pre = codeBlock.parentElement as HTMLPreElement;
      const language = pre.getAttribute("data-lang") || "text";
      const code = codeBlock.textContent || "";

      try {
        // Determine theme based on color scheme
        const isDark = window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches;
        const theme = isDark ? "github-dark" : "github-light";
        const mappedLang = this.#mapLanguage(language);

        const highlightedHtml = await codeToHtml(code, {
          lang: mappedLang,
          theme: theme,
        });

        // Extract the highlighted code from Shiki's output
        const parser = new DOMParser();
        const shikiDoc = parser.parseFromString(highlightedHtml, "text/html");
        const shikiPre = shikiDoc.querySelector("pre");

        if (shikiPre) {
          // Copy attributes and classes from our custom pre to Shiki's pre
          shikiPre.className = `code-block hljs ${shikiPre.className}`;
          shikiPre.setAttribute(
            "data-code-id",
            pre.getAttribute("data-code-id") || ""
          );

          // Preserve the copy button
          const copyButton = pre.querySelector(".copy-button");
          if (copyButton) {
            shikiPre.insertBefore(
              copyButton.cloneNode(true),
              shikiPre.firstChild
            );
          }

          // Preserve any additional styling
          const originalStyle = pre.getAttribute("style");
          if (originalStyle) {
            shikiPre.setAttribute("style", originalStyle);
          }

          pre.replaceWith(shikiPre);
        }
      } catch (error) {
        console.warn(
          `Failed to highlight ${language} code block:`,
          error instanceof Error ? error.message : "Unknown error"
        );

        // Apply basic fallback styling for failed highlighting
        pre.classList.add("hljs", "hljs-fallback");
        codeBlock.innerHTML = this.#escapeHtml(code);
      }
    }

    return tempDiv.innerHTML;
  }

  #mapLanguage(language: string): string {
    // Map common language aliases to Shiki-supported languages
    const languageMap: Record<string, string> = {
      js: "javascript",
      ts: "typescript",
      htm: "html",
      py: "python",
      sh: "bash",
      shell: "bash",
      yml: "yaml",
      md: "markdown",
      "c++": "cpp",
      csharp: "c#",
      cs: "c#",
      dockerfile: "docker",
      makefile: "make",
      vim: "viml",
      zsh: "bash",
      fish: "bash",
    };

    const mappedLang =
      languageMap[language.toLowerCase()] || language.toLowerCase();

    const supportedLanguages = [
      "javascript",
      "typescript",
      "jsx",
      "tsx",
      "python",
      "json",
      "html",
      "css",
      "scss",
      "sass",
      "svelte",
      "vue",
      "astro",
      "bash",
      "sql",
      "markdown",
      "yaml",
      "xml",
      "java",
      "cpp",
      "c",
      "go",
      "rust",
      "php",
      "ruby",
      "swift",
      "kotlin",
      "scala",
      "dart",
      "r",
      "matlab",
      "lua",
      "perl",
      "haskell",
      "clojure",
      "erlang",
      "elixir",
      "ocaml",
      "fsharp",
      "powershell",
      "dockerfile",
      "nginx",
      "apache",
      "ini",
      "toml",
      "vim",
      "tex",
      "latex",
      "makefile",
      "cmake",
      "graphql",
      "prisma",
      "solidity",
    ];

    // Fallback to 'text' for unsupported languages to prevent errors
    return supportedLanguages.includes(mappedLang) ? mappedLang : "text";
  }

  #escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  #setupCopyButtons() {
    if (!this.#textElement) return;

    const copyButtons = this.#textElement.querySelectorAll(".copy-button");

    copyButtons.forEach((button) => {
      const htmlButton = button as HTMLButtonElement;
      const codeId = htmlButton.getAttribute("data-code-id");

      // Remove existing event listeners to prevent duplicates
      const newButton = htmlButton.cloneNode(true) as HTMLButtonElement;
      htmlButton.parentNode?.replaceChild(newButton, htmlButton);

      newButton.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        try {
          // Find the corresponding code block
          const codeBlock = this.#textElement?.querySelector(
            `pre[data-code-id="${codeId}"] code`
          );
          if (!codeBlock) return;

          const codeText = codeBlock.textContent || "";
          await navigator.clipboard.writeText(codeText);

          // Provide visual feedback
          const copyText = newButton.querySelector(".copy-text");
          const originalText = copyText?.textContent;

          if (copyText) {
            copyText.textContent = "Copied!";
            newButton.classList.add("copied");

            setTimeout(() => {
              copyText.textContent = originalText || "Copy";
              newButton.classList.remove("copied");
            }, 2000);
          }
        } catch (error) {
          console.error("Failed to copy code:", error);

          // Fallback visual feedback for errors
          const copyText = newButton.querySelector(".copy-text");
          const originalText = copyText?.textContent;

          if (copyText) {
            copyText.textContent = "Failed";
            newButton.classList.add("error");

            setTimeout(() => {
              copyText.textContent = originalText || "Copy";
              newButton.classList.remove("error");
            }, 2000);
          }
        }
      });
    });
  }

  #processContent(content: string, isLoading: boolean): string {
    // Don't modify content, let CSS handle the animation
    console.log("🎬 Content processing:", {
      content,
      isLoading,
      isStreaming: this.#isStreaming(),
    });
    return content;
  }

  // Public API methods
  public async render(
    role: "prompt" | "response",
    content: string,
    isLoading = false,
    isStreaming = false,
    aiMetadata?: { model?: string; tokenCount?: number }
  ) {
    console.log("🎭 ChatMessage render called:", {
      role,
      content,
      isLoading,
      isStreaming,
      aiMetadata,
    });

    this.#role(role);
    this.#content(content);
    this.#isLoading(isLoading);
    this.#isStreaming(isStreaming);
    this.#hasError(false);
    this.#errorMessage("");
    this.#aiMetadata(aiMetadata || null);
  }

  public async updateStreamingContent(newContent: string) {
    // Only update if content actually changed
    if (this.#content() !== newContent) {
      this.#content(newContent);
    }
  }

  public async finalizeStream(aiMetadata?: {
    model?: string;
    tokenCount?: number;
  }) {
    this.#isStreaming(false);
    if (aiMetadata) {
      this.#aiMetadata(aiMetadata);
    }
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
