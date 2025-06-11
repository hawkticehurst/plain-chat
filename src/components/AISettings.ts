import { Component, html, signal, config, authService } from "../lib/index";
import type { Signal } from "../lib/index";

export class AISettings extends Component {
  private _isLoading: Signal<boolean> = signal(false, []);
  private _isSaving: Signal<boolean> = signal(false, []);
  private _apiKey: Signal<string> = signal("", []);
  private _hasValidKey: Signal<boolean> = signal(false, []);
  private _selectedModel: Signal<string> = signal(
    "google/gemini-2.5-flash-preview-05-20",
    []
  );
  private _temperature: Signal<number> = signal(0.7, []);
  private _maxTokens: Signal<number> = signal(2000, []);
  private _systemPrompt: Signal<string> = signal("", []);
  private _enableStreaming: Signal<boolean> = signal(true, []);

  private _apiKeyInput!: HTMLInputElement;
  private _modelSelect!: HTMLSelectElement;
  private _temperatureInput!: HTMLInputElement;
  private _temperatureValue!: HTMLSpanElement;
  private _maxTokensInput!: HTMLInputElement;
  private _maxTokensValue!: HTMLSpanElement;
  private _systemPromptTextarea!: HTMLTextAreaElement;
  private _streamingToggle!: HTMLInputElement;

  constructor() {
    super();
    this._initializeComponent();
  }

  private _initializeComponent() {
    const template = html`
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

          <!-- Model Selection -->
          <div class="settings-section">
            <h3>Model Configuration</h3>
            <div class="form-group">
              <label for="model-select">AI Model</label>
              <select id="model-select" class="form-select">
                <option value="google/gemini-2.5-flash-preview-05-20">
                  Gemini 2.5 Flash (Recommended)
                </option>
                <option value="openai/gpt-4">GPT-4</option>
                <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                <option value="anthropic/claude-3-sonnet">
                  Claude 3 Sonnet
                </option>
                <option value="google/gemini-pro">Gemini Pro</option>
                <option value="meta-llama/llama-3-8b-instruct">
                  Llama 3 8B
                </option>
              </select>
            </div>

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

            <div class="form-group">
              <label class="form-checkbox">
                <input type="checkbox" id="streaming" checked />
                <span class="checkmark"></span>
                Enable streaming responses
              </label>
              <p class="form-help">
                Show AI responses as they're generated (recommended)
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
    `;

    this.innerHTML = String(template);
    this._bindElements();
    this._setupEventListeners();
    this._loadCurrentSettings();
  }

  private _bindElements() {
    this._apiKeyInput = this.querySelector("#api-key") as HTMLInputElement;
    this._modelSelect = this.querySelector(
      "#model-select"
    ) as HTMLSelectElement;
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
    this._streamingToggle = this.querySelector(
      "#streaming"
    ) as HTMLInputElement;
  }

  private _setupEventListeners() {
    // API Key input and test
    this._apiKeyInput.addEventListener("input", () => {
      this._apiKey.value = this._apiKeyInput.value;
      const testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
      testBtn.disabled = !this._apiKey.value.trim();
    });

    const testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
    testBtn.addEventListener("click", () => this._testApiKey());

    // Model selection
    this._modelSelect.addEventListener("change", () => {
      this._selectedModel.value = this._modelSelect.value;
    });

    // Temperature slider
    this._temperatureInput.addEventListener("input", () => {
      this._temperature.value = parseFloat(this._temperatureInput.value);
      this._temperatureValue.textContent = this._temperature.value.toString();
    });

    // Max tokens slider
    this._maxTokensInput.addEventListener("input", () => {
      this._maxTokens.value = parseInt(this._maxTokensInput.value);
      this._maxTokensValue.textContent = this._maxTokens.value.toString();
    });

    // System prompt
    this._systemPromptTextarea.addEventListener("input", () => {
      this._systemPrompt.value = this._systemPromptTextarea.value;
    });

    // Streaming toggle
    this._streamingToggle.addEventListener("change", () => {
      this._enableStreaming.value = this._streamingToggle.checked;
    });

    // Action buttons
    const saveBtn = this.querySelector("#save-btn") as HTMLButtonElement;
    const cancelBtn = this.querySelector("#cancel-btn") as HTMLButtonElement;

    saveBtn.addEventListener("click", () => this._saveSettings());
    cancelBtn.addEventListener("click", () => this._cancel());
  }

  private async _loadCurrentSettings() {
    try {
      this._isLoading.value = true;
      this._showMessage("Loading current settings...", "info");

      // Check if user has API key
      const hasKeyResponse = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/ai/has-valid-key`
      );

      if (hasKeyResponse.ok) {
        const hasKeyData = await hasKeyResponse.json();
        this._hasValidKey.value = hasKeyData.hasValidKey || false;

        if (hasKeyData.hasValidKey) {
          // Load API key status (masked)
          const keyStatusResponse = await authService.fetchWithAuth(
            `${config.apiBaseUrl}/api/ai/key-status`
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
        `${config.apiBaseUrl}/api/ai/preferences`
      );

      if (preferencesResponse.ok) {
        const preferences = await preferencesResponse.json();
        if (preferences) {
          // Handle model name migration from old to new
          let defaultModel =
            preferences.defaultModel || "google/gemini-2.5-flash-preview-05-20";
          if (defaultModel === "google/gemini-2.0-flash-exp") {
            defaultModel = "google/gemini-2.5-flash-preview-05-20";
          }

          this._selectedModel.value = defaultModel;
          this._temperature.value = preferences.temperature || 0.7;
          this._maxTokens.value = preferences.maxTokens || 2000;
          this._systemPrompt.value = preferences.systemPrompt || "";
          this._enableStreaming.value = preferences.enableStreaming !== false;

          // Update UI
          this._modelSelect.value = this._selectedModel.value;
          this._temperatureInput.value = this._temperature.value.toString();
          this._temperatureValue.textContent =
            this._temperature.value.toString();
          this._maxTokensInput.value = this._maxTokens.value.toString();
          this._maxTokensValue.textContent = this._maxTokens.value.toString();
          this._systemPromptTextarea.value = this._systemPrompt.value;
          this._streamingToggle.checked = this._enableStreaming.value;
        } else {
          // No preferences found, set defaults
          this._modelSelect.value = this._selectedModel.value;
          this._temperatureInput.value = this._temperature.value.toString();
          this._temperatureValue.textContent =
            this._temperature.value.toString();
          this._maxTokensInput.value = this._maxTokens.value.toString();
          this._maxTokensValue.textContent = this._maxTokens.value.toString();
          this._systemPromptTextarea.value = this._systemPrompt.value;
          this._streamingToggle.checked = this._enableStreaming.value;
        }
      } else {
        // Failed to load preferences, set defaults
        this._modelSelect.value = this._selectedModel.value;
        this._temperatureInput.value = this._temperature.value.toString();
        this._temperatureValue.textContent = this._temperature.value.toString();
        this._maxTokensInput.value = this._maxTokens.value.toString();
        this._maxTokensValue.textContent = this._maxTokens.value.toString();
        this._systemPromptTextarea.value = this._systemPrompt.value;
        this._streamingToggle.checked = this._enableStreaming.value;
      }

      this._clearMessages();
    } catch (error: any) {
      this._showMessage(`Failed to load settings: ${error.message}`, "error");
    } finally {
      this._isLoading.value = false;
    }
  }

  private async _testApiKey() {
    if (!this._apiKey.value.trim()) return;

    try {
      this._showMessage("Testing API key...", "info");
      const testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
      testBtn.disabled = true;
      testBtn.textContent = "Testing...";

      // Test the API key using the server endpoint
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/ai/test-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apiKey: this._apiKey.value,
          }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.valid) {
          this._showMessage("API key is valid!", "success");
          this._hasValidKey.value = true;
        } else {
          this._showMessage(`API key invalid: ${result.error}`, "error");
          this._hasValidKey.value = false;
        }
      } else {
        const errorData = await response.json();
        this._showMessage(
          `Test failed: ${errorData.message || "Unknown error"}`,
          "error"
        );
        this._hasValidKey.value = false;
      }
    } catch (error: any) {
      this._showMessage(`Test failed: ${error.message}`, "error");
      this._hasValidKey.value = false;
    } finally {
      const testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
      testBtn.disabled = false;
      testBtn.textContent = "Test Key";
    }
  }

  private async _saveSettings() {
    try {
      this._isSaving.value = true;
      this._showMessage("Saving settings...", "info");

      // Save API key if provided
      if (this._apiKey.value.trim()) {
        const keyResponse = await authService.fetchWithAuth(
          `${config.apiBaseUrl}/api/ai/set-key`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              apiKey: this._apiKey.value,
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
        `${config.apiBaseUrl}/api/ai/preferences`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            defaultModel: this._selectedModel.value,
            temperature: this._temperature.value,
            maxTokens: this._maxTokens.value,
            systemPrompt: this._systemPrompt.value || undefined,
            enableStreaming: this._enableStreaming.value,
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
      this._apiKey.value = "";

      // Navigate back after a short delay
      setTimeout(() => {
        window.location.hash = "#/";
      }, 1500);
    } catch (error: any) {
      this._showMessage(`Failed to save settings: ${error.message}`, "error");
    } finally {
      this._isSaving.value = false;
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
