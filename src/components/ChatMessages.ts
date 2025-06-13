import { Component, type Message } from "@lib";
import { ChatMessage } from "@components";

export class ChatMessages extends Component {
  private _messages: Array<Message> = [];
  private _renderedCount = 0;

  constructor(messages: Array<Message>) {
    super();
    this._messages = messages;
  }

  public updateMessages(messages: Array<Message>) {
    this._messages = messages;
  }

  async render() {
    // Optimization: Only render new messages, not all messages from scratch
    const currentCount = this._messages.length;

    // If we have fewer messages than before, re-render everything
    if (currentCount < this._renderedCount) {
      this.innerHTML = "";
      this._renderedCount = 0;
    }

    // Render only new messages
    for (let i = this._renderedCount; i < currentCount; i++) {
      const message = this._messages[i];
      const messageComponent = new ChatMessage();
      await messageComponent.render(
        message.role,
        message.content,
        message.isLoading || false,
        message.isStreaming || false
      );
      this.insert(this, messageComponent, null);
    }

    // Update content of the last message if it's streaming (FIXED LOGIC)
    if (currentCount > 0) {
      const lastMessage = this._messages[currentCount - 1];
      if (lastMessage.isStreaming) {
        // Update the last rendered message component
        const lastMessageElement = this.lastElementChild as ChatMessage;
        if (
          lastMessageElement &&
          lastMessageElement.tagName.toLowerCase() === "chat-message"
        ) {
          // Use updateStreamingContent for smooth word-by-word animation
          await lastMessageElement.updateStreamingContent(lastMessage.content);
        }
      }
    }

    this._renderedCount = currentCount;
  }
}

if (!customElements.get("chat-messages")) {
  customElements.define("chat-messages", ChatMessages);
}
