import {
  Component,
  html,
  signal,
  effect,
  computed,
  config,
  authService,
} from "@lib";
import { notificationService } from "./NotificationComponent";
import "./ChatSettings.css";

export class ChatSettings extends Component {
  // Private reactive state using signals
  #isLoading = signal<boolean>(false);
  #isSaving = signal<boolean>(false);
  #apiKey = signal<string>("");
  #hasValidKey = signal<boolean>(false);
  #defaultModel = signal<string>("google/gemini-2.5-flash-preview-05-20");
  #systemPrompt = signal<string>("");
  #isSignedIn = signal<boolean>(false);

  // DOM references
  #apiKeyInput: HTMLInputElement | null = null;
  #systemPromptTextarea: HTMLTextAreaElement | null = null;
  #testBtn: HTMLButtonElement | null = null;
  #saveBtn: HTMLButtonElement | null = null;
  #signOutBtn: HTMLButtonElement | null = null;
  #authCheckInterval: number | null = null;

  // Computed values
  #canTestKey = computed(() => this.#apiKey().trim().length > 0);
  #canSave = computed(() => !this.#isSaving());

  init() {
    // Build the DOM structure once
    this.append(html`
      <div class="ai-settings">
        <button class="sign-out-btn" @click="handleSignOut" title="Sign Out">
          Sign Out
        </button>
        <div class="ai-settings-header">
          <h2>Settings</h2>
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
                <button type="button" class="btn" @click="testApiKey">
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
            <button type="button" class="btn" @click="saveSettings">
              Save Settings
            </button>
          </div>
        </div>
      </div>
    `);

    // Cache DOM references
    this.#apiKeyInput = this.querySelector("#api-key") as HTMLInputElement;
    this.#systemPromptTextarea = this.querySelector(
      "#system-prompt"
    ) as HTMLTextAreaElement;
    this.#testBtn = this.querySelector(".btn-test-key") as HTMLButtonElement;
    this.#saveBtn = this.querySelector(".btn-primary") as HTMLButtonElement;
    this.#signOutBtn = this.querySelector(".sign-out-btn") as HTMLButtonElement;

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
      notificationService.error(
        "Authentication service failed to initialize. Please refresh the page."
      );
      return;
    }

    // Check if user is signed in
    if (!authService.isSignedIn()) {
      notificationService.error("Please sign in to access settings.");
      return;
    }

    // Load settings
    this.#loadCurrentSettings();
  }

  #setupReactiveEffects() {
    // Update auth state periodically
    const updateAuthState = () => {
      this.#isSignedIn(authService.isSignedIn());
    };

    // Initial auth state check
    updateAuthState();

    // Set up periodic auth state checks
    const authCheckInterval = window.setInterval(updateAuthState, 1000);

    // Store interval reference for cleanup
    this.#authCheckInterval = authCheckInterval;

    // Update sign out button visibility based on auth state
    effect(() => {
      if (this.#signOutBtn) {
        this.#signOutBtn.style.display = this.#isSignedIn() ? "block" : "none";
      }
    });

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

    // Update system prompt
    effect(() => {
      if (this.#systemPromptTextarea) {
        this.#systemPromptTextarea.value = this.#systemPrompt();
      }
    });
  }

  // Event handlers
  handleApiKeyInput = (event: Event) => {
    const target = event.target as HTMLInputElement;
    this.#apiKey(target.value);
  };

  handleSystemPromptInput = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    this.#systemPrompt(target.value);
  };

  async #loadCurrentSettings() {
    try {
      this.#isLoading(true);
      notificationService.info("Loading current settings...");

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
          this.#defaultModel(
            preferences.defaultModel || "google/gemini-2.5-flash-preview-05-20"
          );
          this.#systemPrompt(preferences.systemPrompt || "");
        }
      }
    } catch (error: any) {
      notificationService.error(`Failed to load settings: ${error.message}`);
    } finally {
      this.#isLoading(false);
    }
  }

  testApiKey = async () => {
    if (!this.#apiKey().trim()) return;

    try {
      notificationService.info("Testing API key...");

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
          notificationService.success("API key is valid!");
          this.#hasValidKey(true);
        } else {
          notificationService.error(`API key invalid: ${result.error}`);
          this.#hasValidKey(false);
        }
      } else {
        const errorData = await response.json();
        notificationService.error(
          `Test failed: ${errorData.message || "Unknown error"}`
        );
        this.#hasValidKey(false);
      }
    } catch (error: any) {
      notificationService.error(`Test failed: ${error.message}`);
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
      notificationService.info("Saving settings...");

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
            defaultModel: this.#defaultModel(),
            systemPrompt: this.#systemPrompt(), // Send empty string to clear, don't convert to undefined
            enableUsageNotifications: true, // Default value
          }),
        }
      );

      if (!preferencesResponse.ok) {
        const errorData = await preferencesResponse.json();
        throw new Error(errorData.message || "Failed to save preferences");
      }

      notificationService.success("Settings saved successfully!");

      // Clear API key input for security
      if (this.#apiKeyInput) {
        this.#apiKeyInput.value = "";
      }
      this.#apiKey("");

      // Don't navigate away - stay on settings page
      // Optionally reload the current settings to reflect any server-side changes
      setTimeout(() => {
        this.#loadCurrentSettings();
      }, 1000);
    } catch (error: any) {
      notificationService.error(`Failed to save settings: ${error.message}`);
    } finally {
      this.#isSaving(false);
    }
  };

  // Cleanup method
  destroy() {
    // Clean up auth check interval
    if (this.#authCheckInterval) {
      clearInterval(this.#authCheckInterval);
      this.#authCheckInterval = null;
    }
  }

  handleSignOut = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };
}

if (!customElements.get("chat-settings")) {
  customElements.define("chat-settings", ChatSettings);
}
