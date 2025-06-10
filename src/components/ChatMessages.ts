import { Component } from "../lib/index";
import { ChatMessage } from "./ChatMessage";
import type { Message } from "./ChatMain";

export class ChatMessages extends Component {
  private _messages: Array<Message> = [];

  constructor(messages: Array<Message>) {
    super();
    this._messages = messages;
  }
  
  async render() {
    this.innerHTML = "";
    for (const message of this._messages) {
      const messageComponent = new ChatMessage();
      await messageComponent.render(message.role, message.content);
      this.insert(this, messageComponent, null);
    }
  }
}

customElements.define("chat-messages", ChatMessages);
