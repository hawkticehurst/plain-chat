import {
  Component,
  html,
  signal,
  effect,
  computed,
  config,
  authService,
} from "@lib";
import "./ChatSettings.css";

export class ChatSettings extends Component {
  // Private reactive state using signals
  #isLoading = signal<boolean>(false);
  #isSaving = signal<boolean>(false);
  #apiKey = signal<string>("");
  #hasValidKey = signal<boolean>(false);
  #temperature = signal<number>(0.7);
  #maxTokens = signal<number>(2000);
  #systemPrompt = signal<string>("");
  #message = signal<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  // DOM references
  #apiKeyInput: HTMLInputElement | null = null;
  #temperatureInput: HTMLInputElement | null = null;
  #temperatureValue: HTMLSpanElement | null = null;
  #maxTokensInput: HTMLInputElement | null = null;
  #maxTokensValue: HTMLSpanElement | null = null;
  #systemPromptTextarea: HTMLTextAreaElement | null = null;
  #testBtn: HTMLButtonElement | null = null;
  #saveBtn: HTMLButtonElement | null = null;
  #errorElement: HTMLElement | null = null;
  #successElement: HTMLElement | null = null;

  // Computed values
  #canTestKey = computed(() => this.#apiKey().trim().length > 0);
  #canSave = computed(() => !this.#isSaving());

  init() {
    // Build the DOM structure once
    this.append(html`
      <div class="ai-settings">
        <div class="ai-settings-header">
          <h2>AI Settings</h2>
          <p class="ai-settings-description">
            Configure your AI preferences and API settings
          </p>
        </div>

        <div class="ai-settings-content">
          <!-- API Key Section -->
          <div class="settings-section">
            <h3>API Configuration</h3>
            <div class="form-group">
              <label for="api-key">OpenRouter API Key</label>
              <div class="api-key-container">
                <input
                  type="password"
                  id="api-key"
                  class="form-input"
                  placeholder="sk-or-..."
                  autocomplete="off"
                  @input="handleApiKeyInput"
                />
                <button type="button" class="btn-test-key" @click="testApiKey">
                  Test Key
                </button>
              </div>
              <p class="form-help">
                Your API key is encrypted and stored securely. Get one at
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener"
                  >openrouter.ai</a
                >
              </p>
            </div>
          </div>

          <!-- Model Configuration -->
          <div class="settings-section">
            <h3>Model Configuration</h3>
            <div class="form-group">
              <label for="temperature">
                Temperature: <span class="temperature-value"></span>
              </label>
              <input
                type="range"
                id="temperature"
                class="form-range"
                min="0"
                max="2"
                step="0.1"
                @input="handleTemperatureInput"
              />
              <p class="form-help">
                Controls randomness. Lower = more focused, Higher = more
                creative
              </p>
            </div>

            <div class="form-group">
              <label for="max-tokens">
                Max Tokens: <span class="max-tokens-value"></span>
              </label>
              <input
                type="range"
                id="max-tokens"
                class="form-range"
                min="100"
                max="4000"
                step="100"
                @input="handleMaxTokensInput"
              />
              <p class="form-help">Maximum length of AI responses</p>
            </div>
          </div>

          <!-- Advanced Settings -->
          <div class="settings-section">
            <h3>Advanced Settings</h3>
            <div class="form-group">
              <label for="system-prompt">System Prompt (Optional)</label>
              <textarea
                id="system-prompt"
                class="form-textarea"
                rows="4"
                placeholder="Set the AI's behavior and personality..."
                @input="handleSystemPromptInput"
              ></textarea>
              <p class="form-help">
                Instructions that guide the AI's responses across the
                conversation
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="settings-actions">
            <button type="button" class="btn btn-secondary" @click="cancel">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" @click="saveSettings">
              Save Settings
            </button>
          </div>

          <!-- Status Messages -->
          <div class="status-messages">
            <div class="error-message" style="display: none;"></div>
            <div class="success-message" style="display: none;"></div>
          </div>
        </div>
      </div>
    `);

    // Cache DOM references
    this.#apiKeyInput = this.querySelector("#api-key") as HTMLInputElement;
    this.#temperatureInput = this.querySelector(
      "#temperature"
    ) as HTMLInputElement;
    this.#temperatureValue = this.querySelector(
      ".temperature-value"
    ) as HTMLSpanElement;
    this.#maxTokensInput = this.querySelector(
      "#max-tokens"
    ) as HTMLInputElement;
    this.#maxTokensValue = this.querySelector(
      ".max-tokens-value"
    ) as HTMLSpanElement;
    this.#systemPromptTextarea = this.querySelector(
      "#system-prompt"
    ) as HTMLTextAreaElement;
    this.#testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
    this.#saveBtn = this.querySelector(".btn-primary") as HTMLButtonElement;
    this.#errorElement = this.querySelector(".error-message") as HTMLElement;
    this.#successElement = this.querySelector(
      ".success-message"
    ) as HTMLElement;

    // Wire up reactive effects
    this.#setupReactiveEffects();

    // Load initial data after auth is ready
    this.#loadInitialData();
  }

  async #loadInitialData() {
    // If auth is already ready, load immediately
    if (authService.isReady() && authService.isSignedIn()) {
      this.#loadCurrentSettings();
      return;
    }

    // Wait for auth service to be ready
    const isReady = await authService.waitForReady(10000);
    if (!isReady) {
      this.#message({
        text: "Authentication service failed to initialize. Please refresh the page.",
        type: "error",
      });
      return;
    }

    // Check if user is signed in
    if (!authService.isSignedIn()) {
      this.#message({
        text: "Please sign in to access settings.",
        type: "error",
      });
      return;
    }

    // Load settings
    this.#loadCurrentSettings();
  }

  #setupReactiveEffects() {
    // Update test button state
    effect(() => {
      if (this.#testBtn) {
        this.#testBtn.disabled = !this.#canTestKey();
      }
    });

    // Update save button state
    effect(() => {
      if (this.#saveBtn) {
        this.#saveBtn.disabled = !this.#canSave();
        this.#saveBtn.textContent = this.#isSaving()
          ? "Saving..."
          : "Save Settings";
      }
    });

    // Update temperature display
    effect(() => {
      if (this.#temperatureValue && this.#temperatureInput) {
        const temp = this.#temperature();
        this.#temperatureValue.textContent = temp.toString();
        this.#temperatureInput.value = temp.toString();
      }
    });

    // Update max tokens display
    effect(() => {
      if (this.#maxTokensValue && this.#maxTokensInput) {
        const tokens = this.#maxTokens();
        this.#maxTokensValue.textContent = tokens.toString();
        this.#maxTokensInput.value = tokens.toString();
      }
    });

    // Update system prompt
    effect(() => {
      if (this.#systemPromptTextarea) {
        this.#systemPromptTextarea.value = this.#systemPrompt();
      }
    });

    // Handle status messages
    effect(() => {
      const message = this.#message();
      this.#updateStatusMessages(message);
    });
  }

  #updateStatusMessages(
    message: { text: string; type: "success" | "error" | "info" } | null
  ) {
    if (!this.#errorElement || !this.#successElement) return;

    // Clear all messages first
    this.#errorElement.style.display = "none";
    this.#successElement.style.display = "none";
    this.#successElement.style.backgroundColor = "";

    if (!message) return;

    if (message.type === "error") {
      this.#errorElement.textContent = message.text;
      this.#errorElement.style.display = "block";
    } else if (message.type === "success") {
      this.#successElement.textContent = message.text;
      this.#successElement.style.display = "block";
    } else {
      // Info messages use success styling with different color
      this.#successElement.textContent = message.text;
      this.#successElement.style.display = "block";
      this.#successElement.style.backgroundColor = "var(--color-info)";
    }
  }

  // Event handlers
  handleApiKeyInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    this.#apiKey(target.value);
  };

  handleTemperatureInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    this.#temperature(parseFloat(target.value));
  };

  handleMaxTokensInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    this.#maxTokens(parseInt(target.value));
  };

  handleSystemPromptInput = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    this.#systemPrompt(target.value);
  };

  async #loadCurrentSettings() {
    try {
      this.#isLoading(true);
      this.#message({ text: "Loading current settings...", type: "info" });

      // Check if user has API key
      const hasKeyResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/ai-settings/has-valid-key`
      );

      if (hasKeyResponse.ok) {
        const hasKeyData = await hasKeyResponse.json();
        this.#hasValidKey(hasKeyData.hasValidKey || false);

        if (hasKeyData.hasValidKey && this.#apiKeyInput) {
          // Load API key status (masked)
          const keyStatusResponse = await authService.fetchWithAuth(
            `${config.apiBaseUrl}/ai-settings/key-status`
          );

          if (keyStatusResponse.ok) {
            const keyStatus = await keyStatusResponse.json();
            if (keyStatus && keyStatus.keyHash) {
              this.#apiKeyInput.placeholder = `Key ending in ${keyStatus.keyHash.slice(-4)}`;
            }
          }
        }
      }

      // Load user preferences
      const preferencesResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/ai-settings/preferences`
      );

      if (preferencesResponse.ok) {
        const preferences = await preferencesResponse.json();
        if (preferences) {
          this.#temperature(preferences.temperature || 0.7);
          this.#maxTokens(preferences.maxTokens || 2000);
          this.#systemPrompt(preferences.systemPrompt || "");
        }
      }

      this.#message(null);
    } catch (error: any) {
      this.#message({
        text: `Failed to load settings: ${error.message}`,
        type: "error",
      });
    } finally {
      this.#isLoading(false);
    }
  }

  testApiKey = async () => {
    if (!this.#apiKey().trim()) return;

    try {
      this.#message({ text: "Testing API key...", type: "info" });

      if (this.#testBtn) {
        this.#testBtn.disabled = true;
        this.#testBtn.textContent = "Testing...";
      }

      // Test the API key using the server endpoint
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/ai-settings/test-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: this.#apiKey(),
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.valid) {
          this.#message({ text: "API key is valid!", type: "success" });
          this.#hasValidKey(true);
        } else {
          this.#message({
            text: `API key invalid: ${result.error}`,
            type: "error",
          });
          this.#hasValidKey(false);
        }
      } else {
        const errorData = await response.json();
        this.#message({
          text: `Test failed: ${errorData.message || "Unknown error"}`,
          type: "error",
        });
        this.#hasValidKey(false);
      }
    } catch (error: any) {
      this.#message({ text: `Test failed: ${error.message}`, type: "error" });
      this.#hasValidKey(false);
    } finally {
      if (this.#testBtn) {
        this.#testBtn.disabled = false;
        this.#testBtn.textContent = "Test Key";
      }
    }
  };

  saveSettings = async () => {
    try {
      this.#isSaving(true);
      this.#message({ text: "Saving settings...", type: "info" });

      // Save API key if provided
      if (this.#apiKey().trim()) {
        const keyResponse = await authService.fetchWithAuth(
          `${config.apiBaseUrl}/ai-settings/set-key`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              apiKey: this.#apiKey(),
            }),
          }
        );

        if (!keyResponse.ok) {
          const errorData = await keyResponse.json();
          throw new Error(errorData.message || "Failed to save API key");
        }
      }

      // Save preferences
      const preferencesResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/ai-settings/preferences`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            temperature: this.#temperature(),
            maxTokens: this.#maxTokens(),
            systemPrompt: this.#systemPrompt() || undefined,
            enableUsageNotifications: true, // Default value
          }),
        }
      );

      if (!preferencesResponse.ok) {
        const errorData = await preferencesResponse.json();
        throw new Error(errorData.message || "Failed to save preferences");
      }

      this.#message({ text: "Settings saved successfully!", type: "success" });

      // Clear API key input for security
      if (this.#apiKeyInput) {
        this.#apiKeyInput.value = "";
      }
      this.#apiKey("");

      // Navigate back after a short delay
      setTimeout(() => {
        window.location.hash = "#/";
      }, 1500);
    } catch (error: any) {
      this.#message({
        text: `Failed to save settings: ${error.message}`,
        type: "error",
      });
    } finally {
      this.#isSaving(false);
    }
  };

  cancel = () => {
    window.location.hash = "#/";
  };
}

if (!customElements.get("chat-settings")) {
  customElements.define("chat-settings", ChatSettings);
}
