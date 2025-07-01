import { Component, html, signal, effect, reconcile, type Message } from "@lib";
import { ChatMessage } from "@components";
import "./ChatMessages.css";

export class ChatMessages extends Component {
  // Private reactive state using signals
  #messages = signal<Array<Message>>([]);
  #messagesContainer: HTMLElement | null = null;
  #scrollButton: HTMLElement | null = null;
  #messageNodes = new Map<string, Element>();
  #isUserScrolling = false;
  #hasInitialMessages = false;

  constructor(initialMessages: Array<Message> = []) {
    super();
    this.#messages(initialMessages);
    this.#hasInitialMessages = initialMessages.length > 0;
  }

  init() {
    this.innerHTML = "";
    this.append(html`
      <div class="messages-container"></div>
      <button class="scroll-to-bottom-button" title="Scroll to bottom">
        ↓
      </button>
    `);

    // Cache DOM references
    this.#messagesContainer = this.querySelector(
      ".messages-container"
    ) as HTMLElement;
    this.#scrollButton = this.querySelector(
      ".scroll-to-bottom-button"
    ) as HTMLElement;

    // Set up scroll button functionality
    this.#setupScrollButton();

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
            message.isStreaming || false,
            message.aiMetadata
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
            message.isStreaming || false,
            message.aiMetadata
          );
        }
      );

      // Auto-scroll to bottom after message updates
      if (!this.#isUserScrolling) {
        this.scrollToBottom();
      }

      // Handle initial scroll for messages loaded in constructor
      if (this.#hasInitialMessages) {
        this.#hasInitialMessages = false;
        this.#scrollToBottomWithDelay();
      }
    });
  }

  #scrollToBottomWithDelay() {
    // Use a small delay to ensure DOM is fully rendered
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  #setupScrollButton() {
    if (!this.#messagesContainer || !this.#scrollButton) return;

    // Handle scroll button click
    this.#scrollButton.addEventListener("click", () => {
      this.#scrollToBottomSmooth();
    });

    // Show/hide scroll button based on scroll position
    this.#messagesContainer.addEventListener("scroll", () => {
      if (!this.#messagesContainer || !this.#scrollButton) return;

      const { scrollTop, scrollHeight, clientHeight } = this.#messagesContainer;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

      // Track if user is manually scrolling (not at bottom)
      this.#isUserScrolling = !isNearBottom;

      // Show button when user has scrolled up from bottom
      if (isNearBottom) {
        this.#scrollButton.classList.remove("visible");
      } else {
        this.#scrollButton.classList.add("visible");
      }
    });

    // Clean up event listeners on disconnect
    this._addCleanup(() => {
      this.#scrollButton?.removeEventListener(
        "click",
        this.#scrollToBottomSmooth
      );
    });
  }

  scrollToBottom() {
    this.#scrollToBottomSmooth();
  }

  #scrollToBottomSmooth() {
    if (!this.#messagesContainer) return;

    const container = this.#messagesContainer;
    const { scrollHeight, clientHeight } = container;

    // Only scroll if there's content to scroll
    if (scrollHeight > clientHeight) {
      // Use smooth scrolling
      container.scrollTo({
        top: scrollHeight,
        behavior: "smooth",
      });

      // Reset user scrolling flag when programmatically scrolling
      this.#isUserScrolling = false;

      // Hide scroll button after animation completes
      setTimeout(() => {
        this.#scrollButton?.classList.remove("visible");
      }, 500);
    }
  }

  public updateMessages(messages: Array<Message>) {
    this.#messages(messages);
  }

  public loadChatThread(messages: Array<Message>) {
    this.#messages(messages);
    // Scroll to bottom with a delay for new chat threads
    setTimeout(() => {
      this.scrollToBottom();
    }, 150);
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

  public scrollToBottomSmooth() {
    this.#scrollToBottomSmooth();
  }

  connectedCallback() {
    super.connectedCallback();
    // Auto-scroll on connection if we have initial messages
    if (this.#hasInitialMessages) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 200);
    }
  }
}

if (!customElements.get("chat-messages")) {
  customElements.define("chat-messages", ChatMessages);
}
