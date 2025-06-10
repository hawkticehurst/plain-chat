import { Component, config, authService } from "../lib/index";
import { ChatInput } from "./ChatInput";
import { ChatMessages } from "./ChatMessages";

export interface Message {
  role: "prompt" | "response";
  content: string;
  timestamp?: number;
  isLoading?: boolean;
}

export class ChatMain extends Component {
  private _messages: Array<Message> = [];
  private _loading = true;
  private _chatInput: ChatInput | null = null;
  private _chatMessages: ChatMessages | null = null;

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
            "No messages array found in API response, using welcome message"
          );
          this._messages = [
            {
              role: "response",
              content: "👋 Welcome to your AI chat assistant! Start a conversation by typing a message below. Configure your AI settings in the sidebar to customize your experience.",
              timestamp: Date.now(),
            },
          ];
        }
      } else {
        // Fallback to welcome message if not authenticated or error
        this._messages = [
          {
            role: "response",
            content: "👋 Welcome to your AI chat assistant! In demo mode, you'll get simulated responses. Sign in and configure your API key in Settings for real AI conversations.",
            timestamp: Date.now(),
          },
        ];
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      // Fallback to sample data
      this._messages = [
        {
          role: "response",
          content: "❌ Unable to load messages. Please check your connection and try refreshing the page.",
          timestamp: Date.now(),
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

    this._chatMessages = new ChatMessages(this._messages);
    this._chatInput = new ChatInput();

    await this._chatMessages.render();
    this._chatInput.render();

    // Clear previous content
    this.innerHTML = "";

    this.insert(this, this._chatMessages, null);
    this.insert(this, this._chatInput, null);

    // Listen for send-message events from ChatInput
    this._chatInput.addEventListener("send-message", this._handleSendMessage.bind(this));
  }

  private async _handleSendMessage(event: Event) {
    const customEvent = event as CustomEvent;
    const { message } = customEvent.detail;
    
    // Add user message to conversation
    const userMessage: Message = {
      role: "prompt",
      content: message,
      timestamp: Date.now(),
    };
    
    this._messages.push(userMessage);
    
    // Add loading message for AI response
    const loadingMessage: Message = {
      role: "response",
      content: "Thinking...",
      timestamp: Date.now(),
      isLoading: true,
    };
    
    this._messages.push(loadingMessage);
    
    // Re-render to show the messages
    await this._updateMessages();
    
    try {
      // Send request to AI API
      const response = await authService.fetchWithAuth(
        `${config.apiBaseUrl}/api/ai/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            conversation: this._messages.slice(-10).filter(m => !m.isLoading), // Send last 10 non-loading messages
          }),
        }
      );

      // Remove loading message
      this._messages.pop();

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Add AI response
          const aiMessage: Message = {
            role: "response",
            content: data.response,
            timestamp: Date.now(),
          };
          
          this._messages.push(aiMessage);
        } else {
          // Add error message
          const errorMessage: Message = {
            role: "response",
            content: `❌ Error: ${data.error}`,
            timestamp: Date.now(),
          };
          
          this._messages.push(errorMessage);
        }
      } else {
        // Add error message for HTTP errors
        const errorMessage: Message = {
          role: "response",
          content: `❌ Failed to send message. Please try again.`,
          timestamp: Date.now(),
        };
        
        this._messages.push(errorMessage);
      }
    } catch (error) {
      // Remove loading message if still there
      if (this._messages[this._messages.length - 1]?.isLoading) {
        this._messages.pop();
      }
      
      // Add error message
      const errorMessage: Message = {
        role: "response",
        content: `❌ Network error. Please check your connection and try again.`,
        timestamp: Date.now(),
      };
      
      this._messages.push(errorMessage);
    }
    
    // Re-render with final messages and enable input
    await this._updateMessages();
    if (this._chatInput) {
      this._chatInput.messageProcessed();
    }
  }

  private async _updateMessages() {
    if (this._chatMessages) {
      this._chatMessages.updateMessages(this._messages);
      await this._chatMessages.render();
    }
  }
}

if (!customElements.get('chat-main')) {
  customElements.define("chat-main", ChatMain);
}
