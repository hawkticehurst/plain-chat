import { Component, html, signal, effect, computed } from "@lib";
import { marked } from "marked";
// @ts-ignore - Shiki ESM import
import { codeToHtml } from "https://esm.sh/shiki@3.6.0";
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

  // Shiki configuration
  #shikiLoaded = false;

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
    // Initialize Shiki asynchronously - don't block component initialization
    this.#initializeShiki();

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

    // Process markdown for all content, including streaming
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
    return `<pre class="code-block" data-language="${language}"><code class="hljs">${this.#escapeHtml(code)}</code></pre>`;
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
      const language = pre.getAttribute("data-language") || "text";
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
          shikiPre.setAttribute("data-language", language);

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
    console.log(`Mapping language: ${language}`);
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
