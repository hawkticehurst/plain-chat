import { Component, config, authService } from "../lib/index";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";

export interface Message {
  role: "prompt" | "response";
  content: string;
}

export class ChatMain extends Component {
  private _messages: Array<Message> = [];
  private _loading = true;

  constructor() {
    super();
    this.loadMessages();
  }

  private async loadMessages() {
    try {
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/messages`
      );
      if (response.ok) {
        const data = await response.json();

        // Check if messages exist in the response
        if (data.messages && Array.isArray(data.messages)) {
          // Convert Convex tasks to messages format
          this._messages = data.messages.map((task: any) => ({
            role: task.role || "response",
            content: task.content || task.text || task.message || "No content",
          }));
        } else {
          console.warn(
            "No messages array found in API response, using fallback"
          );
          this._messages = [
            {
              role: "response",
              content:
                "No messages found. API response structure may have changed.",
            },
          ];
        }
      } else {
        // Fallback to sample data if not authenticated or error
        this._messages = [
          {
            role: "response",
            content: "Please sign in to view your messages.",
          },
        ];
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      // Fallback to sample data
      this._messages = [
        {
          role: "response",
          content: "Error loading messages. Please try again later.",
        },
      ];
    } finally {
      this._loading = false;
      await this.render();
    }
  }

  async render() {
    if (this._loading) {
      this.innerHTML = '<div class="loading">Loading messages...</div>';
      return;
    }

    const messages = new ChatMessages(this._messages);
    const input = new ChatInput();

    await messages.render();
    input.render();

    // Clear previous content
    this.innerHTML = "";

    this.insert(this, messages, null);
    this.insert(this, input, null);
  }
}

customElements.define("chat-main", ChatMain);
