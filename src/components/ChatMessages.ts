import { Component } from "@lib";
import { ChatMessage } from "@components";
import type { Message } from "./ChatMain";

export class ChatMessages extends Component {
  private _messages: Array<Message> = [];

  constructor(messages: Array<Message>) {
    super();
    this._messages = messages;
  }

  public updateMessages(messages: Array<Message>) {
    this._messages = messages;
  }

  async render() {
    this.innerHTML = "";
    for (const message of this._messages) {
      const messageComponent = new ChatMessage();
      await messageComponent.render(
        message.role,
        message.content,
        message.isLoading || false,
        message.isStreaming || false
      );
      this.insert(this, messageComponent, null);
    }
  }
}

if (!customElements.get("chat-messages")) {
  customElements.define("chat-messages", ChatMessages);
}
