import { Component, html, signal, effect, config, authService } from "@lib";
import { authStore } from "../stores/AuthStore";
import "./ChatInput.css";

export class ChatInput extends Component {
  // Private reactive state using signals
  #isLoading = signal(false);
  #isStreaming = signal(false);
  #selectedModel = signal("google/gemini-2.5-flash-preview-05-20");
  #textValue = signal("");
  #isModelMenuOpen = signal(false);

  // Constants for local storage
  static readonly #LOCAL_STORAGE_MODEL_KEY = "plain-chat-selected-model";

  // Available AI models
  #availableModels = [
    {
      id: "google/gemini-2.5-flash-preview-05-20",
      name: "Gemini 2.5 Flash",
    },
    {
      id: "google/gemini-2.5-flash-lite-preview-06-17",
      name: "Gemini 2.5 Flash Lite",
    },
    { id: "openai/o4-mini", name: "o4 mini" },
    { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro" },
    { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
    { id: "anthropic/claude-3.7-sonnet", name: "Claude Sonnet 3.7" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude Sonnet 3.5" },
    { id: "openai/gpt-4.1", name: "GPT-4.1" },
    { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "deepseek/deepseek-chat-v3-0324:free", name: "DeepSeek V3" },
    { id: "deepseek/deepseek-r1-0528:free", name: "DeepSeek R1" },
    {
      id: "deepseek/deepseek-r1-distill-llama-70b",
      name: "DeepSeek R1 (Llama Distilled)",
    },
    { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick" },
    { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout" },
    { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
    { id: "meta-llama/llama-3-8b-instruct", name: "Llama 3 8B" },
  ];

  // Cached DOM references (queried once in init)
  #textarea: HTMLTextAreaElement | null = null;
  #sendBtn: HTMLButtonElement | null = null;
  #cancelBtn: HTMLButtonElement | null = null;
  #vscodeBtn: HTMLButtonElement | null = null;
  #modelButton: HTMLButtonElement | null = null;
  #modelMenu: HTMLDivElement | null = null;

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
        <div class="bottom-controls">
          <div class="model-selector">
            <button
              class="model-button"
              type="button"
              title="Select AI Model"
              @click="handleModelButtonClick"
              aria-expanded="false"
              aria-haspopup="menu"
            >
              <div class="model-icon-container"></div>
              <span class="model-name">${this.#getSelectedModelName()}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                class="dropdown-arrow"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m19.5 8.25-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>
            <div class="model-menu" style="display: none;" role="menu"></div>
          </div>
          <button
            class="vscode-summary-btn"
            type="button"
            title="Summarize conversation for VS Code"
            @click="handleVSCodeSummary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 100 100"
            >
              <mask
                id="a"
                width="100"
                height="100"
                x="0"
                y="0"
                mask-type="alpha"
                maskUnits="userSpaceOnUse"
              >
                <path
                  fill="#fff"
                  fill-rule="evenodd"
                  d="M70.912 99.317a6.223 6.223 0 0 0 4.96-.19l20.589-9.907A6.25 6.25 0 0 0 100 83.587V16.413a6.25 6.25 0 0 0-3.54-5.632L75.874.874a6.226 6.226 0 0 0-7.104 1.21L29.355 38.04 12.187 25.01a4.162 4.162 0 0 0-5.318.236l-5.506 5.009a4.168 4.168 0 0 0-.004 6.162L16.247 50 1.36 63.583a4.168 4.168 0 0 0 .004 6.162l5.506 5.01a4.162 4.162 0 0 0 5.318.236l17.168-13.032L68.77 97.917a6.217 6.217 0 0 0 2.143 1.4ZM75.015 27.3 45.11 50l29.906 22.701V27.3Z"
                  clip-rule="evenodd"
                />
              </mask>
              <g mask="url(#a)">
                <path
                  fill="#0065A9"
                  d="M96.461 10.796 75.857.876a6.23 6.23 0 0 0-7.107 1.207l-67.451 61.5a4.167 4.167 0 0 0 .004 6.162l5.51 5.009a4.167 4.167 0 0 0 5.32.236l81.228-61.62c2.725-2.067 6.639-.124 6.639 3.297v-.24a6.25 6.25 0 0 0-3.539-5.63Z"
                />
                <g filter="url(#b)">
                  <path
                    fill="#007ACC"
                    d="m96.461 89.204-20.604 9.92a6.229 6.229 0 0 1-7.107-1.207l-67.451-61.5a4.167 4.167 0 0 1 .004-6.162l5.51-5.009a4.167 4.167 0 0 1 5.32-.236l81.228 61.62c2.725 2.067 6.639.124 6.639-3.297v.24a6.25 6.25 0 0 1-3.539 5.63Z"
                  />
                </g>
                <g filter="url(#c)">
                  <path
                    fill="#1F9CF0"
                    d="M75.858 99.126a6.232 6.232 0 0 1-7.108-1.21c2.306 2.307 6.25.674 6.25-2.588V4.672c0-3.262-3.944-4.895-6.25-2.589a6.232 6.232 0 0 1 7.108-1.21l20.6 9.908A6.25 6.25 0 0 1 100 16.413v67.174a6.25 6.25 0 0 1-3.541 5.633l-20.601 9.906Z"
                  />
                </g>
                <path
                  fill="url(#d)"
                  fill-rule="evenodd"
                  d="M70.851 99.317a6.224 6.224 0 0 0 4.96-.19L96.4 89.22a6.25 6.25 0 0 0 3.54-5.633V16.413a6.25 6.25 0 0 0-3.54-5.632L75.812.874a6.226 6.226 0 0 0-7.104 1.21L29.294 38.04 12.126 25.01a4.162 4.162 0 0 0-5.317.236l-5.507 5.009a4.168 4.168 0 0 0-.004 6.162L16.186 50 1.298 63.583a4.168 4.168 0 0 0 .004 6.162l5.507 5.009a4.162 4.162 0 0 0 5.317.236L29.294 61.96l39.414 35.958a6.218 6.218 0 0 0 2.143 1.4ZM74.954 27.3 45.048 50l29.906 22.701V27.3Z"
                  clip-rule="evenodd"
                  opacity=".25"
                  style="mix-blend-mode:overlay"
                />
              </g>
              <defs>
                <filter
                  id="b"
                  width="116.727"
                  height="92.246"
                  x="-8.394"
                  y="15.829"
                  color-interpolation-filters="sRGB"
                  filterUnits="userSpaceOnUse"
                >
                  <feFlood flood-opacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  />
                  <feOffset />
                  <feGaussianBlur stdDeviation="4.167" />
                  <feColorMatrix
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                  />
                  <feBlend
                    in2="BackgroundImageFix"
                    mode="overlay"
                    result="effect1_dropShadow"
                  />
                  <feBlend
                    in="SourceGraphic"
                    in2="effect1_dropShadow"
                    result="shape"
                  />
                </filter>
                <filter
                  id="c"
                  width="47.917"
                  height="116.151"
                  x="60.417"
                  y="-8.076"
                  color-interpolation-filters="sRGB"
                  filterUnits="userSpaceOnUse"
                >
                  <feFlood flood-opacity="0" result="BackgroundImageFix" />
                  <feColorMatrix
                    in="SourceAlpha"
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  />
                  <feOffset />
                  <feGaussianBlur stdDeviation="4.167" />
                  <feColorMatrix
                    values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                  />
                  <feBlend
                    in2="BackgroundImageFix"
                    mode="overlay"
                    result="effect1_dropShadow"
                  />
                  <feBlend
                    in="SourceGraphic"
                    in2="effect1_dropShadow"
                    result="shape"
                  />
                </filter>
                <linearGradient
                  id="d"
                  x1="49.939"
                  x2="49.939"
                  y1=".258"
                  y2="99.742"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stop-color="#fff" />
                  <stop offset="1" stop-color="#fff" stop-opacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <span class="vscode-summary-text">Summarize</span>
          </button>
        </div>
      </div>
    `);

    // Cache DOM references
    this.#textarea = this.querySelector(".input") as HTMLTextAreaElement;
    this.#sendBtn = this.querySelector(".send-btn") as HTMLButtonElement;
    this.#cancelBtn = this.querySelector(".cancel-btn") as HTMLButtonElement;
    this.#vscodeBtn = this.querySelector(
      ".vscode-summary-btn"
    ) as HTMLButtonElement;
    this.#modelButton = this.querySelector(
      ".model-button"
    ) as HTMLButtonElement;
    this.#modelMenu = this.querySelector(".model-menu") as HTMLDivElement;

    // Populate the model menu
    this.#populateModelMenu();

    // Populate the initial model icon
    this.#updateModelButton();

    // Add event delegation for model menu clicks
    this.#modelMenu?.addEventListener(
      "click",
      this.#handleMenuClick.bind(this)
    );

    // Add click outside listener to close menu
    document.addEventListener("click", this.#handleClickOutside.bind(this));

    // Add keyboard navigation
    document.addEventListener(
      "keydown",
      this.#handleModelMenuKeydown.bind(this)
    );

    // Load saved model from local storage first
    this.#loadModelFromStorage();

    // Load user's preferred model from server
    this.#loadUserPreferences();

    // Wire up reactive effects for granular updates
    this.#setupReactiveEffects();
  }

  #getSelectedModelName(): string {
    const model = this.#availableModels.find(
      (m) => m.id === this.#selectedModel()
    );
    return model ? model.name : "Select Model";
  }

  #handleClickOutside(event: Event) {
    const target = event.target as Element;
    if (!this.contains(target) && this.#isModelMenuOpen()) {
      this.#closeModelMenu();
    }
  }

  #openModelMenu() {
    this.#isModelMenuOpen(true);
    if (this.#modelMenu && this.#modelButton) {
      this.#modelMenu.style.display = "grid";
      this.#modelButton.setAttribute("aria-expanded", "true");
    }
  }

  #closeModelMenu() {
    this.#isModelMenuOpen(false);
    if (this.#modelMenu && this.#modelButton) {
      this.#modelMenu.style.display = "none";
      this.#modelButton.setAttribute("aria-expanded", "false");
    }
  }

  #updateModelButton() {
    if (this.#modelButton) {
      const nameSpan = this.#modelButton.querySelector(".model-name");
      if (nameSpan) {
        nameSpan.textContent = this.#getSelectedModelName();
      }

      const iconContainer = this.#modelButton.querySelector(
        ".model-icon-container"
      );
      if (iconContainer) {
        iconContainer.innerHTML = this.#getModelLogo(this.#selectedModel());
      }
    }
  }

  #updateModelMenuOptions() {
    if (this.#modelMenu) {
      const options = this.#modelMenu.querySelectorAll(".model-option");
      options.forEach((option) => {
        const modelId = option.getAttribute("data-model-id");
        if (modelId === this.#selectedModel()) {
          option.classList.add("selected");
        } else {
          option.classList.remove("selected");
        }
      });
    }
  }

  #setupReactiveEffects() {
    // Update textarea disabled state based on loading/streaming/auth
    effect(() => {
      if (this.#textarea) {
        this.#textarea.disabled =
          this.#isLoading() ||
          this.#isStreaming() ||
          !authStore.isAuthenticated();
        this.#textarea.placeholder = !authStore.isAuthenticated()
          ? "Please sign in to send messages..."
          : "Type your message here...";
      }
    });

    // Update send button based on loading and auth state
    effect(() => {
      if (this.#sendBtn) {
        this.#sendBtn.disabled =
          this.#isLoading() || !authStore.isAuthenticated();
        this.#sendBtn.innerHTML = "";
        const markup = this.#isLoading()
          ? html`<span></span>`
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

    // Update VS Code button based on auth state and streaming
    effect(() => {
      if (this.#vscodeBtn) {
        this.#vscodeBtn.disabled =
          this.#isLoading() ||
          this.#isStreaming() ||
          !authStore.isAuthenticated();
      }
    });
  }

  async #loadUserPreferences() {
    try {
      // Wait for auth to be ready
      if (!authService.isReady()) {
        await authService.waitForReady(5000);
      }

      // Only load preferences if user is signed in
      if (!authService.isSignedIn()) {
        return;
      }

      // Fetch user preferences
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/ai-settings/preferences`
      );

      if (response.ok) {
        const preferences = await response.json();
        if (preferences && preferences.defaultModel) {
          // Only update the model if there's no saved model in localStorage
          // This ensures user's local preference takes precedence
          const savedModel = this.#loadSelectedModelFromStorage();

          if (!savedModel) {
            // Update the selected model only if no local preference exists
            this.#selectedModel(preferences.defaultModel);
            this.#saveSelectedModelToStorage(preferences.defaultModel);

            // Update the UI components
            this.#updateModelButton();
            this.#updateModelMenuOptions();
          }
          // If there is a saved model, we keep the current selection and don't override it
        }
      }
    } catch (error) {
      // Silently fail - use default model if preferences can't be loaded
      console.warn("Failed to load user model preferences:", error);
    }
  }

  #populateModelMenu() {
    if (!this.#modelMenu) return;

    // Clear existing content
    this.#modelMenu.innerHTML = "";

    // Create menu items
    this.#availableModels.forEach((model) => {
      const fragment = html`
        <button
          class="model-option ${model.id === this.#selectedModel()
            ? "selected"
            : ""}"
          type="button"
          role="menuitem"
          data-model-id="${model.id}"
        >
          <span class="model-option-name">${model.name}</span>
        </button>
      `;

      const button = fragment.querySelector("button") as HTMLButtonElement;

      // Insert the SVG logo at the beginning of the button
      button.insertAdjacentHTML("afterbegin", this.#getModelLogo(model.id));

      this.#modelMenu!.appendChild(button);
    });
  }

  #handleMenuClick(event: Event) {
    const target = event.target as Element;

    // Find the button element (might be clicking on SVG or span inside)
    const button = target.closest(".model-option") as HTMLButtonElement;

    if (button && button.hasAttribute("data-model-id")) {
      const modelId = button.getAttribute("data-model-id");

      if (modelId) {
        this.#selectedModel(modelId);
        this.#saveSelectedModelToStorage(modelId);
        this.#updateModelButton();
        this.#updateModelMenuOptions();
        this.#closeModelMenu();

        // Dispatch event to notify parent of model change
        this.dispatchEvent(
          new CustomEvent("model-changed", {
            detail: { model: modelId },
            bubbles: true,
            composed: true,
          })
        );
      }
    }
  }

  // Add keyboard navigation for model menu
  #handleModelMenuKeydown(event: KeyboardEvent) {
    if (!this.#isModelMenuOpen()) return;

    const options = this.#modelMenu?.querySelectorAll(
      ".model-option"
    ) as NodeListOf<HTMLButtonElement>;
    if (!options) return;

    const currentIndex = Array.from(options).findIndex(
      (option) => option === document.activeElement
    );

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        this.#closeModelMenu();
        this.#modelButton?.focus();
        break;
      case "ArrowDown":
        event.preventDefault();
        const nextIndex =
          currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        options[nextIndex].focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        const prevIndex =
          currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        options[prevIndex].focus();
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (currentIndex >= 0) {
          options[currentIndex].click();
        }
        break;
    }
  }

  // Private methods for local storage persistence
  #saveSelectedModelToStorage(modelId: string) {
    try {
      localStorage.setItem(ChatInput.#LOCAL_STORAGE_MODEL_KEY, modelId);
    } catch (error) {
      console.warn("Failed to save selected model to localStorage:", error);
    }
  }

  #loadSelectedModelFromStorage(): string | null {
    try {
      return localStorage.getItem(ChatInput.#LOCAL_STORAGE_MODEL_KEY);
    } catch (error) {
      console.warn("Failed to load selected model from localStorage:", error);
      return null;
    }
  }

  #loadModelFromStorage() {
    const savedModel = this.#loadSelectedModelFromStorage();
    if (savedModel) {
      // Validate that the saved model is still in our available models list
      const isValidModel = this.#availableModels.some(
        (model) => model.id === savedModel
      );
      if (isValidModel) {
        this.#selectedModel(savedModel);
        this.#updateModelButton();
        this.#updateModelMenuOptions();
      }
    }
  }

  // Cleanup method
  destroy() {
    document.removeEventListener("click", this.#handleClickOutside.bind(this));
    document.removeEventListener(
      "keydown",
      this.#handleModelMenuKeydown.bind(this)
    );
    this.#modelMenu?.removeEventListener(
      "click",
      this.#handleMenuClick.bind(this)
    );
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
    // Check if user is on mobile/tablet (screen width <= 1024px)
    const isMobileOrTablet = window.innerWidth <= 1024;

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      authStore.isAuthenticated() &&
      !isMobileOrTablet // Only send on Enter for desktop devices
    ) {
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

  handleModelButtonClick(event: Event) {
    event.stopPropagation();
    if (this.#isModelMenuOpen()) {
      this.#closeModelMenu();
    } else {
      this.#openModelMenu();
    }
  }

  handleModelSelect(event: Event) {
    const button = event.target as HTMLButtonElement;
    const modelId = button.getAttribute("data-model-id");

    if (modelId) {
      this.#selectedModel(modelId);
      this.#saveSelectedModelToStorage(modelId);
      this.#updateModelButton();
      this.#updateModelMenuOptions();
      this.#closeModelMenu();

      // Dispatch event to notify parent of model change
      this.dispatchEvent(
        new CustomEvent("model-changed", {
          detail: { model: modelId },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  handleSend(isVSCodeSummary = false) {
    if (
      !this.#textarea ||
      !this.#textValue().trim() ||
      this.#isLoading() ||
      !authStore.isAuthenticated()
    ) {
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
          detail: {
            message,
            model: this.#selectedModel(),
            isVSCodeSummary, // Add flag to identify VS Code summary requests
          },
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

  handleVSCodeSummary() {
    if (
      this.#isLoading() ||
      this.#isStreaming() ||
      !authStore.isAuthenticated()
    ) {
      return;
    }

    // Create the VS Code summary prompt
    const vscodePrompt = `Please provide a comprehensive summary of our conversation that will enable me to seamlessly continue this work in VS Code. Structure your response as follows:

**Context & Problem Statement:**
Clearly describe the main challenge, task, or objective we've been working on.

**Technical Details & Key Information:**
- Programming languages, frameworks, and technologies involved
- Important file names, function names, class names, or variable names mentioned
- Code snippets or architectural patterns discussed
- Configuration details, dependencies, or setup requirements
- API endpoints, database schemas, or data structures referenced

**Current State & Progress:**
- What has been successfully implemented or resolved
- What approaches have been tried and their outcomes
- Any working solutions or code that's been validated

**Immediate Next Steps:**
- Specific tasks that need to be completed next
- Files that need to be created, modified, or reviewed
- Potential challenges or edge cases to address
- Testing or validation steps required

**Important Context for Continuation:**
Any additional details, decisions made, or considerations that would be crucial for someone to understand when picking up this work.

Please be specific and actionable—this summary should allow me (or GitHub Copilot) to immediately understand the full context and continue development effectively.`;

    // Set the prompt in the textarea
    if (this.#textarea) {
      this.#textarea.value = vscodePrompt;
      this.#textValue(vscodePrompt);

      // Auto-resize the textarea
      this.#textarea.style.height = "auto";
      this.#textarea.style.height = this.#textarea.scrollHeight + "px";

      // Focus the textarea
      this.#textarea.focus();
    }

    // Automatically send the message with VS Code flag
    this.handleSend(true);
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

  focus() {
    if (this.#textarea) {
      this.#textarea.focus();
    }
  }

  getSelectedModel(): string {
    return this.#selectedModel();
  }

  setSelectedModel(model: string) {
    this.#selectedModel(model);
    this.#saveSelectedModelToStorage(model);
    this.#updateModelButton();
    this.#updateModelMenuOptions();
  }

  #getModelLogo(modelId: string): string {
    // Return different SVG logos based on the model provider
    if (modelId.startsWith("google/")) {
      return `<svg class="model-logo" height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Gemini</title><defs><linearGradient id="lobe-icons-gemini-fill" x1="0%" x2="68.73%" y1="100%" y2="30.395%"><stop offset="0%" stop-color="#1C7DFF"></stop><stop offset="52.021%" stop-color="#1C69FF"></stop><stop offset="100%" stop-color="#F0DCD6"></stop></linearGradient></defs><path d="M12 24A14.304 14.304 0 000 12 14.304 14.304 0 0012 0a14.305 14.305 0 0012 12 14.305 14.305 0 00-12 12" fill="url(#lobe-icons-gemini-fill)" fill-rule="nonzero"></path></svg>`;
    } else if (modelId.startsWith("anthropic/")) {
      return `<svg class="model-logo" fill="#ffff" fill-rule="evenodd" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Anthropic</title><path d="M13.827 3.52h3.603L24 20h-3.603l-6.57-16.48zm-7.258 0h3.767L16.906 20h-3.674l-1.343-3.461H5.017l-1.344 3.46H0L6.57 3.522zm4.132 9.959L8.453 7.687 6.205 13.48H10.7z"></path></svg>`;
    } else if (modelId.startsWith("openai/")) {
      return `<svg class="model-logo" xmlns="http://www.w3.org/2000/svg" width="256" height="260" preserveAspectRatio="xMidYMid" viewBox="0 0 256 260"><path fill="#fff" d="M239.184 106.203a64.716 64.716 0 0 0-5.576-53.103C219.452 28.459 191 15.784 163.213 21.74A65.586 65.586 0 0 0 52.096 45.22a64.716 64.716 0 0 0-43.23 31.36c-14.31 24.602-11.061 55.634 8.033 76.74a64.665 64.665 0 0 0 5.525 53.102c14.174 24.65 42.644 37.324 70.446 31.36a64.72 64.72 0 0 0 48.754 21.744c28.481.025 53.714-18.361 62.414-45.481a64.767 64.767 0 0 0 43.229-31.36c14.137-24.558 10.875-55.423-8.083-76.483Zm-97.56 136.338a48.397 48.397 0 0 1-31.105-11.255l1.535-.87 51.67-29.825a8.595 8.595 0 0 0 4.247-7.367v-72.85l21.845 12.636c.218.111.37.32.409.563v60.367c-.056 26.818-21.783 48.545-48.601 48.601Zm-104.466-44.61a48.345 48.345 0 0 1-5.781-32.589l1.534.921 51.722 29.826a8.339 8.339 0 0 0 8.441 0l63.181-36.425v25.221a.87.87 0 0 1-.358.665l-52.335 30.184c-23.257 13.398-52.97 5.431-66.404-17.803ZM23.549 85.38a48.499 48.499 0 0 1 25.58-21.333v61.39a8.288 8.288 0 0 0 4.195 7.316l62.874 36.272-21.845 12.636a.819.819 0 0 1-.767 0L41.353 151.53c-23.211-13.454-31.171-43.144-17.804-66.405v.256Zm179.466 41.695-63.08-36.63L161.73 77.86a.819.819 0 0 1 .768 0l52.233 30.184a48.6 48.6 0 0 1-7.316 87.635v-61.391a8.544 8.544 0 0 0-4.4-7.213Zm21.742-32.69-1.535-.922-51.619-30.081a8.39 8.39 0 0 0-8.492 0L99.98 99.808V74.587a.716.716 0 0 1 .307-.665l52.233-30.133a48.652 48.652 0 0 1 72.236 50.391v.205ZM88.061 139.097l-21.845-12.585a.87.87 0 0 1-.41-.614V65.685a48.652 48.652 0 0 1 79.757-37.346l-1.535.87-51.67 29.825a8.595 8.595 0 0 0-4.246 7.367l-.051 72.697Zm11.868-25.58 28.138-16.217 28.188 16.218v32.434l-28.086 16.218-28.188-16.218-.052-32.434Z"/></svg>`;
    } else if (modelId.startsWith("meta-llama/")) {
      return `<svg class="model-logo" xmlns="http://www.w3.org/2000/svg" width="256" height="171" preserveAspectRatio="xMidYMid" viewBox="0 0 256 171"><defs><linearGradient id="a" x1="13.878%" x2="89.144%" y1="55.934%" y2="58.694%"><stop offset="0%" stop-color="#0064E1"/><stop offset="40%" stop-color="#0064E1"/><stop offset="83%" stop-color="#0073EE"/><stop offset="100%" stop-color="#0082FB"/></linearGradient><linearGradient id="b" x1="54.315%" x2="54.315%" y1="82.782%" y2="39.307%"><stop offset="0%" stop-color="#0082FB"/><stop offset="100%" stop-color="#0064E0"/></linearGradient></defs><path fill="#0081FB" d="M27.651 112.136c0 9.775 2.146 17.28 4.95 21.82 3.677 5.947 9.16 8.466 14.751 8.466 7.211 0 13.808-1.79 26.52-19.372 10.185-14.092 22.186-33.874 30.26-46.275l13.675-21.01c9.499-14.591 20.493-30.811 33.1-41.806C161.196 4.985 172.298 0 183.47 0c18.758 0 36.625 10.87 50.3 31.257C248.735 53.584 256 81.707 256 110.729c0 17.253-3.4 29.93-9.187 39.946-5.591 9.686-16.488 19.363-34.818 19.363v-27.616c15.695 0 19.612-14.422 19.612-30.927 0-23.52-5.484-49.623-17.564-68.273-8.574-13.23-19.684-21.313-31.907-21.313-13.22 0-23.859 9.97-35.815 27.75-6.356 9.445-12.882 20.956-20.208 33.944l-8.066 14.289c-16.203 28.728-20.307 35.271-28.408 46.07-14.2 18.91-26.324 26.076-42.287 26.076-18.935 0-30.91-8.2-38.325-20.556C2.973 139.413 0 126.202 0 111.148l27.651.988Z"/><path fill="url(#a)" d="M21.802 33.206C34.48 13.666 52.774 0 73.757 0 85.91 0 97.99 3.597 110.605 13.897c13.798 11.261 28.505 29.805 46.853 60.368l6.58 10.967c15.881 26.459 24.917 40.07 30.205 46.49 6.802 8.243 11.565 10.7 17.752 10.7 15.695 0 19.612-14.422 19.612-30.927l24.393-.766c0 17.253-3.4 29.93-9.187 39.946-5.591 9.686-16.488 19.363-34.818 19.363-11.395 0-21.49-2.475-32.654-13.007-8.582-8.083-18.615-22.443-26.334-35.352l-22.96-38.352C118.528 64.08 107.96 49.73 101.845 43.23c-6.578-6.988-15.036-15.428-28.532-15.428-10.923 0-20.2 7.666-27.963 19.39L21.802 33.206Z"/><path fill="url(#b)" d="M73.312 27.802c-10.923 0-20.2 7.666-27.963 19.39-10.976 16.568-17.698 41.245-17.698 64.944 0 9.775 2.146 17.28 4.95 21.82L9.027 149.482C2.973 139.413 0 126.202 0 111.148 0 83.772 7.514 55.24 21.802 33.206 34.48 13.666 52.774 0 73.757 0l-.445 27.802Z"/></svg>`;
    } else if (modelId.startsWith("deepseek/")) {
      return `<svg class="model-logo" xmlns="http://www.w3.org/2000/svg" style="flex:none;line-height:1" viewBox="0 0 24 24"><path fill="#4D6BFE" d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 0 1 1.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 0 1 .415-.287.302.302 0 0 1 .2.288.306.306 0 0 1-.31.307.303.303 0 0 1-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 0 1-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 0 1 .016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 0 1-.254-.078.253.253 0 0 1-.114-.358c.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"/></svg>`;
    } else {
      // Default fallback logo
      return `<svg class="model-logo" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1L13 3V5.5L11 7.5C10.8 7.3 10.6 7.1 10.4 6.9L9 8.3C9.6 8.9 10 9.6 10 10.5V11H8V12H10V13C10 13.4 10.1 13.8 10.2 14.2L8.8 15.6C8.3 15.1 7.6 14.8 6.9 14.8C5.8 14.8 4.9 15.7 4.9 16.8C4.9 17.9 5.8 18.8 6.9 18.8C7.6 18.8 8.3 18.5 8.8 17.9L10.2 19.3C10.1 19.7 10 20.1 10 20.5C10 21.6 10.9 22.5 12 22.5C13.1 22.5 14 21.6 14 20.5C14 19.4 13.1 18.5 12 18.5C11.6 18.5 11.2 18.6 10.8 18.8L9.4 17.4C9.9 16.9 10.2 16.2 10.2 15.5V14.5H12V13.5H10.2V12.5H12V11.5H10V10.5C10 9.6 9.6 8.9 9 8.3L10.4 6.9C10.6 7.1 10.8 7.3 11 7.5L13 5.5V3L15 1L21 7V9H21Z" fill="currentColor"/></svg>`;
    }
  }
}

if (!customElements.get("chat-input")) {
  customElements.define("chat-input", ChatInput);
}
