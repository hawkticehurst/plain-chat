import { Component, html } from "@lib";

interface NotificationData {
  type: "info" | "warning" | "error" | "success";
  message: string;
  duration?: number; // Auto-dismiss after this many ms (0 = manual dismiss)
}

export class NotificationService {
  private static instance: NotificationService;
  private notifications: Map<string, NotificationData> = new Map();
  private listeners: Set<(notifications: NotificationData[]) => void> =
    new Set();

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  show(notification: NotificationData): string {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    this.notifications.set(id, notification);
    this.notifyListeners();

    // Auto-dismiss if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, notification.duration);
    }

    return id;
  }

  dismiss(id: string): void {
    this.notifications.delete(id);
    this.notifyListeners();
  }

  clear(): void {
    this.notifications.clear();
    this.notifyListeners();
  }

  subscribe(listener: (notifications: NotificationData[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const notifications = Array.from(this.notifications.values());
    this.listeners.forEach((listener) => listener(notifications));
  }

  // Convenience methods
  info(message: string, duration: number = 5000): string {
    return this.show({ type: "info", message, duration });
  }

  warning(message: string, duration: number = 7000): string {
    return this.show({ type: "warning", message, duration });
  }

  error(message: string, duration: number = 0): string {
    // Errors don't auto-dismiss
    return this.show({ type: "error", message, duration });
  }

  success(message: string, duration: number = 4000): string {
    return this.show({ type: "success", message, duration });
  }
}

export class NotificationComponent extends Component {
  private _notifications: NotificationData[] = [];
  private _service: NotificationService;
  private _unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this._service = NotificationService.getInstance();
    this._unsubscribe = this._service.subscribe((notifications) => {
      this._notifications = notifications;
      this.render();
    });
    this.render();
  }

  disconnectedCallback() {
    if (this._unsubscribe) {
      this._unsubscribe();
    }
  }

  render() {
    if (this._notifications.length === 0) {
      this.innerHTML = "";
      return;
    }

    this.append(html`
      <div class="notification-container">
        ${this._notifications.map(
          (notification) => html`
            <div class="notification notification--${notification.type}">
              <div class="notification__content">
                <span class="notification__message"
                  >${notification.message}</span
                >
                <button
                  class="notification__close"
                  onclick="this.closest('.notification').remove()"
                >
                  ×
                </button>
              </div>
            </div>
          `
        )}
      </div>
    `);

    // Add event listeners to close buttons
    const closeButtons = this.querySelectorAll(".notification__close");
    closeButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.preventDefault();
        const notificationElement = button.closest(
          ".notification"
        ) as HTMLElement;
        if (notificationElement) {
          notificationElement.remove();
        }
      });
    });
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

if (!customElements.get("notification-component")) {
  customElements.define("notification-component", NotificationComponent);
}
