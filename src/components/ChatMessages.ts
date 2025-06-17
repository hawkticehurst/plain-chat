import { Component, html, signal, effect, reconcile, type Message } from "@lib";
import { ChatMessage } from "@components";
import "./ChatMessages.css";

export class ChatMessages extends Component {
  // Private reactive state using signals
  #messages = signal<Array<Message>>([]);
  #messagesContainer: HTMLElement | null = null;
  #messageNodes = new Map<string, Element>();

  constructor(initialMessages: Array<Message> = []) {
    super();
    this.#messages(initialMessages);
  }

  init() {
    this.innerHTML = "";
    this.append(html`
      <div class="messages-container"></div>
    `);

    // Cache DOM references
    this.#messagesContainer = this.querySelector(
      ".messages-container"
    ) as HTMLElement;

    effect(() => {
      if (!this.#messagesContainer) return;
  
      const messages = this.#messages();
  
      // Use reconcile to efficiently update the DOM
      this.#messageNodes = reconcile(
        this.#messagesContainer,
        this.#messageNodes,
        messages,
        // Key function: create unique key for each message
        (message) =>
          `${message.timestamp || Date.now()}-${message.role}-${message.content.slice(0, 50)}`,
        // Create function: create new ChatMessage component
        (message) => {
          const messageComponent = new ChatMessage();
          // Initialize the component and render immediately
          messageComponent.render(
            message.role,
            message.content,
            message.isLoading || false,
            message.isStreaming || false
          );
          return messageComponent;
        },
        // Update function: update existing ChatMessage component
        async (node, message) => {
          const messageComponent = node as ChatMessage;
          await messageComponent.render(
            message.role,
            message.content,
            message.isLoading || false,
            message.isStreaming || false
          );
        }
      );
  
      // Auto-scroll to bottom after message updates
      this.#scrollToBottom();
    });
  }

  #scrollToBottom() {
    if (this.#messagesContainer) {
      // Use requestAnimationFrame to ensure DOM updates are complete
      requestAnimationFrame(() => {
        if (this.#messagesContainer) {
          this.#messagesContainer.scrollTop =
            this.#messagesContainer.scrollHeight;
        }
      });
    }
  }

  public updateMessages(messages: Array<Message>) {
    this.#messages(messages);
  }

  public addMessage(message: Message) {
    const currentMessages = this.#messages();
    this.#messages([...currentMessages, message]);
  }

  public updateLastMessage(message: Message) {
    const currentMessages = this.#messages();
    if (currentMessages.length > 0) {
      const newMessages = [...currentMessages];
      newMessages[newMessages.length - 1] = message;
      this.#messages(newMessages);
    }
  }
}

if (!customElements.get("chat-messages")) {
  customElements.define("chat-messages", ChatMessages);
}
