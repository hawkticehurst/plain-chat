import { Component, html, signal, effect, type Message } from "@lib";
import { ChatMessage } from "@components";
import "./ChatMessages.css";

export class VirtualChatMessages extends Component {
  // Private reactive state using signals
  #messages = signal<Array<Message>>([]);
  #messagesContainer: HTMLElement | null = null;
  #scrollButton: HTMLElement | null = null;
  #virtualContainer: HTMLElement | null = null;
  #isUserScrolling = false;
  #hasInitialMessages = false;

  // Virtual scrolling properties
  #itemHeight = 120; // Approximate height per message in pixels
  #bufferSize = 10; // Number of items to render outside visible area
  #visibleStart = signal(0);
  #visibleEnd = signal(0);
  #containerHeight = 0;

  // Track rendered message components for cleanup
  #renderedMessages = new Map<number, ChatMessage>();

  constructor(initialMessages: Array<Message> = []) {
    super();
    this.#messages(initialMessages);
    this.#hasInitialMessages = initialMessages.length > 0;
  }

  init() {
    this.innerHTML = "";
    this.append(html`
      <div class="messages-container">
        <div class="virtual-container">
          <div class="virtual-spacer-top"></div>
          <div class="virtual-content"></div>
          <div class="virtual-spacer-bottom"></div>
        </div>
      </div>
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
    this.#virtualContainer = this.querySelector(
      ".virtual-content"
    ) as HTMLElement;

    // Set up scroll handling
    this.#setupScrollButton();
    this.#setupVirtualScrolling();

    // Effect to update virtual scrolling when messages change
    effect(() => {
      const messages = this.#messages();
      this.#updateVisibleRange();
      this.#renderVisibleMessages();
    });

    // Effect to render visible messages when visible range changes
    effect(() => {
      // Trigger re-render when visible range changes
      this.#visibleStart();
      this.#visibleEnd();
      this.#renderVisibleMessages();
    });
  }

  #setupVirtualScrolling() {
    if (!this.#messagesContainer) return;

    const handleScroll = () => {
      this.#updateVisibleRange();
      this.#updateScrollButton();
    };

    // Use passive listener for better performance
    this.#messagesContainer.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      this.#containerHeight = this.#messagesContainer?.clientHeight || 0;
      this.#updateVisibleRange();
    });

    resizeObserver.observe(this.#messagesContainer);

    this._addCleanup(() => {
      this.#messagesContainer?.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    });
  }

  #updateVisibleRange() {
    if (!this.#messagesContainer) return;

    const scrollTop = this.#messagesContainer.scrollTop;
    this.#containerHeight = this.#messagesContainer.clientHeight;

    const messages = this.#messages();
    const totalItems = messages.length;

    // Calculate visible range with buffer
    const visibleStart = Math.max(
      0,
      Math.floor(scrollTop / this.#itemHeight) - this.#bufferSize
    );
    const visibleCount =
      Math.ceil(this.#containerHeight / this.#itemHeight) +
      this.#bufferSize * 2;
    const visibleEnd = Math.min(totalItems, visibleStart + visibleCount);

    this.#visibleStart(visibleStart);
    this.#visibleEnd(visibleEnd);
  }

  #renderVisibleMessages() {
    if (!this.#virtualContainer) return;

    const messages = this.#messages();
    const start = this.#visibleStart();
    const end = this.#visibleEnd();

    // Calculate spacer heights
    const topSpacerHeight = start * this.#itemHeight;
    const bottomSpacerHeight = (messages.length - end) * this.#itemHeight;

    // Update spacers
    const topSpacer = this.querySelector(".virtual-spacer-top") as HTMLElement;
    const bottomSpacer = this.querySelector(
      ".virtual-spacer-bottom"
    ) as HTMLElement;

    if (topSpacer) topSpacer.style.height = `${topSpacerHeight}px`;
    if (bottomSpacer) bottomSpacer.style.height = `${bottomSpacerHeight}px`;

    // Clean up messages that are no longer visible
    for (const [index, messageComponent] of this.#renderedMessages.entries()) {
      if (index < start || index >= end) {
        messageComponent.remove();
        this.#renderedMessages.delete(index);
      }
    }

    // Render visible messages
    for (let i = start; i < end; i++) {
      if (!this.#renderedMessages.has(i) && messages[i]) {
        const message = messages[i];
        const messageComponent = new ChatMessage();

        // Set a fixed height to ensure consistent virtual scrolling
        messageComponent.style.minHeight = `${this.#itemHeight}px`;

        messageComponent.render(
          message.role,
          message.content,
          message.isLoading || false,
          message.isStreaming || false,
          message.aiMetadata
        );

        this.#renderedMessages.set(i, messageComponent);
        this.#virtualContainer.appendChild(messageComponent);
      }
    }
  }

  #updateScrollButton() {
    if (!this.#messagesContainer || !this.#scrollButton) return;

    const { scrollTop, scrollHeight, clientHeight } = this.#messagesContainer;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    this.#isUserScrolling = !isNearBottom;

    if (isNearBottom) {
      this.#scrollButton.classList.remove("visible");
    } else {
      this.#scrollButton.classList.add("visible");
    }
  }

  #setupScrollButton() {
    if (!this.#scrollButton) return;

    this.#scrollButton.addEventListener("click", () => {
      this.scrollToBottom();
    });

    this._addCleanup(() => {
      this.#scrollButton?.removeEventListener("click", this.scrollToBottom);
    });
  }

  scrollToBottom() {
    if (!this.#messagesContainer) return;

    this.#messagesContainer.scrollTo({
      top: this.#messagesContainer.scrollHeight,
      behavior: "smooth",
    });

    this.#isUserScrolling = false;
    setTimeout(() => {
      this.#scrollButton?.classList.remove("visible");
    }, 500);
  }

  public updateMessages(messages: Array<Message>) {
    this.#messages(messages);

    // Auto-scroll to bottom if user isn't manually scrolling
    if (!this.#isUserScrolling) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  public loadChatThread(messages: Array<Message>) {
    this.#messages(messages);
    setTimeout(() => this.scrollToBottom(), 150);
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

  connectedCallback() {
    super.connectedCallback();
    if (this.#hasInitialMessages) {
      setTimeout(() => this.scrollToBottom(), 200);
    }
  }

  disconnectedCallback() {
    // Clean up all rendered message components
    for (const [, messageComponent] of this.#renderedMessages) {
      messageComponent.remove();
    }
    this.#renderedMessages.clear();
    super.disconnectedCallback();
  }
}
