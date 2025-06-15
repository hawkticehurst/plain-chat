import { Component, html, signal, config, authService } from "@lib";
import type { Signal } from "@lib";

export class AISettings extends Component {
  private _isLoading: Signal<boolean> = signal(false);
  private _isSaving: Signal<boolean> = signal(false);
  private _apiKey: Signal<string> = signal("");
  private _hasValidKey: Signal<boolean> = signal(false);
  private _temperature: Signal<number> = signal(0.7);
  private _maxTokens: Signal<number> = signal(2000);
  private _systemPrompt: Signal<string> = signal("");

  private _apiKeyInput!: HTMLInputElement;
  private _temperatureInput!: HTMLInputElement;
  private _temperatureValue!: HTMLSpanElement;
  private _maxTokensInput!: HTMLInputElement;
  private _maxTokensValue!: HTMLSpanElement;
  private _systemPromptTextarea!: HTMLTextAreaElement;

  constructor() {
    super();
    this._initializeComponent();
  }

  private _initializeComponent() {
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
                />
                <button type="button" class="btn-test-key" disabled>
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
                Temperature: <span class="temperature-value">0.7</span>
              </label>
              <input
                type="range"
                id="temperature"
                class="form-range"
                min="0"
                max="2"
                step="0.1"
                value="0.7"
              />
              <p class="form-help">
                Controls randomness. Lower = more focused, Higher = more
                creative
              </p>
            </div>

            <div class="form-group">
              <label for="max-tokens">
                Max Tokens: <span class="max-tokens-value">2000</span>
              </label>
              <input
                type="range"
                id="max-tokens"
                class="form-range"
                min="100"
                max="4000"
                step="100"
                value="2000"
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
              ></textarea>
              <p class="form-help">
                Instructions that guide the AI's responses across the
                conversation
              </p>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="settings-actions">
            <button type="button" class="btn btn-secondary" id="cancel-btn">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" id="save-btn">
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

    this._bindElements();
    this._setupEventListeners();
    this._loadCurrentSettings();
  }

  private _bindElements() {
    this._apiKeyInput = this.querySelector("#api-key") as HTMLInputElement;
    this._temperatureInput = this.querySelector(
      "#temperature"
    ) as HTMLInputElement;
    this._temperatureValue = this.querySelector(
      ".temperature-value"
    ) as HTMLSpanElement;
    this._maxTokensInput = this.querySelector(
      "#max-tokens"
    ) as HTMLInputElement;
    this._maxTokensValue = this.querySelector(
      ".max-tokens-value"
    ) as HTMLSpanElement;
    this._systemPromptTextarea = this.querySelector(
      "#system-prompt"
    ) as HTMLTextAreaElement;
  }

  private _setupEventListeners() {
    // API Key input and test
    this._apiKeyInput.addEventListener("input", () => {
      this._apiKey(this._apiKeyInput.value);
      const testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
      testBtn.disabled = !this._apiKey().trim();
    });

    const testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
    testBtn.addEventListener("click", () => this._testApiKey());

    // Temperature slider
    this._temperatureInput.addEventListener("input", () => {
      this._temperature(parseFloat(this._temperatureInput.value));
      this._temperatureValue.textContent = this._temperature().toString();
    });

    // Max tokens slider
    this._maxTokensInput.addEventListener("input", () => {
      this._maxTokens(parseInt(this._maxTokensInput.value));
      this._maxTokensValue.textContent = this._maxTokens().toString();
    });

    // System prompt
    this._systemPromptTextarea.addEventListener("input", () => {
      this._systemPrompt(this._systemPromptTextarea.value);
    });

    // Action buttons
    const saveBtn = this.querySelector("#save-btn") as HTMLButtonElement;
    const cancelBtn = this.querySelector("#cancel-btn") as HTMLButtonElement;

    saveBtn.addEventListener("click", () => this._saveSettings());
    cancelBtn.addEventListener("click", () => this._cancel());
  }

  private async _loadCurrentSettings() {
    try {
      this._isLoading(true);
      this._showMessage("Loading current settings...", "info");

      // Check if user has API key
      const hasKeyResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/ai-settings/has-valid-key`
      );

      if (hasKeyResponse.ok) {
        const hasKeyData = await hasKeyResponse.json();
        this._hasValidKey(hasKeyData.hasValidKey || false);

        if (hasKeyData.hasValidKey) {
          // Load API key status (masked)
          const keyStatusResponse = await authService.fetchWithAuth(
            `${config.apiBaseUrl}/ai-settings/key-status`
          );

          if (keyStatusResponse.ok) {
            const keyStatus = await keyStatusResponse.json();
            if (keyStatus && keyStatus.keyHash) {
              this._apiKeyInput.placeholder = `Key ending in ${keyStatus.keyHash.slice(-4)}`;
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
          this._temperature(preferences.temperature || 0.7);
          this._maxTokens(preferences.maxTokens || 2000);
          this._systemPrompt(preferences.systemPrompt || "");

          // Update UI
          this._temperatureInput.value = this._temperature().toString();
          this._temperatureValue.textContent =
            this._temperature().toString();
          this._maxTokensInput.value = this._maxTokens().toString();
          this._maxTokensValue.textContent = this._maxTokens().toString();
          this._systemPromptTextarea.value = this._systemPrompt();
        } else {
          // No preferences found, set defaults
          this._temperatureInput.value = this._temperature().toString();
          this._temperatureValue.textContent =
            this._temperature().toString();
          this._maxTokensInput.value = this._maxTokens().toString();
          this._maxTokensValue.textContent = this._maxTokens().toString();
          this._systemPromptTextarea.value = this._systemPrompt();
        }
      } else {
        // Failed to load preferences, set defaults
        this._temperatureInput.value = this._temperature().toString();
        this._temperatureValue.textContent = this._temperature().toString();
        this._maxTokensInput.value = this._maxTokens().toString();
        this._maxTokensValue.textContent = this._maxTokens().toString();
        this._systemPromptTextarea.value = this._systemPrompt();
      }

      this._clearMessages();
    } catch (error: any) {
      this._showMessage(`Failed to load settings: ${error.message}`, "error");
    } finally {
      this._isLoading(false);
    }
  }

  private async _testApiKey() {
    if (!this._apiKey().trim()) return;

    try {
      this._showMessage("Testing API key...", "info");
      const testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
      testBtn.disabled = true;
      testBtn.textContent = "Testing...";

      // Test the API key using the server endpoint
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/ai-settings/test-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: this._apiKey(),
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.valid) {
          this._showMessage("API key is valid!", "success");
          this._hasValidKey(true);
        } else {
          this._showMessage(`API key invalid: ${result.error}`, "error");
          this._hasValidKey(false);
        }
      } else {
        const errorData = await response.json();
        this._showMessage(
          `Test failed: ${errorData.message || "Unknown error"}`,
          "error"
        );
        this._hasValidKey(false);
      }
    } catch (error: any) {
      this._showMessage(`Test failed: ${error.message}`, "error");
      this._hasValidKey(false);
    } finally {
      const testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
      testBtn.disabled = false;
      testBtn.textContent = "Test Key";
    }
  }

  private async _saveSettings() {
    try {
      this._isSaving(true);
      this._showMessage("Saving settings...", "info");

      // Save API key if provided
      if (this._apiKey().trim()) {
        const keyResponse = await authService.fetchWithAuth(
          `${config.apiBaseUrl}/ai-settings/set-key`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              apiKey: this._apiKey(),
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
            temperature: this._temperature(),
            maxTokens: this._maxTokens(),
            systemPrompt: this._systemPrompt() || undefined,
            enableUsageNotifications: true, // Default value
          }),
        }
      );

      if (!preferencesResponse.ok) {
        const errorData = await preferencesResponse.json();
        throw new Error(errorData.message || "Failed to save preferences");
      }

      this._showMessage("Settings saved successfully!", "success");

      // Clear API key input for security
      this._apiKeyInput.value = "";
      this._apiKey("");

      // Navigate back after a short delay
      setTimeout(() => {
        window.location.hash = "#/";
      }, 1500);
    } catch (error: any) {
      this._showMessage(`Failed to save settings: ${error.message}`, "error");
    } finally {
      this._isSaving(false);
    }
  }

  private _cancel() {
    window.location.hash = "#/";
  }

  private _showMessage(message: string, type: "success" | "error" | "info") {
    this._clearMessages();

    const errorEl = this.querySelector(".error-message") as HTMLElement;
    const successEl = this.querySelector(".success-message") as HTMLElement;

    if (type === "error") {
      errorEl.textContent = message;
      errorEl.style.display = "block";
    } else if (type === "success") {
      successEl.textContent = message;
      successEl.style.display = "block";
    } else {
      // Info messages can use success styling
      successEl.textContent = message;
      successEl.style.display = "block";
      successEl.style.backgroundColor = "var(--color-info)";
    }
  }

  private _clearMessages() {
    const errorEl = this.querySelector(".error-message") as HTMLElement;
    const successEl = this.querySelector(".success-message") as HTMLElement;

    errorEl.style.display = "none";
    successEl.style.display = "none";
    successEl.style.backgroundColor = ""; // Reset to default
  }
}

if (!customElements.get("ai-settings")) {
  customElements.define("ai-settings", AISettings);
}
