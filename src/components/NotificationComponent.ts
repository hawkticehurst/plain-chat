import { Component, html, signal, effect } from "@lib";
import "./NotificationComponent.css";

interface NotificationData {
  id: string;
  type: "info" | "warning" | "error" | "success";
  message: string;
  duration?: number; // Auto-dismiss after this many ms (0 = manual dismiss)
}

export class NotificationService {
  private static instance: NotificationService;
  private notifications = signal<Map<string, NotificationData>>(new Map());

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  show(notification: Omit<NotificationData, "id">): string {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const notificationWithId = { ...notification, id };

    const currentNotifications = this.notifications();
    const newNotifications = new Map(currentNotifications);
    newNotifications.set(id, notificationWithId);
    this.notifications(newNotifications);

    // Auto-dismiss if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, notification.duration);
    }

    return id;
  }

  dismiss(id: string): void {
    const currentNotifications = this.notifications();
    const newNotifications = new Map(currentNotifications);
    newNotifications.delete(id);
    this.notifications(newNotifications);
  }

  clear(): void {
    this.notifications(new Map());
  }

  getNotifications() {
    return this.notifications;
  }

  // Convenience methods
  info(message: string, duration: number = 2000): string {
    return this.show({ type: "info", message, duration });
  }

  warning(message: string, duration: number = 3000): string {
    return this.show({ type: "warning", message, duration });
  }

  error(message: string, duration: number = 0): string {
    // Errors don't auto-dismiss
    return this.show({ type: "error", message, duration });
  }

  success(message: string, duration: number = 2000): string {
    return this.show({ type: "success", message, duration });
  }
}

export class NotificationComponent extends Component {
  #service: NotificationService;
  #container: HTMLElement | null = null;

  constructor() {
    super();
    this.#service = NotificationService.getInstance();
  }

  init() {
    // Build the DOM structure once
    this.append(html`<div class="notification-container"></div>`);

    // Cache DOM references
    this.#container = this.querySelector(
      ".notification-container"
    ) as HTMLElement;

    // Wire up reactive effects
    this.#setupReactiveEffects();
  }

  #setupReactiveEffects() {
    // Update notifications when they change
    effect(() => {
      if (!this.#container) return;

      const notificationsMap = this.#service.getNotifications()();
      const notifications = Array.from(notificationsMap.values());

      this.#renderNotifications(notifications);
    });
  }

  #renderNotifications(notifications: NotificationData[]) {
    if (!this.#container) return;

    // Clear existing notifications
    this.#container.innerHTML = "";

    if (notifications.length === 0) {
      return;
    }

    // Create notification elements
    notifications.forEach((notification) => {
      const notificationElement = this.#createNotificationElement(notification);
      this.#container!.appendChild(notificationElement);
    });
  }

  #createNotificationElement(notification: NotificationData): HTMLElement {
    const element = document.createElement("div");
    element.className = `notification notification--${notification.type}`;
    element.setAttribute("data-notification-id", notification.id);

    element.innerHTML = `
      <div class="notification__content">
        <span class="notification__message">${this.#escapeHtml(notification.message)}</span>
        <button class="notification__close" type="button">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;

    // Add event listener to close button
    const closeButton = element.querySelector(".notification__close");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        this.#service.dismiss(notification.id);
      });
    }

    return element;
  }

  #escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

if (!customElements.get("notification-component")) {
  customElements.define("notification-component", NotificationComponent);
}
