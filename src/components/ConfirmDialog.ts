import { Component, html, signal, effect } from "@lib";
import "./ConfirmDialog.css";

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

export class ConfirmDialog extends Component {
  #isOpen = signal(false);
  #options = signal<ConfirmDialogOptions | null>(null);

  // DOM references
  #dialog: HTMLDialogElement | null = null;
  #backdrop: HTMLElement | null = null;

  init() {
    this.append(html`
      <div
        @click="handleCancel"
        @keydown="handleCancel"
        class="dialog-backdrop"
        style="display: none;"
      >
        <dialog class="confirm-dialog">
          <div class="dialog-content">
            <h2 class="dialog-title"></h2>
            <p class="dialog-message"></p>
            <div class="dialog-actions">
              <button class="cancel-btn" @click="handleCancel">Cancel</button>
              <button class="confirm-btn" @click="handleConfirm">
                Confirm
              </button>
            </div>
          </div>
        </dialog>
      </div>
    `);

    // Cache DOM references
    this.#dialog = this.querySelector(".confirm-dialog") as HTMLDialogElement;
    this.#backdrop = this.querySelector(".dialog-backdrop") as HTMLElement;

    // Setup reactive effects
    effect(() => {
      const isOpen = this.#isOpen();
      const options = this.#options();

      if (!this.#dialog || !this.#backdrop) return;

      if (isOpen && options) {
        // Update content
        const titleEl = this.querySelector(".dialog-title") as HTMLElement;
        const messageEl = this.querySelector(".dialog-message") as HTMLElement;
        const confirmBtn = this.querySelector(
          ".confirm-btn"
        ) as HTMLButtonElement;
        const cancelBtn = this.querySelector(
          ".cancel-btn"
        ) as HTMLButtonElement;

        if (titleEl) titleEl.textContent = options.title;
        if (messageEl) messageEl.textContent = options.message;
        if (confirmBtn)
          confirmBtn.textContent = options.confirmText || "Confirm";
        if (cancelBtn) cancelBtn.textContent = options.cancelText || "Cancel";

        // Show dialog
        this.#backdrop.style.display = "flex";
        this.#dialog.showModal();

        // Focus the cancel button by default for safety
        cancelBtn?.focus();
      } else {
        // Hide dialog
        this.#backdrop.style.display = "none";
        this.#dialog.close();
      }
    });

    // Handle backdrop clicks
    // this.#backdrop?.addEventListener("click", (e) => {
    //   if (e.target === this.#backdrop) {
    //     this.handleCancel(e);
    //   }
    // });

    // Handle escape key
    // this.#dialog?.addEventListener("keydown", (e) => {
    //   if (e.key === "Escape") {
    //     this.handleCancel(e);
    //   }
    // });
  }

  // Public API
  public show(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const wrappedOptions = {
        ...options,
        onConfirm: () => {
          options.onConfirm();
          this.close();
          resolve(true);
        },
        onCancel: () => {
          options.onCancel?.();
          this.close();
          resolve(false);
        },
      };

      this.#options(wrappedOptions);
      this.#isOpen(true);
    });
  }

  public close() {
    this.#isOpen(false);
    this.#options(null);
  }

  // Event handlers
  handleConfirm = () => {
    const options = this.#options();
    if (options) {
      options.onConfirm();
    }
  };

  handleCancel = (event: Event) => {
    // If event is triggered by a click
    if (
      event instanceof MouseEvent ||
      (event instanceof KeyboardEvent && event.key === "Escape")
    ) {
      console.log("Cancel dialog");
      const options = this.#options();
      if (options) {
        options.onCancel?.();
      }
    }
  };
}

if (!customElements.get("confirm-dialog")) {
  customElements.define("confirm-dialog", ConfirmDialog);
}
